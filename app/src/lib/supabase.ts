import { createClient } from '@supabase/supabase-js';
import { Preferences } from '@capacitor/preferences';
import { isNative } from './native';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/*
  Where the session is kept on a phone.

  A Capacitor webview's localStorage is ordinary browser storage, and Android
  will clear it — "clear cache" in the app info screen, or the system reclaiming
  space on a cheap handset with a full disk. That would sign the owner out
  silently, usually the night they need to close the day. Preferences writes to
  SharedPreferences instead, which survives all of it and is only removed when
  the app is uninstalled.

  Only native uses it. Swapping the web app's storage would move every existing
  session's key and sign everybody out once, for nothing.
*/
const nativeStorage = {
  async getItem(k: string) {
    const { value } = await Preferences.get({ key: k });
    return value ?? null;
  },
  async setItem(k: string, value: string) {
    await Preferences.set({ key: k, value });
  },
  async removeItem(k: string) {
    await Preferences.remove({ key: k });
  },
};

/*
  Patience with the gateway's clock.

  Straight after a session refresh the API has answered "JWT issued at future"
  for several seconds at a time: the new token is stamped by Auth, and the
  gateway checking it briefly thinks that moment has not happened yet. Nothing
  is wrong with the token, so the fix is simply to ask again a moment later —
  here, once, for every query in the app, rather than failing the screen.

  "JWT expired" gets the same treatment plus one refresh first, which is what a
  phone whose clock runs slow produces.
*/
const JWT_TIME = /PGRST30[13]|issued at future|JWT expired/i;
const BACKOFF_MS = [800, 1500, 3000, 6000, 12000, 20000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Server clock minus this device's clock, from the last response that said. */
let skewMs: number | null = null;
export function clockSkewMs() {
  return skewMs;
}

function noteServerDate(res: Response) {
  const t = Date.parse(res.headers.get('date') || '');
  if (!Number.isNaN(t)) skewMs = t - Date.now();
}

async function jwtTimeError(res: Response): Promise<string | null> {
  if (res.status !== 401) return null;
  try {
    const body = await res.clone().text();
    return JWT_TIME.test(body) ? body : null;
  } catch {
    return null;
  }
}

async function patientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let res = await fetch(input, init);
  noteServerDate(res);
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  // Auth's own calls are left alone: refreshing from inside one would recurse.
  if (href.includes('/auth/v1/')) return res;

  let refreshed = false;
  for (const wait of BACKOFF_MS) {
    const body = await jwtTimeError(res);
    if (!body) break;
    await sleep(wait);
    let next = init;
    if (/expired/i.test(body) && !refreshed) {
      refreshed = true;
      const { data } = await supabase.auth.refreshSession();
      const token = data.session?.access_token;
      if (token) {
        const headers = new Headers(init?.headers);
        headers.set('Authorization', `Bearer ${token}`);
        next = { ...init, headers };
      }
    }
    res = await fetch(input, next);
    noteServerDate(res);
  }
  return res;
}

export type LoadErrorKind = 'auth-time' | 'network' | 'other';

/** What kind of failure a load error message is, for words a person can act on. */
export function loadErrorKind(message: string): LoadErrorKind {
  if (JWT_TIME.test(message) || /JWT/i.test(message)) return 'auth-time';
  if (/failed to fetch|network|load failed|timeout|offline/i.test(message)) return 'network';
  return 'other';
}

export const supabase = createClient(url, key, {
  global: { fetch: patientFetch },
  auth: {
    /*
      PKCE rather than the implicit flow. The implicit flow puts the tokens in
      the URL fragment, and on Android that URL travels through the OS to reach
      the app — any other app registered for the same link would see it. PKCE
      sends a one-time code instead, which is worthless without the verifier
      this client holds.
    */
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    // The app opens its own recovery links through the deep-link listener in
    // src/lib/deepLinks.ts, so the client must not also race it for the URL.
    detectSessionInUrl: !isNative(),
    ...(isNative() ? { storage: nativeStorage } : {}),
  },
});
