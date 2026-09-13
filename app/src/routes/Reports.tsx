import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { soldOf } from '../lib/calc';
import { tintVars } from '../lib/types';
import { buildReport, highlightsOf, presetRange, type PresetId, type ReportData } from '../lib/reporting';
import { buildWhatsappSummary, openComprehensiveReport, openWhatsapp } from '../lib/reportDocs';

const PRESETS: PresetId[] = ['today', 'yesterday', 'last7', 'last30', 'thisMonth'];

export function Reports() {
  const { L, fmt, fmt0, short, lang } = useSettings();
  const { products, session, businesses, activeBusiness, fetchReportSource } = useData();
  const { flash } = useToast();

  const [mode, setMode] = useState<'business' | 'products'>('business');
  const [picked, setPicked] = useState<string[]>(() => (activeBusiness ? [activeBusiness.id] : []));
  const [preset, setPreset] = useState<PresetId>('last7');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [phone, setPhone] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const range = useMemo(
    () => (preset === 'custom' && customFrom && customTo ? { from: customFrom, to: customTo } : presetRange(preset)),
    [preset, customFrom, customTo],
  );

  const presetLabel: Record<PresetId, string> = {
    today: L.today, yesterday: L.yesterday, last7: L.last7days, last30: L.last30days,
    thisMonth: L.thisMonth, custom: L.customRange,
  };

  const run = useCallback(async () => {
    if (picked.length === 0) { setReport(null); return; }
    setLoading(true);
    const { sessions, ledger } = await fetchReportSource(picked, range.from, range.to);
    setReport(buildReport({
      businesses: businesses.filter((b) => picked.includes(b.id)),
      sessions, ledger, from: range.from, to: range.to,
    }));
    setLoading(false);
  }, [picked, range.from, range.to, fetchReportSource, businesses]);

  useEffect(() => { void run(); }, [run]);

  function toggleBusiness(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function downloadPdf() {
    if (!report) return;
    if (!openComprehensiveReport(report, lang)) flash(lang === 'sw' ? 'Ruhusu dirisha jipya' : 'Allow pop-ups');
  }

  function sendWhatsapp() {
    if (!report) return;
    openWhatsapp(buildWhatsappSummary(report, lang, fmt), phone);
  }

  const totals = report?.totals;
  const h = report ? highlightsOf(report) : null;
  const maxBar = report ? Math.max(1, ...report.days.map((d) => d.sales)) : 1;

  const counts = session?.counts || {};
  const productAnalysis = useMemo(
    () =>
      products
        .map((p) => {
          const units = soldOf(p, counts);
          const rev = units * p.price;
          const profit = units * p.profit;
          const rest = Math.max(0, rev - profit);
          return { p, units, rev, profit, costW: rev ? Math.round((rest / rev) * 100) : 0, profitW: rev ? Math.round((profit / rev) * 100) : 0 };
        })
        .sort((a, b) => b.units - a.units),
    [products, counts],
  );

  return (
    <div className="screen sb">
      <ScreenHeader title={L.reports} sub={L.reportsSub} />

      <div style={{ display: 'flex', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 4, marginBottom: 14 }}>
        {([['business', L.wholeBusiness], ['products', L.perProduct]] as const).map(([id, label]) => (
          <button
            key={id}
            className="tap"
            onClick={() => setMode(id)}
            style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: mode === id ? 'var(--card2)' : 'transparent', color: mode === id ? 'var(--ink)' : 'var(--ink3)' }}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'products' ? (
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
      ) : (
        <>
          {businesses.length > 1 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{L.businesses}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {businesses.map((b) => {
                  const on = picked.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      className="tap"
                      onClick={() => toggleBusiness(b.id)}
                      style={{ padding: '10px 12px', borderRadius: 12, fontSize: 12.5, fontWeight: 700, textAlign: 'left', background: on ? 'var(--brandSoft)' : 'var(--card)', color: on ? 'var(--brand)' : 'var(--ink2)', border: `1.5px solid ${on ? 'var(--brand)' : 'var(--line)'}` }}
                    >
                      {on ? '✓ ' : ''}{b.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{L.dateRange}</div>
          <div className="sb" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 10 }}>
            {PRESETS.map((p) => (
              <button
                key={p}
                className="tap"
                onClick={() => { setPreset(p); setCustomFrom(''); setCustomTo(''); }}
                style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 12, fontSize: 12.5, fontWeight: 700, background: preset === p ? 'var(--brand)' : 'var(--card)', color: preset === p ? 'var(--brandInk)' : 'var(--ink2)', border: '1px solid var(--line)' }}
              >
                {presetLabel[p]}
              </button>
            ))}
            <button
              className="tap"
              onClick={() => setPreset('custom')}
              style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 12, fontSize: 12.5, fontWeight: 700, background: preset === 'custom' ? 'var(--brand)' : 'var(--card)', color: preset === 'custom' ? 'var(--brandInk)' : 'var(--ink2)', border: '1px solid var(--line)' }}
            >
              {L.customRange}
            </button>
          </div>

          {preset === 'custom' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="card" style={{ padding: '11px 12px', border: 'none', fontSize: 13 }} />
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="card" style={{ padding: '11px 12px', border: 'none', fontSize: 13 }} />
            </div>
          )}

          {loading || !totals ? (
            <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>{L.loading}</div>
          ) : report && report.days.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ width: 46, height: 46, borderRadius: 15, margin: '0 auto 14px', background: 'var(--card2)', display: 'grid', placeItems: 'center', color: 'var(--ink3)' }}>
                <Icon name="chart" size={20} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{L.noVerifiedClosings}</div>
              <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink2)' }}>{L.noVerifiedClosingsSub}</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {[
                  { label: L.totalSales, value: fmt0(totals.sales), color: 'var(--ok)' },
                  { label: L.totalProfit, value: fmt0(totals.profit), color: 'var(--warn)' },
                  { label: L.cashPlusMobile, value: fmt0(totals.cash + totals.mobile), color: 'var(--brand)' },
                  { label: L.amountBanked, value: fmt0(totals.banked), color: 'var(--vio)' },
                ].map((k) => (
                  <div key={k.label} className="card" style={{ padding: 14 }}>
                    <div style={{ fontSize: 10.5, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{k.label}</div>
                    <div style={{ marginTop: 5, fontSize: 16, fontWeight: 800, color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {h && (
                <div className="card" style={{ padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--ink2)' }}>{L.keyHighlights}</div>
                  {[
                    { k: L.bestSalesDay, v: h.bestDay ? `${h.bestDay.date} · ${fmt(h.bestDay.sales)}` : '—' },
                    { k: L.avgDailyProfit, v: fmt0(h.avgDailyProfit) },
                    { k: L.profitMargin, v: `${h.profitMargin}%` },
                  ].map((r) => (
                    <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                      <span style={{ color: 'var(--ink2)', fontWeight: 600 }}>{r.k}</span>
                      <span style={{ fontWeight: 800 }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="card" style={{ padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--ink2)' }}>{L.dailyBreakdown}</div>
                <div className="sb" style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 120, overflowX: 'auto' }}>
                  {report!.days.map((d) => (
                    <div key={d.date} style={{ flex: '1 0 26px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 26 }}>
                      <div style={{ fontSize: 8.5, color: 'var(--ink3)', fontWeight: 700 }}>{short(d.sales)}</div>
                      <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 80 }}>
                        <div title={`${L.sales} ${fmt(d.sales)}`} style={{ flex: 1, height: `${Math.max(2, (d.sales / maxBar) * 100)}%`, background: 'var(--ok)', borderRadius: '3px 3px 0 0' }} />
                        <div title={`${L.profit} ${fmt(d.profit)}`} style={{ flex: 1, height: `${Math.max(2, (d.profit / maxBar) * 100)}%`, background: 'var(--warn)', borderRadius: '3px 3px 0 0' }} />
                        <div title={`${L.amountBanked} ${fmt(d.banked)}`} style={{ flex: 1, height: `${Math.max(2, (d.banked / maxBar) * 100)}%`, background: 'var(--vio)', borderRadius: '3px 3px 0 0' }} />
                      </div>
                      <div style={{ fontSize: 8.5, color: 'var(--ink3)', fontWeight: 600 }}>{d.date.slice(8)}/{d.date.slice(5, 7)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 10.5, color: 'var(--ink3)', fontWeight: 700 }}>
                  {[[L.sales, 'var(--ok)'], [L.profit, 'var(--warn)'], [L.amountBanked, 'var(--vio)']].map(([label, c]) => (
                    <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="card" style={{ padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--ink2)' }}>{L.incomeStatement}</div>
                {[
                  { k: L.totalSales, v: fmt0(totals.sales) },
                  { k: L.sessionExpenses, v: fmt0(totals.sessionExpenses) },
                  { k: L.purchases, v: fmt0(totals.sessionPurchases) },
                  { k: L.otherExpenses, v: fmt0(totals.otherExpenses) },
                  ...(totals.staffDebts > 0 ? [{ k: L.staffDebtOutstanding, v: fmt(totals.staffDebts), c: 'var(--warn)' }] : []),
                  { k: L.losses, v: fmt0(totals.losses), c: totals.losses > 0 ? 'var(--bad)' : undefined },
                  { k: L.totalProfit, v: fmt0(totals.profit), c: 'var(--ok)', big: true },
                  ...(Math.round(totals.balance) !== 0 ? [{ k: L.balanceDifference, v: fmt(totals.balance), c: 'var(--bad)' }] : []),
                ].map((r, i) => (
                  <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: r.big ? 15 : 13.5, borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                    <span style={{ color: 'var(--ink2)', fontWeight: r.big ? 800 : 600 }}>{r.k}</span>
                    <span style={{ fontWeight: 800, color: r.c || 'var(--ink)' }}>{r.v}</span>
                  </div>
                ))}
              </div>

              {report!.lossBreakdown.length > 0 && (
                <div className="card" style={{ padding: 16, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--ink2)' }}>{L.lossesDamages}</div>
                  {report!.lossBreakdown.slice(0, 5).map((r) => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                      <span style={{ color: 'var(--ink2)', fontWeight: 600 }}>{r.label}</span>
                      <span style={{ fontWeight: 800, color: 'var(--bad)' }}>{fmt(r.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="card" style={{ padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--ink2)' }}>{L.exportShare}</div>
                <button className="btn-ghost tap" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }} onClick={downloadPdf}>
                  <Icon name="doc" size={15} />
                  {L.downloadPdf}
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    inputMode="tel"
                    placeholder={L.whatsappNumber}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="card"
                    style={{ flex: 1, padding: '11px 12px', border: '1px solid var(--line)', fontSize: 13 }}
                  />
                  <button className="btn-primary tap" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }} onClick={sendWhatsapp}>
                    <Icon name="share" size={15} />
                    {L.send}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
