import { useEffect, useState, type RefObject } from 'react';

/**
 * Whether the screen this element sits in has scrolled past `threshold`.
 *
 * Pages scroll the window; this also watches the element's own `.screen` in
 * case a layout gives it a scroll area of its own, so one header component
 * works on every page without each page passing its scroller down.
 */
export function useScrolled(ref: RefObject<HTMLElement | null>, threshold = 24): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    // The window normally scrolls; a screen with its own scroll area (a
    // fixed-height layout) is watched too, and whichever moved counts.
    const screen = ref.current?.closest('.screen') as HTMLElement | null;
    const read = () => setScrolled(Math.max(window.scrollY, screen?.scrollTop ?? 0) > threshold);
    read();
    window.addEventListener('scroll', read, { passive: true });
    screen?.addEventListener('scroll', read, { passive: true });
    return () => {
      window.removeEventListener('scroll', read);
      screen?.removeEventListener('scroll', read);
    };
  }, [ref, threshold]);
  return scrolled;
}
