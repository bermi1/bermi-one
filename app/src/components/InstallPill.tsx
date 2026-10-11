import { useEffect, useState } from 'react';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { isNative } from '../lib/native';
import { canInstall, install, isIosSafari, isStandalone, onInstallChange } from '../lib/pwa';
import { haptic } from '../lib/haptics';
import { Sheet } from './Sheet';

/**
 * "Install app", always within reach.
 *
 * Shown in every browser tab that is not already the installed app — not only
 * when Chrome has handed over its install prompt. Chrome fires that event late,
 * sometimes not at all on a second visit, and Samsung Internet, Firefox and
 * Safari never fire it. Where there is a prompt, the button fires it; where
 * there is not, it opens the two steps that do the same thing by hand.
 */
export function InstallPill({ variant = 'chip' }: { variant?: 'chip' | 'row' }) {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const [hidden, setHidden] = useState(() => isNative() || isStandalone());
  const [, bump] = useState(0);
  const [help, setHelp] = useState(false);

  useEffect(() => onInstallChange(() => { setHidden(isNative() || isStandalone()); bump((n) => n + 1); }), []);
  if (hidden) return null;

  async function run() {
    haptic();
    if (canInstall()) {
      const outcome = await install();
      if (outcome === 'accepted') setHidden(true);
      if (outcome !== 'unavailable') return;
    }
    setHelp(true);
  }

  const ios = isIosSafari();
  const label = sw ? 'Weka app' : 'Install app';

  return (
    <>
      {variant === 'chip' ? (
        <button
          type="button"
          className="chip tap install-pill"
          onClick={run}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px', background: 'var(--grad)', color: '#fff', border: 'none' }}
        >
          <Icon name="download" size={12} />
          <span style={{ fontSize: 11.5 }}>{label}</span>
        </button>
      ) : (
        <button type="button" className="sidebar-item tap install-pill" onClick={run} style={{ width: '100%' }}>
          <Icon name="download" size={16} />
          <span>{label}</span>
        </button>
      )}
      <Sheet open={help} onClose={() => setHelp(false)} title={sw ? 'Weka Bermi One kwenye simu' : 'Put Bermi One on your home screen'}>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, lineHeight: 1.5, fontWeight: 600 }}>
          {ios ? (
            <>
              <li>{sw ? 'Gusa kitufe cha Shiriki' : 'Tap the Share button'} <Icon name="share" size={14} style={{ verticalAlign: '-2px' }} /> {sw ? 'chini ya Safari.' : 'at the bottom of Safari.'}</li>
              <li>{sw ? 'Chagua "Ongeza kwenye Skrini ya Nyumbani", kisha "Ongeza".' : 'Choose "Add to Home Screen", then "Add".'}</li>
            </>
          ) : (
            <>
              <li>{sw ? 'Gusa menyu ya kivinjari (⋮ juu kulia).' : 'Open the browser menu (⋮ at the top right).'}</li>
              <li>{sw ? 'Chagua "Sakinisha app" au "Ongeza kwenye skrini ya nyumbani".' : 'Choose "Install app" or "Add to Home screen".'}</li>
            </>
          )}
          <li>{sw ? 'Fungua Bermi One kutoka kwenye skrini yako — inafunguka kama app, bila kivinjari.' : 'Open Bermi One from your home screen — it runs full-screen, like any app.'}</li>
        </ol>
      </Sheet>
    </>
  );
}
