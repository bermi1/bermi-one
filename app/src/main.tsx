import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * Retire the boot screen painted by index.html.
 *
 * Two frames, not one: the first lets React commit its tree, the second lets
 * the browser paint it. Fading any earlier shows a white flash between the
 * splash and the app, which is exactly what the splash exists to prevent.
 */
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const boot = document.getElementById('boot');
    if (!boot) return;
    boot.dataset.done = 'true';
    boot.addEventListener('transitionend', () => boot.remove(), { once: true });
    // Belt and braces: if the transition never fires, the screen still goes.
    setTimeout(() => boot.remove(), 800);
  });
});

// Offline shell. Registered late so it never competes with first paint, and
// only in production — a stale worker during development is a debugging tax
// nobody needs.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // An unavailable service worker costs offline support, nothing more.
    });
  });
}
