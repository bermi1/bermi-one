import { useEffect, useState } from 'react';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED = 'bermi.install.dismissed';

/**
 * Offer to install the app.
 *
 * Chrome and Edge fire `beforeinstallprompt` and let us show the real system
 * dialogue at a moment of our choosing. iOS Safari fires nothing and has no API
 * at all — the only way onto a home screen there is Share → Add to Home Screen —
 * so that case gets instructions rather than a button that cannot work.
 *
 * Deliberately not shown on first paint: someone who has been in the app for
 * half a minute has some idea whether they want it. A prompt that appears
 * before the product does is a prompt that gets dismissed reflexively.
 */
export function InstallPrompt() {
  const { lang } = useSettings();
  const sw = lang === 'sw';

  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already installed, or previously waved away.
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    try { if (localStorage.getItem(DISMISSED)) return; } catch { /* private mode: just show it */ }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
      setTimeout(() => setVisible(true), 25_000);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos && isSafari) {
      setIosHint(true);
      setTimeout(() => setVisible(true), 25_000);
    }

    const onInstalled = () => setVisible(false);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible || (!deferred && !iosHint)) return null;

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(DISMISSED, '1'); } catch { /* nothing to remember it with */ }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome !== 'accepted') dismiss();
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label={sw ? 'Sakinisha Bermi One' : 'Install Bermi One'}
      style={{
        position: 'fixed', left: 12, right: 12, zIndex: 60,
        bottom: 'calc(var(--nav-h, 74px) + 12px + env(safe-area-inset-bottom, 0px))',
        maxWidth: 440, margin: '0 auto',
        background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18,
        boxShadow: '0 18px 46px rgba(10,16,34,.28)', padding: 15,
        display: 'flex', alignItems: 'flex-start', gap: 12,
        animation: 'install-rise .32s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <img src="/icons/bermi-mark.svg" alt="" width={40} height={40} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>
          {sw ? 'Weka Bermi One kwenye simu yako' : 'Put Bermi One on your phone'}
        </div>
        <div style={{ marginTop: 3, fontSize: 12, color: 'var(--ink2)', lineHeight: 1.45 }}>
          {iosHint
            ? (sw
              ? 'Gusa Share, kisha "Add to Home Screen".'
              : 'Tap Share, then "Add to Home Screen".')
            : (sw
              ? 'Inafunguka kama programu kamili, na inafanya kazi hata bila mtandao.'
              : 'Opens like a real app, and works even without a connection.')}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
          {!iosHint && (
            <button className="btn-primary tap" style={{ padding: '9px 16px', fontSize: 13 }} onClick={install}>
              {sw ? 'Sakinisha' : 'Install'}
            </button>
          )}
          <button className="btn-ghost tap" style={{ padding: '9px 14px', fontSize: 13 }} onClick={dismiss}>
            {sw ? 'Si sasa' : 'Not now'}
          </button>
        </div>
      </div>
      <button className="icon-btn tap" style={{ width: 28, height: 28, flexShrink: 0 }} onClick={dismiss} aria-label={sw ? 'Funga' : 'Dismiss'}>
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}
