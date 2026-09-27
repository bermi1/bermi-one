import { useRef, useState } from 'react';
import { useScrolled } from '../lib/useScrolled';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { bizMeta } from '../lib/types';
import { BusinessSwitchSheet } from './BusinessSwitchSheet';
import { Sheet } from './Sheet';
import { RolePanel } from './StaffAccess';

export function AppHeader() {
  const { L, lang, theme, owner } = useSettings();
  const { activeBusiness, setTheme, activeStaff } = useData();
  const [switching, setSwitching] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const scrolled = useScrolled(barRef, 8);
  const meta = activeBusiness ? bizMeta(activeBusiness.type) : null;

  return (
    <>
      <div ref={barRef} className="top-bar" data-scrolled={scrolled || undefined}>
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
            onClick={() => setRoleOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px 7px 8px', background: 'var(--brandSoft)', color: 'var(--brand)', border: 'none' }}
          >
            <Icon name={owner ? 'shield' : 'user'} size={12} />
            <span style={{ fontSize: 11.5, maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{owner ? (lang === 'sw' ? 'Mmiliki' : 'Owner') : (activeStaff?.name || (lang === 'sw' ? 'Mfanyakazi' : 'Staff'))}</span>
          </button>
          <button className="icon-btn tap" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} type="button" aria-label="Toggle theme">
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} />
          </button>
        </div>
      </div>
      <BusinessSwitchSheet open={switching} onClose={() => setSwitching(false)} />
      <Sheet
        open={roleOpen}
        onClose={() => setRoleOpen(false)}
        title={owner ? (lang === 'sw' ? 'Mpe mfanyakazi kifaa' : 'Hand this device to staff') : (lang === 'sw' ? 'Zamu yako' : 'Your shift')}
      >
        <RolePanel onClose={() => setRoleOpen(false)} />
      </Sheet>
    </>
  );
}
