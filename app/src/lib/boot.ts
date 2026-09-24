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
export const BOOT_CEILING_MS = 4500;
