import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { HQ } from './hq-i18n';
import type { LiveStatus } from './useRealtime';

export type HqSection = 'overview' | 'clients' | 'activity' | 'ontology' | 'payments' | 'inquiries' | 'messages' | 'webhooks' | 'audit';

const SECTIONS: { id: HqSection; icon: string }[] = [
  { id: 'overview', icon: 'grid' },
  { id: 'clients', icon: 'building' },
  { id: 'activity', icon: 'trend' },
  { id: 'ontology', icon: 'layers' },
  { id: 'payments', icon: 'cash' },
  { id: 'inquiries', icon: 'spark' },
  { id: 'messages', icon: 'mail' },
  { id: 'webhooks', icon: 'swap' },
  { id: 'audit', icon: 'shield' },
];

/**
 * The control panel is its own application, not a screen inside the product.
 *
 * Bermi Techs staff are not running a bar — they are running the company that
 * runs the bars. Wrapping this in the tenant shell would put a "Close the day"
 * button under a page about platform revenue, and leave staff switching
 * businesses to change what the console shows. So this owns the whole viewport:
 * its own rail, its own header, its own language toggle, and one deliberate
 * door back to the product.
 */
export function PortalShell({ section, onSection, live, onRefresh, children }: {
  section: HqSection;
  onSection: (s: HqSection) => void;
  live?: LiveStatus;
  onRefresh?: () => void;
  children: ReactNode;
}) {
  const nav = useNavigate();
  const { lang } = useSettings();
  const { displayName, setLang } = useData();
  const T = HQ[lang];
  const [railOpen, setRailOpen] = useState(false);

  // The console is dark whatever the tenant app is set to. It is a different
  // room, and it should feel like one the moment it opens.
  useEffect(() => {
    const previous = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = 'dark';
    return () => { document.documentElement.dataset.theme = previous || 'light'; };
  }, []);

  const liveDot = live === 'live' ? 'var(--ok)' : live === 'connecting' ? 'var(--warn)' : 'var(--ink3)';
  const liveLabel = live === 'live' ? T.live : live === 'connecting' ? T.reconnecting : T.paused;

  return (
    <div className="hq">
      <aside className="hq-rail" data-open={railOpen || undefined}>
        <div className="hq-brand">
          <img src="/icons/bermi-mark.svg" alt="" width={30} height={30} />
          <div style={{ minWidth: 0 }}>
            <div className="hq-brand-name">{T.hq}</div>
            <div className="hq-brand-sub">{T.hqSub}</div>
          </div>
        </div>

        <nav className="hq-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className="hq-nav-item"
              data-on={section === s.id || undefined}
              onClick={() => { onSection(s.id); setRailOpen(false); }}
            >
              <Icon name={s.icon} size={16} />
              <span>{T[s.id]}</span>
            </button>
          ))}
        </nav>

        <div className="hq-rail-foot">
          <div className="hq-who">
            <div className="hq-who-label">{T.signedInAs}</div>
            <div className="hq-who-name">{displayName}</div>
          </div>
          <button className="hq-nav-item" onClick={() => setLang(lang === 'en' ? 'sw' : 'en')}>
            <Icon name="globe" size={16} />
            <span>{lang === 'en' ? 'Kiswahili' : 'English'}</span>
          </button>
          <button className="hq-nav-item" onClick={() => nav('/home')}>
            <Icon name="out" size={16} />
            <span>{T.backToApp}</span>
          </button>
        </div>
      </aside>

      {railOpen && <div className="hq-scrim" onClick={() => setRailOpen(false)} />}

      <main className="hq-main">
        <header className="hq-head">
          <button className="hq-burger" onClick={() => setRailOpen(true)} aria-label="Menu">
            <Icon name="grid" size={16} />
          </button>
          <h1 className="hq-title">{T[section]}</h1>
          <div style={{ flex: 1 }} />
          {live && (
            <span className="hq-live" title={liveLabel}>
              <span className="hq-dot" style={{ background: liveDot }} />
              {liveLabel}
            </span>
          )}
          {onRefresh && (
            <button className="hq-icon-btn" onClick={onRefresh} aria-label={T.refresh}>
              <Icon name="swap" size={15} />
            </button>
          )}
        </header>

        <div className="hq-body">{children}</div>
      </main>
    </div>
  );
}
