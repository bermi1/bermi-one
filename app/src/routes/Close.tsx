import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { expectedSales, soldOf } from '../lib/calc';
import { tintVars } from '../lib/types';

export function Close() {
  const nav = useNavigate();
  const { L, fmt, short, owner } = useSettings();
  const { products, session, setClosingCount, setSessionMoney } = useData();
  const counts = session?.counts || {};
  const locked = session?.status === 'approved' || (session?.status === 'submitted' && !owner);

  const expected = expectedSales(products, counts);
  const soldUnits = products.reduce((s, p) => s + soldOf(p, counts), 0);

  const moneyFields: { key: 'cash' | 'mobile' | 'bank_in' | 'expenses_paid'; label: string; icon: string }[] = [
    { key: 'cash', label: L.cash, icon: 'cash' },
    { key: 'mobile', label: L.mobileMoney, icon: 'phone' },
    { key: 'bank_in', label: L.bank, icon: 'bank' },
    { key: 'expenses_paid', label: L.expenses, icon: 'receipt' },
  ];

  return (
    <div className="screen sb">
      <ScreenHeader title={L.closeToday} sub={L.closeSub} />

      <div className="card" style={{ padding: 6, marginBottom: 16 }}>
        {products.map((p, i) => {
          const tv = tintVars(i);
          const sold = soldOf(p, counts);
          const val = sold * p.price;
          const avail = p.opening + p.added;
          const closingVal = counts[p.id];
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 8px', borderBottom: i === products.length - 1 ? 'none' : '1px solid var(--line)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name={p.icon} size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>
                  {L.open} {avail} {p.unit}
                </div>
              </div>
              <input
                inputMode="numeric"
                placeholder="—"
                disabled={locked}
                value={closingVal === undefined ? '' : String(closingVal)}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  void setClosingCount(p.id, v === '' ? null : Number(v));
                }}
                style={{ width: 54, textAlign: 'center', padding: '8px 0', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card2)', fontSize: 14, fontWeight: 700 }}
              />
              <div style={{ width: 66, textAlign: 'right', fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>{short(val)}</div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{soldUnits} {L.unitsSold}</div>
          <div style={{ marginTop: 3, fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>{L.sold}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{fmt(expected)}</div>
          <div style={{ marginTop: 3, fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>{L.sales}</div>
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>{L.moneyCollected}</div>
      <div className="card" style={{ padding: 6, marginBottom: 20 }}>
        {moneyFields.map((f, i) => (
          <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 10px', borderBottom: i === moneyFields.length - 1 ? 'none' : '1px solid var(--line)' }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--card2)', color: 'var(--ink2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon name={f.icon} size={14} />
            </div>
            <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{f.label}</div>
            <input
              inputMode="numeric"
              placeholder="0"
              disabled={locked}
              value={session?.[f.key] || ''}
              onChange={(e) => void setSessionMoney(f.key, Number(e.target.value.replace(/[^0-9]/g, '') || 0))}
              style={{ width: 110, textAlign: 'right', padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card2)', fontSize: 14, fontWeight: 700 }}
            />
          </div>
        ))}
      </div>

      {!locked && (
        <button className="btn-primary tap" style={{ width: '100%' }} onClick={() => nav('/diff')}>
          {L.continue}
        </button>
      )}
    </div>
  );
}
