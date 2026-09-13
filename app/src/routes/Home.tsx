import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { cogsOf, currentQty, expectedSales, isCounted, stockValueOf } from '../lib/calc';
import { tintVars } from '../lib/types';
import { topInsight } from '../ontology/insights';

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function Home() {
  const nav = useNavigate();
  const { L, fmt, short, lang } = useSettings();
  const { products, session, ledger, accounts, actionLog, displayName } = useData();

  const counts = session?.counts || {};
  const counted = isCounted(counts);
  const expected = expectedSales(products, counts);
  const cogs = cogsOf(products, counts);

  const todayKey = dayKey(new Date());
  const todayEntries = useMemo(() => ledger.filter((e) => e.created_at.slice(0, 10) === todayKey), [ledger, todayKey]);
  const opexToday = useMemo(() => todayEntries.filter((e) => e.kind === 'expense').reduce((s, e) => s + Math.abs(e.amount), 0), [todayEntries]);
  const ledgerSalesToday = useMemo(() => todayEntries.filter((e) => e.kind === 'sale').reduce((s, e) => s + e.amount, 0), [todayEntries]);

  const revenue = counted ? expected : ledgerSalesToday;
  const cogsV = counted ? cogs : Math.round(revenue * 0.6);
  const profit = revenue - cogsV - opexToday;

  const stockValue = stockValueOf(products, counts);
  const lowItems = useMemo(() => products.filter((p) => currentQty(p, counts) < p.low), [products, counts]);
  const insight = useMemo(() => topInsight({ products, counts, accounts, actionLog, lang }), [products, counts, accounts, actionLog, lang]);

  const weekBars = useMemo(() => {
    const days: { key: string; label: string; total: number }[] = [];
    const labels = lang === 'sw' ? ['Jpi', 'Jtt', 'Jnn', 'Jtn', 'Alh', 'Iju', 'Jmo'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ key: dayKey(d), label: labels[d.getDay()], total: 0 });
    }
    for (const e of ledger) {
      if (e.kind !== 'sale') continue;
      const k = e.created_at.slice(0, 10);
      const row = days.find((d) => d.key === k);
      if (row) row.total += e.amount;
    }
    const mx = Math.max(1, ...days.map((d) => d.total));
    return days.map((d) => ({ ...d, h: Math.max(4, Math.round((d.total / mx) * 56)) }));
  }, [ledger, lang]);

  let alertText = '';
  let alertGo = '/close';
  if (!session || session.status === 'open') {
    alertText = counted
      ? lang === 'sw' ? 'Bidhaa zimehesabiwa lakini hazijafungwa.' : 'Stock counted but the day is not closed.'
      : lang === 'sw' ? 'Bidhaa za leo hazijahesabiwa.' : "Today's stock hasn't been counted.";
    alertGo = '/close';
  } else if (session.status === 'submitted') {
    alertText = lang === 'sw' ? 'Kufunga kunasubiri idhini yako.' : 'A closing is waiting for your approval.';
    alertGo = '/approval';
  } else {
    alertText = lang === 'sw' ? 'Siku imefungwa na kuthibitishwa.' : 'Today is verified and locked.';
    alertGo = '/reports';
  }

  const quickActions = [
    { label: L.closeDay, icon: 'check', go: '/close', tint: 0 },
    { label: L.stock, icon: 'box', go: '/stock', tint: 1 },
    { label: L.money, icon: 'wallet', go: '/money', tint: 2 },
    { label: L.askBermi, icon: 'spark', go: '/ai', tint: 3 },
  ];

  return (
    <div className="screen sb">
      <AppHeader />
      <div style={{ fontSize: 13.5, color: 'var(--ink2)', fontWeight: 600, marginTop: 6 }}>
        {lang === 'sw' ? 'Habari za asubuhi' : 'Good morning'}, {displayName}
      </div>

      <div style={{ marginTop: 14, borderRadius: 26, background: 'var(--grad)', padding: 22, boxShadow: '0 20px 44px rgba(47,91,255,.3)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.1)', top: -60, right: -50 }} />
        <div style={{ display: 'flex', gap: 24, position: 'relative' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,.75)' }}>{L.salesToday}</div>
            <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: -0.6 }}>{fmt(revenue)}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,.75)' }}>{L.profit}</div>
            <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: -0.6 }}>{fmt(profit)}</div>
          </div>
        </div>
      </div>

      <div className="card tap" onClick={() => nav(alertGo)} style={{ marginTop: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--warnSoft)', color: 'var(--warn)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name="alert" size={16} />
        </div>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{alertText}</div>
        <Icon name="right" size={16} style={{ color: 'var(--ink3)' }} />
      </div>

      {insight && (
        <div
          className="card tap"
          onClick={() => nav('/ai')}
          style={{
            marginTop: 10,
            padding: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: insight.tone === 'warn' ? 'var(--warnSoft)' : insight.tone === 'good' ? 'var(--okSoft)' : 'var(--brandSoft)',
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              background: 'rgba(255,255,255,.5)',
              color: insight.tone === 'warn' ? 'var(--warn)' : insight.tone === 'good' ? 'var(--ok)' : 'var(--brand)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="spark" size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {lang === 'sw' ? 'Bermi imegundua' : 'Bermi noticed'}
            </div>
            <div style={{ marginTop: 2, fontSize: 13, fontWeight: 700 }}>{insight.text}</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 18, fontSize: 13, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{L.quickActions}</div>
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {quickActions.map((a) => {
          const tv = tintVars(a.tint);
          return (
            <div key={a.label} className="card tap" onClick={() => nav(a.go)} style={{ padding: '14px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 11, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center' }}>
                <Icon name={a.icon} size={16} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, textAlign: 'center' }}>{a.label}</div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 16, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800 }}>{L.last7}</div>
          <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>{L.sales}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 64 }}>
          {weekBars.map((b) => (
            <div key={b.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: '100%', height: b.h, borderRadius: 6, background: b.key === todayKey ? 'var(--brand)' : 'var(--brandSoft)' }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink3)' }}>{b.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="card tap" onClick={() => nav('/stock')} style={{ padding: 16 }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{L.stockValue}</div>
          <div style={{ marginTop: 5, fontSize: 18, fontWeight: 800 }}>{short(stockValue)}</div>
          {lowItems.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--warn)' }}>
              {lowItems.length} {L.lowStock}
            </div>
          )}
        </div>
        <div className="card tap" onClick={() => nav('/money')} style={{ padding: 16 }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{L.expenses}</div>
          <div style={{ marginTop: 5, fontSize: 18, fontWeight: 800 }}>{fmt(opexToday)}</div>
          <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--ink3)' }}>{L.today}</div>
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
    </div>
  );
}
