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
  salonToday: () => import('../routes/salon/SalonToday'),
  bookings: () => import('../routes/salon/Bookings'),
  clients: () => import('../routes/salon/Clients'),
  services: () => import('../routes/salon/Services'),
  payouts: () => import('../routes/salon/Payouts'),
  salonReports: () => import('../routes/salon/SalonReports'),
} as const;

export type ChunkName = keyof typeof CHUNKS;

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
