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

export const supabase = createClient(url, key, {
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
