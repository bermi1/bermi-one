import { useState } from 'react';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { bizMeta } from '../lib/types';
import { BusinessSwitchSheet } from './BusinessSwitchSheet';

export function AppHeader() {
  const { L, lang, theme, owner } = useSettings();
  const { activeBusiness, setLang, setTheme, setRole } = useData();
  const [switching, setSwitching] = useState(false);
  const meta = activeBusiness ? bizMeta(activeBusiness.type) : null;

  return (
    <>
      <div className="top-bar">
        <div className="row tap" style={{ gap: 10, minWidth: 0 }} onClick={() => setSwitching(true)}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--grad)', display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0 }}>
            {meta ? <Icon name={meta.icon} size={17} /> : <span style={{ fontWeight: 800 }}>B</span>}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeBusiness?.name || 'Bermi One'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>{L.tagline}</div>
          </div>
          <Icon name="down" size={14} style={{ color: 'var(--ink3)', flexShrink: 0 }} />
        </div>
        <div className="row" style={{ gap: 8, flexShrink: 0 }}>
          <div style={{ display: 'flex', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: 2, gap: 2, boxShadow: 'var(--sh)' }}>
            <button
              className="tap"
              type="button"
              onClick={() => setRole('owner')}
              style={{ padding: '6px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: owner ? 'var(--brandSoft)' : 'transparent', color: owner ? 'var(--brand)' : 'var(--ink3)' }}
            >
              {lang === 'sw' ? 'Mmiliki' : 'Owner'}
            </button>
            <button
              className="tap"
              type="button"
              onClick={() => setRole('staff')}
              style={{ padding: '6px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: !owner ? 'var(--brandSoft)' : 'transparent', color: !owner ? 'var(--brand)' : 'var(--ink3)' }}
            >
              {lang === 'sw' ? 'Mfanyakazi' : 'Staff'}
            </button>
          </div>
          <button className="chip tap" onClick={() => setLang(lang === 'en' ? 'sw' : 'en')} type="button">
            {lang === 'en' ? 'EN' : 'SW'}
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
