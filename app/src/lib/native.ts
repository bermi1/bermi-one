/*
  Whether this is the downloaded app or the website.

  It matters in exactly one place, and it matters a lot: Google Play does not
  allow a subscription to a digital service to be sold inside an Android app
  through anything but Play Billing, and Apple goes further and restricts even
  linking out to a payment page. Bermi One is sold for mobile money at
  $20–45 a month, and Play Billing does not take mobile money in Tanzania.

  So the mobile app shows the plan and says nothing about buying one, the way
  Xero, QuickBooks and Zoho Books all do, and the web app — which is where the
  money is actually taken — keeps the full self-serve flow.

  The check reads the global Capacitor injects at runtime rather than importing
  the package, so the web build carries no native dependency and this file works
  before, during and after the shell exists.
*/

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

/** Forced on for the test harness, which has no Capacitor runtime to ask. */
function forced(): boolean | null {
  try {
    const v = localStorage.getItem('bermi:force-native');
    if (v === '1') return true;
    if (v === '0') return false;
  } catch { /* private mode, or storage blocked — fall through to the real check */ }
  return null;
}

export function isNative(): boolean {
  const f = forced();
  if (f !== null) return f;
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
}

/** 'android' | 'ios' | 'web'. */
export function platformName(): string {
  if (forced() === true) return 'android';
  return (typeof window !== 'undefined' && window.Capacitor?.getPlatform?.()) || 'web';
}

export const isAndroid = () => platformName() === 'android';
export const isIos = () => platformName() === 'ios';
