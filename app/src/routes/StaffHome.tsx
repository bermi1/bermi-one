import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { currentQty } from '../lib/calc';
import { tintVars } from '../lib/types';

export function StaffHome() {
  const nav = useNavigate();
  const { L, lang } = useSettings();
  const { products, session, displayName } = useData();
  const counts = session?.counts || {};

  const status = session?.status || 'open';
  const taskTitle = status === 'verified' ? L.closed : L.closeToday;
  const taskSub =
    status === 'submitted'
      ? lang === 'sw' ? 'Imewasilishwa. Subiri idhini.' : 'Submitted. Waiting for the owner.'
      : status === 'verified'
      ? L.closedNote
      : lang === 'sw' ? 'Hesabu zilizobaki kisha wasilisha.' : 'Count what is left, then submit for review.';

  const lowItems = products.filter((p) => currentQty(p, counts) < p.low);

  return (
    <div className="screen sb">
      <AppHeader />
      <div style={{ fontSize: 13.5, color: 'var(--ink2)', fontWeight: 600, marginTop: 6 }}>
        {L.onShift} · {displayName}
      </div>

      <div
        className="card tap"
        onClick={() => nav(status === 'verified' ? '/home' : '/close')}
        style={{ marginTop: 16, padding: 20, borderRadius: 24, background: status === 'verified' ? 'var(--okSoft)' : 'var(--grad)' }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: status === 'verified' ? 'var(--ok)' : 'rgba(255,255,255,.8)' }}>{L.todaysWork}</div>
        <div style={{ marginTop: 6, fontSize: 21, fontWeight: 800, color: status === 'verified' ? 'var(--ok)' : '#fff' }}>{taskTitle}</div>
        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: status === 'verified' ? 'var(--ink2)' : 'rgba(255,255,255,.85)' }}>{taskSub}</div>
      </div>

      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="card tap" onClick={() => nav('/stock')} style={{ padding: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 11, background: 'var(--brandSoft)', color: 'var(--brand)', display: 'grid', placeItems: 'center', marginBottom: 10 }}>
            <Icon name="box" size={16} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{L.myStock}</div>
          <div style={{ marginTop: 2, fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>{products.length} {L.products}</div>
        </div>
        <div className="card tap" onClick={() => nav('/money')} style={{ padding: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 11, background: 'var(--vioSoft)', color: 'var(--vio)', display: 'grid', placeItems: 'center', marginBottom: 10 }}>
            <Icon name="receipt" size={16} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{L.myEntries}</div>
        </div>
      </div>

      {lowItems.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>{L.lowStockItems}</div>
          <div className="card" style={{ padding: 6 }}>
            {lowItems.slice(0, 4).map((p, i) => {
              const tv = tintVars(i);
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 10, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon name={p.icon} size={14} />
                  </div>
                  <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--warn)' }}>{currentQty(p, counts)} {p.unit}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 18, fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.5, padding: '0 4px' }}>{L.staffNote}</div>
    </div>
  );
}
