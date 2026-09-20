import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './lib/pwa';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * Retire the boot screen painted by index.html.
 *
 * Not when React has painted — when the app is actually usable. React commits
 * its tree within a frame or two, but at that moment auth is still resolving and
 * the business is still loading, so fading the splash there dissolved it into a
 * bare "Loading…" line. One load that looks like two is most of why the app felt
 * slow.
 *
 * AppRoutes calls window.__bermiReady() at the point it would otherwise have
 * rendered a spinner. The timeout is the backstop: a stalled network must not
 * hold the splash for ever, and the app can show its own state from there.
 */
const BOOT_CEILING_MS = 4500;

function retireBoot() {
  const boot = document.getElementById('boot');
  if (!boot || boot.dataset.done) return;
  boot.dataset.done = 'true';
  boot.addEventListener('transitionend', () => boot.remove(), { once: true });
  // Belt and braces: if the transition never fires, the screen still goes.
  setTimeout(() => boot.remove(), 800);
}

declare global {
  interface Window {
    __bermiReady?: () => void;
  }
  /** Stamped by vite.config.ts; see the note there. */
  const __BUILD_ID__: string;
}

window.__bermiReady = () => {
  // One more frame so the app's first screen is on the glass before the cover
  // comes off, rather than a frame of empty background between the two.
  requestAnimationFrame(() => requestAnimationFrame(retireBoot));
};

setTimeout(retireBoot, BOOT_CEILING_MS);

// Offline shell. Registered late so it never competes with first paint, and
// only in production — a stale worker during development is a debugging tax
// nobody needs.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // The build id in the URL is what makes a deploy a new worker with a new
    // cache, rather than one that keeps serving the last release's shell.
    void navigator.serviceWorker.register(`/sw.js?v=${__BUILD_ID__}`).catch(() => {
      // An unavailable service worker costs offline support, nothing more.
    });
  });
}
