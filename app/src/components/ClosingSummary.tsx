import { useEffect, useState } from 'react';
import { buildReport, presetRange, type PresetId, type ReportTotals } from '../lib/reporting';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';

const PRESETS: PresetId[] = ['today', 'last7', 'thisMonth'];

/**
 * What the closings say, as they were entered: the sales and profit the stock
 * count worked out, the money collected, what was paid out that night, and
 * whether the day came out short or over. Nothing here is recalculated from
 * the cash book — the cash book is downstream of these figures.
 */
export function ClosingSummary({ businessIds }: { businessIds: string[] }) {
  const { lang, fmt0, fmt } = useSettings();
  const { businesses, fetchReportSource } = useData();
  const sw = lang === 'sw';
  const [preset, setPreset] = useState<PresetId>('thisMonth');
  const [t, setT] = useState<{ totals: ReportTotals; verified: number; waiting: number; waitingSales: number } | null>(null);
  const key = businessIds.join(',');

  useEffect(() => {
    let live = true;
    setT(null);
    const range = presetRange(preset);
    void fetchReportSource(businessIds, range.from, range.to).then(({ sessions, ledger }) => {
      if (!live) return;
      const report = buildReport({ businesses: businesses.filter((b) => businessIds.includes(b.id)), sessions, ledger, ...range });
      const waiting = sessions.filter((s) => s.status === 'submitted');
      setT({
        totals: report.totals,
        verified: sessions.filter((s) => s.status === 'verified').length,
        waiting: waiting.length,
        waitingSales: waiting.reduce((n, s) => n + Number(s.total_calculated_sales || 0), 0),
      });
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, preset, fetchReportSource]);

  const label: Record<string, string> = sw
    ? { today: 'Leo', last7: 'Siku 7', thisMonth: 'Mwezi huu' }
    : { today: 'Today', last7: '7 days', thisMonth: 'This month' };
  const x = t?.totals;
  const out = x ? x.sessionExpenses + x.losses + x.staffDebts : 0;
  const bal = x?.balance || 0;
  const rows = x ? [
    { k: sw ? 'Mauzo halisi' : 'Actual sales', v: fmt0(x.sales), c: 'var(--ok)', big: true },
    { k: sw ? 'Faida' : 'Profit', v: fmt0(x.profit), c: 'var(--warn)', big: true },
    { k: sw ? 'Cash' : 'Cash', v: fmt0(x.cash), sub: true },
    { k: sw ? 'Mobile' : 'Mobile', v: fmt0(x.mobile), sub: true },
    { k: sw ? 'Bank' : 'Bank', v: fmt0(x.bankIn), sub: true },
    { k: sw ? 'Ya kupeleka bank' : 'Amount to bank', v: fmt0(x.banked), sub: true },
    { k: sw ? 'Matumizi, hasara na madeni (kwenye kufunga)' : 'Expenses, losses and staff debt (in the closing)', v: fmt0(out), sub: true },
    {
      k: sw ? 'Pungufu / ziada' : 'Short / over',
      v: Math.round(bal) === 0 ? (sw ? 'Imelingana' : 'Balanced') : `${bal > 0 ? (sw ? 'Pungufu' : 'Short') : (sw ? 'Ziada' : 'Over')} ${fmt(Math.abs(bal))}`,
      c: Math.round(bal) === 0 ? 'var(--ok)' : bal > 0 ? 'var(--bad)' : 'var(--warn)',
    },
  ] : [];

  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>{sw ? 'Kutoka kufunga' : 'From closings'}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PRESETS.map((p) => (
            <button key={p} type="button" className="tap" onClick={() => setPreset(p)}
              style={{ padding: '4px 9px', borderRadius: 9, fontSize: 11, fontWeight: 700, border: '1px solid var(--line)', background: preset === p ? 'var(--brand)' : 'var(--card2)', color: preset === p ? 'var(--brandInk)' : 'var(--ink2)' }}>
              {label[p]}
            </button>
          ))}
        </div>
      </div>
      {!t ? (
        <div style={{ padding: '14px 0', fontSize: 12.5, color: 'var(--ink3)', fontWeight: 600 }}>…</div>
      ) : t.verified === 0 ? (
        <div style={{ padding: '6px 0', fontSize: 12.5, color: 'var(--ink3)', fontWeight: 600 }}>
          {sw ? 'Hakuna closing iliyo verified katika kipindi hiki.' : 'No verified closings in this period.'}
        </div>
      ) : rows.map((r) => (
        <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: r.sub ? '3px 0 3px 12px' : '6px 0', fontSize: r.big ? 15 : r.sub ? 12.5 : 13.5 }}>
          <span style={{ color: r.sub ? 'var(--ink3)' : 'var(--ink2)', fontWeight: r.sub ? 600 : 700 }}>{r.k}</span>
          <span style={{ fontWeight: 800, color: r.c || (r.sub ? 'var(--ink2)' : 'var(--ink)'), whiteSpace: 'nowrap' }}>{r.v}</span>
        </div>
      ))}
      {t && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)', fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600 }}>
          {sw ? `Kufunga ${t.verified} kulikohakikiwa` : `${t.verified} verified ${t.verified === 1 ? 'closing' : 'closings'}`}
          {t.waiting > 0 && (sw
            ? ` · ${t.waiting} vinasubiri uhakiki (mauzo ${fmt0(t.waitingSales)}, hayajajumuishwa)`
            : ` · ${t.waiting} waiting for you to verify (sales ${fmt0(t.waitingSales)}, not included yet)`)}
        </div>
      )}
    </div>
  );
}
