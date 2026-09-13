import { useEffect, useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData, type BusinessSummary } from '../state/DataContext';
import { soldOf } from '../lib/calc';
import { tintVars } from '../lib/types';

const PERIODS = [7, 30, 90];

export function Reports() {
  const { L, fmt, short, lang } = useSettings();
  const { products, session, ledger, businesses, activeBusiness, fetchPortfolioSummary } = useData();
  const [mode, setMode] = useState<'business' | 'products' | 'portfolio'>('business');
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
  const losses = useMemo(() => inPeriod.filter((e) => e.kind === 'loss').reduce((s, e) => s + Math.abs(e.amount), 0), [inPeriod]);
  const staffDebt = useMemo(() => inPeriod.filter((e) => e.kind === 'debt').reduce((s, e) => s + Math.abs(e.amount), 0), [inPeriod]);
  const draws = useMemo(() => inPeriod.filter((e) => e.kind === 'withdrawal').reduce((s, e) => s + Math.abs(e.amount), 0), [inPeriod]);
  const cogs = Math.round(revenue * 0.6);
  const gross = revenue - cogs;
  const net = gross - opex - losses;

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) + '%' : '—');

  const pnlRows = [
    { label: L.revenue, value: fmt(revenue) },
    { label: '− ' + L.costOfSales, value: fmt(cogs) },
    { label: '= ' + L.grossProfit, value: fmt(gross), big: true },
    { label: '− ' + L.opex, value: fmt(opex) },
    ...(losses > 0 ? [{ label: '− ' + L.losses, value: fmt(losses) }] : []),
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

  const [portfolio, setPortfolio] = useState<BusinessSummary[] | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const canCombine = businesses.length > 1;
  const mixedCurrencies = useMemo(() => new Set(businesses.map((b) => b.country_code)).size > 1, [businesses]);

  useEffect(() => {
    if (mode !== 'portfolio' || !canCombine) return;
    let cancelled = false;
    setPortfolioLoading(true);
    fetchPortfolioSummary(period).then((rows) => {
      if (!cancelled) {
        setPortfolio(rows);
        setPortfolioLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mode, period, canCombine, fetchPortfolioSummary]);

  const periodLabel = `${period} ${lang === 'sw' ? 'siku' : 'days'}`;

  function shareToWhatsapp() {
    let text: string;
    if (mode === 'portfolio' && portfolio) {
      const totalRevenue = portfolio.reduce((s, b) => s + b.revenue, 0);
      const totalNet = portfolio.reduce((s, b) => s + b.net, 0);
      const totalDebt = portfolio.reduce((s, b) => s + b.debt, 0);
      const lines = portfolio.map((b) => `• ${b.business.name}: ${L.revenue} ${fmt(b.revenue)} · ${L.netProfit} ${fmt(b.net)}`);
      text = `${L.portfolio} — ${periodLabel}\n\n${lines.join('\n')}\n\n${L.portfolioTotal}: ${L.revenue} ${fmt(totalRevenue)} · ${L.netProfit} ${fmt(totalNet)}`;
      if (totalDebt > 0) text += `\n${L.staffDebtOutstanding}: ${fmt(totalDebt)}`;
    } else {
      const lines = [
        `${activeBusiness?.name || L.appName} — ${periodLabel}`,
        '',
        `${L.revenue}: ${fmt(revenue)}`,
        `${L.costOfSales}: ${fmt(cogs)}`,
        `${L.grossProfit}: ${fmt(gross)}`,
        `${L.opex}: ${fmt(opex)}`,
      ];
      if (losses > 0) lines.push(`${L.losses}: ${fmt(losses)}`);
      lines.push(`${L.netProfit}: ${fmt(net)}`);
      if (staffDebt > 0) lines.push(`${L.staffDebtOutstanding}: ${fmt(staffDebt)}`);
      text = lines.join('\n');
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  const modeTabs: { id: 'business' | 'products' | 'portfolio'; label: string }[] = [
    { id: 'business', label: L.wholeBusiness },
    { id: 'products', label: L.perProduct },
    ...(canCombine ? [{ id: 'portfolio' as const, label: L.allBusinesses }] : []),
  ];

  return (
    <div className="screen sb">
      <ScreenHeader title={L.reports} sub={L.reportsSub} />

      <div style={{ display: 'flex', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 4, marginBottom: 16 }}>
        {modeTabs.map((t) => (
          <button
            key={t.id}
            className="tap"
            onClick={() => setMode(t.id)}
            style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: mode === t.id ? 'var(--card2)' : 'transparent', color: mode === t.id ? 'var(--ink)' : 'var(--ink3)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === 'business' && (
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

          <div className="card" style={{ padding: 18, marginBottom: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 10 }}>{L.incomeStatement}</div>
            {pnlRows.map((r, i) => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: r.big ? 15 : 13.5, borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ color: 'var(--ink2)', fontWeight: r.big ? 800 : 600 }}>{r.label}</span>
                <span style={{ fontWeight: 800, color: r.color || 'var(--ink)' }}>{r.value}</span>
              </div>
            ))}
            {staffDebt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', marginTop: 4, borderTop: '1px solid var(--line)', fontSize: 13.5 }}>
                <span style={{ color: 'var(--ink2)', fontWeight: 600 }}>{L.staffDebtOutstanding}</span>
                <span style={{ fontWeight: 800, color: 'var(--warn)' }}>{fmt(staffDebt)}</span>
              </div>
            )}
          </div>

          <button className="btn-ghost tap" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={shareToWhatsapp}>
            <Icon name="share" size={15} />
            {L.shareWhatsapp}
          </button>
        </>
      )}

      {mode === 'products' && (
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

      {mode === 'portfolio' && (
        <>
          {!canCombine ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>{L.needMoreBusinesses}</div>
          ) : (
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

              {portfolioLoading || !portfolio ? (
                <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>{L.loading}</div>
              ) : (
                <>
                  {mixedCurrencies && (
                    <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginBottom: 10 }}>
                      {lang === 'sw' ? 'Kumbuka: biashara zako ziko katika nchi tofauti — kiasi hapa hakijabadilishwa sarafu.' : 'Note: your businesses are in different countries — amounts here are not currency-converted.'}
                    </div>
                  )}
                  <div className="card" style={{ padding: 18, marginBottom: 16 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 10 }}>{L.portfolioTotal}</div>
                    {[
                      { label: L.revenue, value: fmt(portfolio.reduce((s, b) => s + b.revenue, 0)) },
                      { label: '− ' + L.opex, value: fmt(portfolio.reduce((s, b) => s + b.opex, 0)) },
                      ...(portfolio.some((b) => b.losses > 0) ? [{ label: '− ' + L.losses, value: fmt(portfolio.reduce((s, b) => s + b.losses, 0)) }] : []),
                      { label: '= ' + L.netProfit, value: fmt(portfolio.reduce((s, b) => s + b.net, 0)), big: true, color: 'var(--ok)' },
                    ].map((r, i) => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: r.big ? 15 : 13.5, borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                        <span style={{ color: 'var(--ink2)', fontWeight: r.big ? 800 : 600 }}>{r.label}</span>
                        <span style={{ fontWeight: 800, color: r.color || 'var(--ink)' }}>{r.value}</span>
                      </div>
                    ))}
                    {portfolio.some((b) => b.debt > 0) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', marginTop: 4, borderTop: '1px solid var(--line)', fontSize: 13.5 }}>
                        <span style={{ color: 'var(--ink2)', fontWeight: 600 }}>{L.staffDebtOutstanding}</span>
                        <span style={{ fontWeight: 800, color: 'var(--warn)' }}>{fmt(portfolio.reduce((s, b) => s + b.debt, 0))}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>{L.perBusiness}</div>
                  <div className="card" style={{ padding: 6, marginBottom: 16 }}>
                    {portfolio.map((b, i) => (
                      <div key={b.business.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px', borderBottom: i === portfolio.length - 1 ? 'none' : '1px solid var(--line)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{b.business.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>{L.revenue} {short(b.revenue)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: b.net >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{short(b.net)}</div>
                          {b.debt > 0 && <div style={{ fontSize: 10.5, color: 'var(--warn)', fontWeight: 700 }}>{L.staffDebtOutstanding.split(' ')[0]} {short(b.debt)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button className="btn-ghost tap" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={shareToWhatsapp}>
                    <Icon name="share" size={15} />
                    {L.shareWhatsapp}
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
