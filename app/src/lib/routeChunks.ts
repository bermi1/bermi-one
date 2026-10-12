/*
  Every lazily-loaded screen, by name, with the function that fetches it.

  Kept in one map so the same loader serves two purposes: React.lazy uses it to
  render the screen, and preload() uses it to fetch the screen *before* anyone
  taps it. Without the second, the first visit to Money or Reports on a phone
  network showed an empty page while its code downloaded.
*/
export const CHUNKS = {
  onboarding: () => import('../routes/Onboarding'),
  approval: () => import('../routes/Approval'),
  money: () => import('../routes/Money'),
  reports: () => import('../routes/Reports'),
  ai: () => import('../routes/AI'),
  manage: () => import('../routes/Manage'),
  business: () => import('../routes/BusinessProfile'),
  staff: () => import('../routes/Staff'),
  hq: () => import('../portal/Hq'),
  suspended: () => import('../routes/Suspended'),
  pricing: () => import('../routes/Pricing'),
  help: () => import('../routes/Help'),
  legal: () => import('../routes/Legal'),
  setPassword: () => import('../routes/SetPassword'),
  book: () => import('../routes/Book'),
  ticket: () => import('../routes/Ticket'),
  salonToday: () => import('../routes/salon/SalonToday'),
  bookings: () => import('../routes/salon/Bookings'),
  clients: () => import('../routes/salon/Clients'),
  services: () => import('../routes/salon/Services'),
  payouts: () => import('../routes/salon/Payouts'),
  salonReports: () => import('../routes/salon/SalonReports'),
} as const;

export type ChunkName = keyof typeof CHUNKS;

/*
  A page's code missing after a deploy.

  Every release renames every screen's file. A phone that opened the app before
  the release still holds the old index, and when it asks for a screen it has
  not fetched yet, that file is gone — the import fails, React has nothing to
  render, and the page was white until the person backed out far enough or
  killed the app. The cure is the new release: reload once, onto the same page.
*/
const STALE = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|MIME type|ChunkLoadError|Loading chunk/i;
const RELOAD_KEY = 'bermi:chunk-reload';

export function isStaleChunk(e: unknown) {
  return STALE.test(e instanceof Error ? e.message : String(e));
}

/** Reload onto the current URL, at most once a minute so a real outage cannot loop. */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch { /* storage blocked: still worth one reload */ }
  window.location.reload();
  return true;
}

/** How long a screen's code may take before the page says so, instead of waiting for ever. */
const SCREEN_TIMEOUT_MS = 20_000;

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('SCREEN_TIMEOUT: the page took too long to download')), SCREEN_TIMEOUT_MS);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/**
 * The loader React.lazy renders with. A dropped connection gets one more try;
 * a stale file reloads into the new release; a download that hangs fails after
 * twenty seconds so the page can offer Reload, rather than sitting there.
 */
export function loadScreen<N extends ChunkName>(name: N): ReturnType<(typeof CHUNKS)[N]> {
  const once = () => withTimeout(CHUNKS[name]() as Promise<unknown>);
  return once()
    .catch((e: unknown) => {
      if (String((e as Error)?.message || e).startsWith('SCREEN_TIMEOUT')) throw e;
      return new Promise((r) => setTimeout(r, 800)).then(once);
    })
    .catch((e: unknown) => {
      if (isStaleChunk(e) && reloadForNewVersion()) return new Promise(() => {}); // the reload takes over
      throw e;
    }) as ReturnType<(typeof CHUNKS)[N]>;
}

const started = new Set<ChunkName>();

/** Start fetching a screen's code now. Safe to call repeatedly. */
export function preload(name: ChunkName) {
  if (started.has(name)) return;
  started.add(name);
  CHUNKS[name]().catch(() => started.delete(name)); // a failed fetch may be retried later
}

/** Which chunk a path needs, for the active module. */
export function chunkForPath(path: string, salon: boolean): ChunkName | null {
  const map: Record<string, ChunkName> = salon
    ? { '/home': 'salonToday', '/bookings': 'bookings', '/clients': 'clients', '/services': 'services', '/payouts': 'payouts', '/reports': 'salonReports' }
    : { '/approval': 'approval', '/reports': 'reports' };
  const shared: Record<string, ChunkName> = { '/money': 'money', '/ai': 'ai', '/manage': 'manage', '/business': 'business', '/staff': 'staff', '/pricing': 'pricing', '/help': 'help' };
  return map[path] || shared[path] || null;
}

/**
 * Fetch every screen in the background once the app is up: the active
 * module's first, then the rest, in idle time so nothing on screen waits.
 */
export function preloadAll(salon: boolean) {
  const first: ChunkName[] = salon
    ? ['salonToday', 'clients', 'money', 'salonReports', 'manage', 'services', 'payouts', 'bookings']
    : ['money', 'reports', 'manage', 'approval', 'staff', 'ai'];
  const rest = (Object.keys(CHUNKS) as ChunkName[]).filter((n) => !first.includes(n) && n !== 'hq');
  const queue = [...first, ...rest];
  const idle = (cb: () => void) => {
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void };
    if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 1200 }); else setTimeout(cb, 150);
  };
  const step = () => {
    const next = queue.shift();
    if (!next) return;
    preload(next);
    idle(step);
  };
  idle(step);
}
