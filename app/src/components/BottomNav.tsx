import { NavLink } from 'react-router-dom';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';

export function BottomNav() {
  const { owner, L, lang } = useSettings();
  const { activeBusiness } = useData();
  const sw = lang === 'sw';
  const salon = activeBusiness?.type === 'barber';

  const items = salon
    ? [
        { to: '/home', icon: 'home', label: sw ? 'Leo' : 'Today' },
        ...(activeBusiness?.settings?.bookings_enabled ? [{ to: '/bookings', icon: 'calendar', label: sw ? 'Miadi' : 'Bookings' }] : []),
        { to: '/clients', icon: 'users', label: sw ? 'Wateja' : 'Clients' },
        { to: '/money', icon: owner ? 'wallet' : 'receipt', label: owner ? L.money : L.myEntries },
        ...(owner && !activeBusiness?.settings?.bookings_enabled ? [{ to: '/reports', icon: 'chart', label: L.reports }] : []),
        ...(owner ? [{ to: '/manage', icon: 'grid', label: L.manage }] : []),
      ]
    : owner
    ? [
        { to: '/home', icon: 'home', label: L.home },
        { to: '/stock', icon: 'box', label: L.stock },
        { to: '/money', icon: 'wallet', label: L.money },
        { to: '/reports', icon: 'chart', label: L.reports },
        { to: '/manage', icon: 'grid', label: L.manage },
      ]
    : [
        { to: '/home', icon: 'home', label: L.home },
        { to: '/stock', icon: 'box', label: L.stock },
        { to: '/close', icon: 'check', label: L.closeDay },
        { to: '/money', icon: 'receipt', label: L.myEntries },
      ];

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className="nav-item"
            style={({ isActive }) => ({
              background: isActive ? 'var(--brandSoft)' : 'transparent',
              color: isActive ? 'var(--brand)' : 'var(--ink3)',
            })}
          >
            <Icon name={it.icon} size={19} />
            <span>{it.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
