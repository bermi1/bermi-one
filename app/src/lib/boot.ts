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
export const BOOT_CEILING_MS = 6500;

/**
 * The shortest the splash is shown, counted from navigation start.
 *
 * On a warm cache the app is ready in well under a second, and a brand screen
 * that flashes and vanishes reads as a glitch rather than an opening. Four
 * seconds gives the mark and the line under it time to land.
 */
export const BOOT_MIN_MS = 4000;
