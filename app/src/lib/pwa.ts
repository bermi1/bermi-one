/*
  Installing the app from the browser.

  This file is imported from main.tsx rather than from a component, and that is
  the whole point. Chrome fires `beforeinstallprompt` once, early — usually
  before React has rendered, and certainly before the Manage screen exists. A
  listener registered inside a component's effect misses it, which is why the
  install banner mostly never appeared. Registered at module load, the event is
  caught and held, and any screen can ask for it later.

  iOS Safari fires nothing and exposes no API at all: the only route onto a home
  screen there is Share → Add to Home Screen. That case gets instructions rather
  than a button that cannot work.
*/

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function announce() {
  for (const fn of listeners) fn();
}

/** Subscribe to changes in installability. Returns an unsubscribe function. */
export function onInstallChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Preventing the default is what lets us choose the moment. Without it
    // Chrome shows its own mini-infobar and the event is spent.
    e.preventDefault();
    deferred = e as InstallEvent;
    announce();
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    announce();
  });
}

/** Already running from a home screen, so there is nothing to install. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (installed) return true;
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

/** Safari on iOS: installable, but only by hand. */
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua)
    // iPadOS reports itself as a Mac; the touch points give it away.
    || (/Macintosh/.test(ua) && typeof document !== 'undefined' && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && safari;
}

/** True when the browser has given us a prompt to fire. */
export function canInstall(): boolean {
  return !!deferred && !isStandalone();
}

/** True when there is something worth offering, prompt or instructions. */
export function canOffer(): boolean {
  return !isStandalone() && (canInstall() || isIosSafari());
}

/**
 * Fire the browser's own install dialogue.
 *
 * The event is single-use: once prompted it is spent whatever the person
 * chooses, so it is cleared either way rather than left behind as a button that
 * silently does nothing the second time.
 */
export async function install(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  const event = deferred;
  deferred = null;
  announce();
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    return 'unavailable';
  }
}
