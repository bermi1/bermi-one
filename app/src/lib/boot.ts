/*
  The handover from the boot screen painted by index.html.

  Its own module because both main.tsx (which removes the screen) and App.tsx
  (which decides when the app is worth showing) need the same number, and
  importing one from the other would make a cycle out of a constant.
*/

/**
 * How long the splash may cover a slow start before the app has to show
 * something of its own.
 *
 * A stalled network must not hold it for ever — and whatever is underneath has
 * to be a real screen by then, not an empty one.
 */
/**
 * The shortest the splash is shown, counted from navigation start.
 *
 * The first open of a session gets the full brand intro — seven seconds, long
 * enough for the mark, the name and the typed line to land. A reload inside
 * the same session (a refresh mid-shift) gets a short one, because making
 * someone at a counter wait seven seconds twice is a cost, not a welcome.
 * index.html reads the same sessionStorage flag, so its progress bar fills
 * over exactly this time.
 */
export const BOOT_FIRST_MS = 7000;
export const BOOT_REPEAT_MS = 2500;
export const BOOT_MIN_MS: number = (() => {
  try {
    const seen = sessionStorage.getItem('bermi:booted');
    sessionStorage.setItem('bermi:booted', '1');
    return seen ? BOOT_REPEAT_MS : BOOT_FIRST_MS;
  } catch {
    return BOOT_FIRST_MS;
  }
})();

/**
 * How long the splash may cover a slow start before the app has to show
 * something of its own. A stalled network must not hold it for ever.
 */
export const BOOT_CEILING_MS = BOOT_MIN_MS + 2500;
