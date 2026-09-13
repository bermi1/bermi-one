import { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { soldOf } from '../lib/calc';
import { tintVars } from '../lib/types';

const PERIODS = [7, 30, 90];

export function Reports() {
  const { L, fmt, short, lang } = useSettings();
  const { products, session, ledger } = useData();
  const [mode, setMode] = useState<'business' | 'products'>('business');
  const [periodIx, setPeriodIx] = useState(0);
  const period = PERIODS[periodIx];
  const counts = session?.counts || {};

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - period);
    return d.toISOString();
  }, [period]);

  const inPeriod = useMemo(() => ledger.filter((e) => e.created_at >= cutoff), [ledger, cutoff]);
  const revenue = useMemo(() => inPeriod.filter((e) => e.kind === 'sale' || e.kind === 'payment').reduce((s, e) => s + e.amount, 0), [inPeriod]);
  const opex = useMemo(() => inPeriod.filter((e) => e.kind === 'expense').reduce((s, e) => s + Math.abs(e.amount), 0), [inPeriod]);
  const draws = useMemo(() => inPeriod.filter((e) => e.kind === 'withdrawal').reduce((s, e) => s + Math.abs(e.amount), 0), [inPeriod]);
  const cogs = Math.round(revenue * 0.6);
  const gross = revenue - cogs;
  const net = gross - opex;

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) + '%' : '—');

  const pnlRows = [
    { label: L.revenue, value: fmt(revenue) },
    { label: '− ' + L.costOfSales, value: fmt(cogs) },
    { label: '= ' + L.grossProfit, value: fmt(gross), big: true },
    { label: '− ' + L.opex, value: fmt(opex) },
    { label: '= ' + L.netProfit, value: fmt(net), color: net >= 0 ? 'var(--ok)' : 'var(--bad)', big: true },
    { label: L.withdrawals, value: fmt(draws) },
  ];

  const productAnalysis = useMemo(
    () =>
      products
        .map((p) => {
          const units = soldOf(p, counts);
          const rev = units * p.price;
          const cost = units * p.cost;
          const profit = rev - cost;
          return { p, units, rev, profit, costW: rev ? Math.round((cost / rev) * 100) : 0, profitW: rev ? Math.round((profit / rev) * 100) : 0 };
        })
        .sort((a, b) => b.units - a.units),
    [products, counts],
  );

  return (
    <div className="screen sb">
      <ScreenHeader title={L.reports} sub={L.reportsSub} />

      <div style={{ display: 'flex', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 4, marginBottom: 16 }}>
        <button className="tap" onClick={() => setMode('business')} style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: mode === 'business' ? 'var(--card2)' : 'transparent', color: mode === 'business' ? 'var(--ink)' : 'var(--ink3)' }}>
          {L.wholeBusiness}
        </button>
        <button className="tap" onClick={() => setMode('products')} style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: mode === 'products' ? 'var(--card2)' : 'transparent', color: mode === 'products' ? 'var(--ink)' : 'var(--ink3)' }}>
          {L.perProduct}
        </button>
      </div>

      {mode === 'business' ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {PERIODS.map((p, i) => (
              <button
                key={p}
                className="tap"
                onClick={() => setPeriodIx(i)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 12, fontSize: 12.5, fontWeight: 700, background: periodIx === i ? 'var(--brand)' : 'var(--card)', color: periodIx === i ? 'var(--brandInk)' : 'var(--ink2)', border: '1px solid var(--line)' }}
              >
                {p} {lang === 'sw' ? 'siku' : 'days'}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: L.grossMargin, value: pct(gross, revenue), color: 'var(--ok)' },
              { label: L.netMargin, value: pct(net, revenue), color: 'var(--brand)' },
              { label: L.expenseRatio, value: pct(opex, revenue), color: 'var(--warn)' },
            ].map((r) => (
              <div key={r.label} className="card" style={{ padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: r.color }}>{r.value}</div>
                <div style={{ marginTop: 3, fontSize: 10, color: 'var(--ink3)', fontWeight: 700 }}>{r.label}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 10 }}>{L.incomeStatement}</div>
            {pnlRows.map((r, i) => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: r.big ? 15 : 13.5, borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ color: 'var(--ink2)', fontWeight: r.big ? 800 : 600 }}>{r.label}</span>
                <span style={{ fontWeight: 800, color: r.color || 'var(--ink)' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: 6 }}>
          {productAnalysis.map(({ p, units, rev, profit, costW, profitW }, i) => {
            const tv = tintVars(i);
            return (
              <div key={p.id} style={{ padding: '12px 10px', borderBottom: i === productAnalysis.length - 1 ? 'none' : '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 10, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon name={p.icon} size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>{units} {L.unitsSold}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{short(rev)}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: profit >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{short(profit)}</div>
                  </div>
                </div>
                {rev > 0 && (
                  <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: 'var(--card2)' }}>
                    <div style={{ width: `${costW}%`, background: 'var(--ink3)' }} />
                    <div style={{ width: `${profitW}%`, background: 'var(--ok)' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
