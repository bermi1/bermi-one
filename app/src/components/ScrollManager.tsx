import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/*
  Where the page is scrolled when you arrive.

  The app scrolls the window, and a single-page app never resets it on its own:
  read far down Reports, tap Manage, and Manage opened at Reports' depth. On a
  phone that is past the bottom of a page still loading — an empty background
  with nothing to tap, which looked like a white screen until you went back.

  So a new page opens at the top. Going back returns to where you were on that
  page, once it is tall enough to be there again.
*/
const saved = new Map<string, number>();

export function ScrollManager() {
  const location = useLocation();
  const type = useNavigationType();
  const key = location.key;
  const keyRef = useRef(key);
  const quietUntil = useRef(0);

  // Remember where each page was left. Ignore the scrolls this component causes itself.
  useEffect(() => {
    const onScroll = () => { if (performance.now() > quietUntil.current) saved.set(keyRef.current, window.scrollY); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Before paint, so the new page never shows a frame at the old depth.
  useLayoutEffect(() => {
    keyRef.current = key;
    quietUntil.current = performance.now() + 250;
    const top = (y: number) => window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior });
    top(0);
    const target = type === 'POP' ? saved.get(key) ?? 0 : 0;
    if (!target) return;
    // The page may still be loading: wait (up to about a second) until it is tall enough.
    let tries = 0;
    let raf = 0;
    const attempt = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max >= target - 4 || tries++ > 60) {
        quietUntil.current = performance.now() + 250;
        top(Math.min(target, Math.max(0, max)));
        return;
      }
      raf = requestAnimationFrame(attempt);
    };
    raf = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(raf);
  }, [key, type]);

  return null;
}

if (typeof window !== 'undefined' && 'scrollRestoration' in history) {
  // The browser's own restoration fights the one above on back/forward.
  history.scrollRestoration = 'manual';
}
