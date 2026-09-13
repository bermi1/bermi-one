import { NavLink } from 'react-router-dom';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';

export function Sidebar() {
  const { owner, L } = useSettings();
  const { activeBusiness } = useData();

  const items = owner
    ? [
        { to: '/home', icon: 'home', label: L.home },
        { to: '/stock', icon: 'box', label: L.stock },
        { to: '/money', icon: 'wallet', label: L.money },
        { to: '/reports', icon: 'chart', label: L.reports },
        { to: '/ai', icon: 'spark', label: L.bermiAI },
        { to: '/manage', icon: 'grid', label: L.manage },
      ]
    : [
        { to: '/home', icon: 'home', label: L.home },
        { to: '/stock', icon: 'box', label: L.stock },
        { to: '/close', icon: 'check', label: L.closeDay },
        { to: '/money', icon: 'receipt', label: L.myEntries },
      ];

  return (
    <aside className="sidebar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 22px' }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--grad)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>B</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeBusiness?.name || 'Bermi One'}</div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>{L.tagline}</div>
        </div>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className="sidebar-item"
            style={({ isActive }) => ({
              background: isActive ? 'var(--brandSoft)' : 'transparent',
              color: isActive ? 'var(--brand)' : 'var(--ink2)',
            })}
          >
            <Icon name={it.icon} size={18} />
            <span>{it.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
