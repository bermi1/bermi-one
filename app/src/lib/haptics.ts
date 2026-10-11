/** A short tick under the finger, where the phone supports it. Silent elsewhere. */
export function haptic(ms = 10) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
  } catch { /* not allowed here: no tick */ }
}
