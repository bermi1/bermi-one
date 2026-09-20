import { useEffect, useState } from 'react';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { isNative } from '../lib/native';
import { canInstall, canOffer, install, isIosSafari, onInstallChange } from '../lib/pwa';

const SNOOZED = 'bermi.install.snoozed';
const SNOOZE_DAYS = 14;

/**
 * Offer to install the app, once, quietly.
 *
 * The listener itself lives in src/lib/pwa.ts and is registered before React
 * renders — this component only reads what it caught. That is the fix for a
 * banner that used to miss `beforeinstallprompt` entirely and so never showed.
 *
 * Deliberately not on first paint: someone who has been in the app for half a
 * minute has some idea whether they want it. And "not now" snoozes for a
 * fortnight rather than silencing it for ever — the permanent way in is the
 * entry on the Manage screen, which is where someone goes when they have
 * decided.
 */
export function InstallPrompt() {
  const { lang } = useSettings();
  const sw = lang === 'sw';

  const [offer, setOffer] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Inside the downloaded app there is nothing to install.
    if (isNative()) return;

    try {
      const until = Number(localStorage.getItem(SNOOZED) || 0);
      if (until > Date.now()) return;
    } catch { /* private mode: just offer it */ }

    const sync = () => setOffer(canOffer());
    sync();
    const stop = onInstallChange(sync);
    const timer = setTimeout(() => setVisible(true), 25_000);
    return () => { stop(); clearTimeout(timer); };
  }, []);

  if (!visible || !offer) return null;

  const iosHint = !canInstall() && isIosSafari();

  function snooze() {
    setVisible(false);
    try { localStorage.setItem(SNOOZED, String(Date.now() + SNOOZE_DAYS * 86_400_000)); } catch { /* nothing to remember it with */ }
  }

  async function run() {
    const outcome = await install();
    if (outcome !== 'accepted') snooze();
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
            <button className="btn-primary tap" style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => void run()}>
              {sw ? 'Sakinisha' : 'Install'}
            </button>
          )}
          <button className="btn-ghost tap" style={{ padding: '9px 14px', fontSize: 13 }} onClick={snooze}>
            {sw ? 'Si sasa' : 'Not now'}
          </button>
        </div>
      </div>
      <button className="icon-btn tap" style={{ width: 28, height: 28, flexShrink: 0 }} onClick={snooze} aria-label={sw ? 'Funga' : 'Dismiss'}>
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}
