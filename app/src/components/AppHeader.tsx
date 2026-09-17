import { useState } from 'react';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { bizMeta } from '../lib/types';
import { BusinessSwitchSheet } from './BusinessSwitchSheet';

export function AppHeader() {
  const { L, lang, theme, owner } = useSettings();
  const { activeBusiness, setTheme, setRole } = useData();
  const [switching, setSwitching] = useState(false);
  const meta = activeBusiness ? bizMeta(activeBusiness.type) : null;

  return (
    <>
      <div className="top-bar">
        <div className="row tap" style={{ gap: 10, minWidth: 0 }} onClick={() => setSwitching(true)}>
          {/* The business's own type icon once there is a business; the Bermi
              mark before that, so the app is never wearing a placeholder. */}
          {meta ? (
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--grad)', display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0 }}>
              <Icon name={meta.icon} size={17} />
            </div>
          ) : (
            <img src="/icons/bermi-mark.svg" alt="" width={38} height={38} style={{ flexShrink: 0 }} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeBusiness?.name || 'Bermi One'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>{L.tagline}</div>
          </div>
          <Icon name="down" size={14} style={{ color: 'var(--ink3)', flexShrink: 0 }} />
        </div>
        <div className="row" style={{ gap: 6, flexShrink: 0 }}>
          <button
            className="chip tap"
            type="button"
            onClick={() => setRole(owner ? 'staff' : 'owner')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px 7px 8px', background: 'var(--brandSoft)', color: 'var(--brand)', border: 'none' }}
          >
            <Icon name={owner ? 'shield' : 'user'} size={12} />
            <span style={{ fontSize: 11.5 }}>{owner ? (lang === 'sw' ? 'Mmiliki' : 'Owner') : (lang === 'sw' ? 'Mfanyakazi' : 'Staff')}</span>
          </button>
          <button className="icon-btn tap" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} type="button" aria-label="Toggle theme">
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} />
          </button>
        </div>
      </div>
      <BusinessSwitchSheet open={switching} onClose={() => setSwitching(false)} />
    </>
  );
}
