import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { bizMeta } from '../lib/types';
import { BusinessSwitchSheet } from './BusinessSwitchSheet';
import { Sheet } from './Sheet';
import { RolePanel } from './StaffAccess';

/**
 * The desktop rail.
 *
 * On a computer the phone's top bar and bottom tabs give way to this: the
 * business switcher, every destination at once, and who is at the keyboard —
 * the things a phone hides behind taps because it has no room, and a desk has.
 */
export function Sidebar() {
  const { owner, L, lang, theme } = useSettings();
  const { activeBusiness, activeStaff, setTheme, plan, onTrial, trialDays } = useData();
  const nav = useNavigate();
  const sw = lang === 'sw';
  const [switching, setSwitching] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const meta = activeBusiness ? bizMeta(activeBusiness.type) : null;

  const groups: { title: string; items: { to: string; icon: string; label: string }[] }[] = owner
    ? [
        {
          title: sw ? 'Kazi' : 'Work',
          items: [
            { to: '/home', icon: 'home', label: L.home },
            { to: '/stock', icon: 'box', label: L.stock },
            { to: '/close', icon: 'check', label: L.closeDay },
            { to: '/money', icon: 'wallet', label: L.money },
            { to: '/reports', icon: 'chart', label: L.reports },
            { to: '/ai', icon: 'spark', label: L.bermiAI },
          ],
        },
        {
          title: sw ? 'Biashara' : 'Business',
          items: [
            { to: '/manage', icon: 'grid', label: L.manage },
            { to: '/staff', icon: 'user', label: L.staffCount },
            { to: '/business', icon: 'building', label: L.businessProfile },
          ],
        },
        {
          title: sw ? 'Akaunti' : 'Account',
          items: [
            { to: '/pricing', icon: 'receipt', label: sw ? 'Kifurushi na malipo' : 'Plan & billing' },
            { to: '/help', icon: 'info', label: L.getHelp },
          ],
        },
      ]
    : [
        {
          title: sw ? 'Zamu' : 'Shift',
          items: [
            { to: '/home', icon: 'home', label: L.home },
            { to: '/stock', icon: 'box', label: L.stock },
            { to: '/close', icon: 'check', label: L.closeDay },
            { to: '/money', icon: 'receipt', label: L.myEntries },
          ],
        },
      ];

  const who = owner ? (sw ? 'Mmiliki' : 'Owner') : (activeStaff?.name || (sw ? 'Mfanyakazi' : 'Staff'));

  return (
    <aside className="sidebar">
      <button className="side-biz" onClick={() => setSwitching(true)} title={sw ? 'Badili biashara' : 'Switch business'}>
        {meta ? (
          <span className="side-biz-mark"><Icon name={meta.icon} size={17} /></span>
        ) : (
          <img src="/icons/bermi-mark.svg" alt="" width={38} height={38} />
        )}
        <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
          <span className="side-biz-name">{activeBusiness?.name || 'Bermi One'}</span>
          <span className="side-biz-sub">{L.tagline}</span>
        </span>
        <Icon name="down" size={14} style={{ color: 'var(--ink3)', flexShrink: 0 }} />
      </button>

      <nav className="side-nav">
        {groups.map((g) => (
          <div key={g.title} className="side-group">
            <div className="side-group-title">{g.title}</div>
            {g.items.map((it) => (
              <NavLink key={it.to} to={it.to} className="sidebar-item">
                <Icon name={it.icon} size={18} />
                <span>{it.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="side-foot">
        {owner && (
          <button className="side-plan" onClick={() => nav('/pricing')}>
            <Icon name="spark" size={14} />
            <span style={{ flex: 1, textAlign: 'left' }}>
              {onTrial
                ? (trialDays > 0 ? (sw ? `Majaribio · siku ${trialDays}` : `Trial · ${trialDays} ${trialDays === 1 ? 'day' : 'days'} left`) : (sw ? 'Majaribio yamekwisha' : 'Trial ended'))
                : plan.name}
            </span>
            <Icon name="right" size={13} />
          </button>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="side-role" onClick={() => setRoleOpen(true)} title={owner ? (sw ? 'Mpe mfanyakazi kifaa' : 'Hand this device to staff') : (sw ? 'Zamu yako' : 'Your shift')}>
            <span className="side-avatar">{who.slice(0, 1).toUpperCase()}</span>
            <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
              <span className="side-role-name">{who}</span>
              <span className="side-role-sub">{owner ? (sw ? 'Badili kwa mfanyakazi' : 'Switch to staff') : (sw ? 'Toka kwenye zamu' : 'End shift')}</span>
            </span>
          </button>
          <button className="icon-btn tap" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Toggle theme" title={theme === 'light' ? (sw ? 'Hali ya giza' : 'Dark mode') : (sw ? 'Hali ya mwanga' : 'Light mode')}>
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} />
          </button>
        </div>
      </div>

      <BusinessSwitchSheet open={switching} onClose={() => setSwitching(false)} />
      <Sheet open={roleOpen} onClose={() => setRoleOpen(false)} title={owner ? (sw ? 'Mpe mfanyakazi kifaa' : 'Hand this device to staff') : (sw ? 'Zamu yako' : 'Your shift')}>
        <RolePanel onClose={() => setRoleOpen(false)} />
      </Sheet>
    </aside>
  );
}
