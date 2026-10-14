import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { closingDayLabel, useData } from '../state/DataContext';
import { businessDayIso, currentQty, stockValueOf } from '../lib/calc';
import { tintVars } from '../lib/types';

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function Home() {
  const nav = useNavigate();
  const { L, fmt, fmt0, short, lang } = useSettings();
  const { products, session, recentClosings, displayName, trialDays, onTrial } = useData();

  const counts = session?.counts || {};

  /*
    Money on the dashboard comes from verified closings only, filed under the
    day the stock was for — never from a count still in progress, and never
    from the day somebody happened to verify it.
  */
  const today = businessDayIso();
  const todayKey = dayKey(new Date());
  const latest = recentClosings[0] || null;
  const revenue = Number(latest?.total_calculated_sales || 0);
  const profit = Number(latest?.total_calculated_profit || 0);
  const heroDay = !latest ? '' : latest.session_date === today ? (lang === 'sw' ? 'Leo' : 'Today') : closingDayLabel(latest.session_date);
  const salesLabel = latest ? `${L.sales} · ${heroDay}` : L.salesToday;
  const profitLabel = latest ? `${L.profit} · ${heroDay}` : L.profit;
  const latestExpenses = (latest?.closing_items || []).filter((i) => i.kind === 'expense').reduce((n, i) => n + Number(i.amount || 0), 0);
  const waiting = session?.status === 'submitted' ? session.session_date : null;

  const stockValue = stockValueOf(products, counts);
  const lowItems = useMemo(() => products.filter((p) => currentQty(p, counts) < p.low), [products, counts]);

  const weekBars = useMemo(() => {
    const days: { key: string; label: string; total: number }[] = [];
    const labels = lang === 'sw' ? ['Jpi', 'Jtt', 'Jnn', 'Jtn', 'Alh', 'Iju', 'Jmo'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ key: dayKey(d), label: labels[d.getDay()], total: 0 });
    }
    for (const c of recentClosings) {
      const row = days.find((d) => d.key === c.session_date);
      if (row) row.total += Number(c.total_calculated_sales || 0);
    }
    const mx = Math.max(1, ...days.map((d) => d.total));
    return days.map((d) => ({ ...d, h: Math.max(4, Math.round((d.total / mx) * 56)) }));
  }, [recentClosings, lang]);

  let alertText = '';
  let alertGo = '/close';
  if (!session || session.status === 'open') {
    alertText = Object.keys(counts).length > 0
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
    <div className="screen sb desk-wide">
      <AppHeader />
      <div className="home-greet" style={{ fontSize: 13.5, color: 'var(--ink2)', fontWeight: 600, marginTop: 6 }}>
        {lang === 'sw' ? 'Habari za asubuhi' : 'Good morning'}, {displayName}
      </div>

      <div className="desk">
      <div className="desk-main">
      <div style={{ marginTop: 14, borderRadius: 26, background: 'var(--grad)', padding: 22, boxShadow: '0 20px 44px rgba(47,91,255,.3)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.1)', top: -60, right: -50 }} />
        <div style={{ display: 'flex', gap: 24, position: 'relative' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,.75)' }}>{salesLabel}</div>
            <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: -0.6 }}>{revenue ? fmt(revenue) : '—'}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,.75)' }}>{profitLabel}</div>
            <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: -0.6 }}>{profit ? fmt(profit) : '—'}</div>
          </div>
        </div>
        {(waiting || !latest) && (
          <div style={{ position: 'relative', marginTop: 12, fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>
            {waiting
              ? (lang === 'sw' ? `${closingDayLabel(waiting)} inasubiri uhakiki — haijajumuishwa bado.` : `${closingDayLabel(waiting)} is waiting for you to verify — not included yet.`)
              : (lang === 'sw' ? 'Mauzo yanaonekana hapa kufunga kukishahakikiwa.' : 'Sales show here once a closing is verified.')}
          </div>
        )}
      </div>

      {onTrial && trialDays <= 7 && (
        <div
          className="card tap"
          onClick={() => nav('/pricing')}
          style={{ marginTop: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12, background: trialDays <= 3 ? 'var(--warnSoft)' : 'var(--brandSoft)' }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 11, background: 'rgba(255,255,255,.55)', color: trialDays <= 3 ? 'var(--warn)' : 'var(--brand)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="spark" size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>
              {trialDays > 0 ? `${trialDays} ${L.trialEndsIn}` : L.trialEnded}
            </div>
            <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--ink2)' }}>{L.choosePlan}</div>
          </div>
          <Icon name="right" size={16} style={{ color: 'var(--ink3)' }} />
        </div>
      )}

      <div className="card tap" onClick={() => nav(alertGo)} style={{ marginTop: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--warnSoft)', color: 'var(--warn)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name="alert" size={16} />
        </div>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{alertText}</div>
        <Icon name="right" size={16} style={{ color: 'var(--ink3)' }} />
      </div>

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

      </div>

      <aside className="desk-side">
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="card tap" onClick={() => nav('/stock')} style={{ padding: 16 }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{L.stockValue}</div>
          <div style={{ marginTop: 5, fontSize: 18, fontWeight: 800 }}>{stockValue ? short(stockValue) : '—'}</div>
          {lowItems.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--warn)' }}>
              {lowItems.length} {L.lowStock}
            </div>
          )}
        </div>
        <div className="card tap" onClick={() => nav('/money')} style={{ padding: 16 }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{L.expenses}</div>
          <div style={{ marginTop: 5, fontSize: 18, fontWeight: 800 }}>{fmt0(latestExpenses)}</div>
          <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--ink3)' }}>{latest ? heroDay : '—'}</div>
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
      </aside>
      </div>
    </div>
  );
}
