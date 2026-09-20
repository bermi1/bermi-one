import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../lib/icons';
import { Sheet } from './Sheet';
import { useSettings } from '../lib/useSettings';
import { countryByCode } from '../lib/countries';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { availableOf, closingItemsTotal, linesOf, sessionTotals, soldOf, soldOfLine } from '../lib/calc';
import type { StockSession } from '../lib/types';

/** Every past closing for this business: review, verify, reprint, remove. */
export function SessionHistory() {
  const nav = useNavigate();
  const { L, fmt, lang, owner } = useSettings();
  const { products, activeBusiness, fetchSessions, deleteSession, resumeSession } = useData();
  const { flash } = useToast();

  const [sessions, setSessions] = useState<StockSession[] | null>(null);
  const [viewing, setViewing] = useState<StockSession | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StockSession | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const rows = await fetchSessions();
    setSessions(rows);
  }, [fetchSessions]);

  useEffect(() => { void load(); }, [load]);

  /**
   * What the day sold.
   *
   * The frozen snapshot first, because it is the same arithmetic the table in
   * the view sheet does — a headline that disagrees with the lines below it is
   * worse than no headline. total_calculated_sales is the fallback for closings
   * recorded before snapshots existed, and live products the last resort.
   */
  function salesOf(s: StockSession): number {
    const counts = s.counts || {};
    if (s.lines?.length) return sessionTotals(s.lines, counts).sales;
    if (s.total_calculated_sales > 0) return s.total_calculated_sales;
    return products.filter((p) => counts[p.id] !== undefined).reduce((sum, p) => sum + soldOf(p, counts) * p.price, 0);
  }

  const statusMeta = (s: StockSession) => {
    switch (s.status) {
      case 'verified': return { label: L.verifiedLocked, color: 'var(--ok)', soft: 'var(--okSoft)', icon: 'lock' };
      case 'submitted': return { label: L.awaitingVerification, color: 'var(--warn)', soft: 'var(--warnSoft)', icon: 'clock' };
      case 'rejected': return { label: L.sentBack, color: 'var(--bad)', soft: 'var(--badSoft)', icon: 'alert' };
      default: return { label: L.stillOpen, color: 'var(--ink3)', soft: 'var(--card2)', icon: 'edit' };
    }
  };

  async function report(s: StockSession) {
    if (!activeBusiness) return;
    const { openSessionReport } = await import('../lib/sessionReport');
    const ok = openSessionReport({ business: activeBusiness, products, session: s, lang, includeProfit: owner });
    if (!ok) flash(lang === 'sw' ? 'Ruhusu dirisha jipya' : 'Allow pop-ups to open the report');
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setBusy(true);
    await deleteSession(confirmDelete.id);
    setBusy(false);
    setConfirmDelete(null);
    flash(lang === 'sw' ? 'Imefutwa' : 'Deleted');
    void load();
  }

  if (sessions === null) {
    return <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>{L.loading}</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ width: 46, height: 46, borderRadius: 15, margin: '0 auto 14px', background: 'var(--card2)', display: 'grid', placeItems: 'center', color: 'var(--ink3)' }}>
          <Icon name="doc" size={20} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{L.noSessionsYet}</div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink2)' }}>{L.noSessionsYetSub}</div>
        <button className="btn-primary tap" style={{ marginTop: 16 }} onClick={() => nav('/close')}>
          {L.closeToday}
        </button>
      </div>
    );
  }

  /*
    A closed day, in full.

    Showing only what sold turns a stock record into a sales receipt. A closing
    is checked by reading the whole line — what was there, what came in, what
    that makes, what was counted, and only then what the difference sold for. So
    every line is here, counted or not, off the snapshot frozen at submission
    rather than off today's stock.
  */
  const viewingCounts = viewing?.counts || {};
  const viewingLines = viewing ? linesOf(viewing, products) : [];
  const viewingTotals = sessionTotals(viewingLines, viewingCounts);

  /*
    Seven columns on a phone leaves about forty pixels each, which is not enough
    for "OPENING" or for "TSh 147,000". The headings are shortened and the
    currency is named once, in the Value heading, instead of on every row.
  */
  const sym = countryByCode(activeBusiness?.country_code || 'TZ').sym;
  const plain = (n: number) => Math.round(n).toLocaleString('en-US');

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sessions.map((s) => {
          const meta = statusMeta(s);
          const sales = salesOf(s);
          const dateStr = new Date(s.session_date).toLocaleDateString(lang === 'sw' ? 'sw-TZ' : 'en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
          return (
            <div key={s.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14.5, fontWeight: 800 }}>{dateStr}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase', color: meta.color, background: meta.soft, padding: '3px 7px', borderRadius: 6 }}>
                      <Icon name={meta.icon} size={10} />
                      {meta.label}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600 }}>
                    {s.submitted_by_name || '—'}
                    {closingItemsTotal(s) > 0 ? ` · ${fmt(closingItemsTotal(s))} ${lang === 'sw' ? 'makato' : 'deducted'}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{fmt(sales)}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink3)', fontWeight: 600 }}>{L.sales}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="chip tap" style={{ padding: '6px 11px', fontSize: 11.5 }} onClick={() => setViewing(s)}>
                  {L.view}
                </button>
                <button className="chip tap" style={{ padding: '6px 11px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => void report(s)}>
                  <Icon name="doc" size={11} />
                  {L.report}
                </button>
                {s.status === 'submitted' && (
                  <button className="chip tap" style={{ padding: '6px 11px', fontSize: 11.5, color: 'var(--brand)' }} onClick={() => nav('/approval')}>
                    {L.reviewClosing}
                  </button>
                )}
                {(s.status === 'open' || s.status === 'rejected') && (
                  <button
                    className="chip tap"
                    style={{ padding: '6px 11px', fontSize: 11.5, color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 5 }}
                    onClick={() => { resumeSession(s); nav('/close'); }}
                  >
                    <Icon name="edit" size={11} />
                    {L.resumeClosing}
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button className="chip tap" style={{ padding: '6px 11px', fontSize: 11.5, color: 'var(--bad)' }} onClick={() => setConfirmDelete(s)}>
                  <Icon name="x" size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Sheet open={!!viewing} onClose={() => setViewing(null)} title={viewing ? new Date(viewing.session_date).toLocaleDateString(lang === 'sw' ? 'sw-TZ' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : ''} sub={viewing?.submitted_by_name || undefined}>
        {viewing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {L.sessionLines} · {viewingLines.length}
              </div>
              <div style={{ marginTop: 3, fontSize: 10.5, color: 'var(--ink3)', fontWeight: 600, lineHeight: 1.4 }}>{L.snapshotNote}</div>
            </div>

            <div className="card" style={{ padding: 0, maxHeight: 320, overflowY: 'auto' }}>
              {/* Sold and Value are the point of the table, so nothing is allowed
                  to push them off the right edge of a phone. */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed' }}>
                <colgroup>
                  <col />
                  {Array.from({ length: 5 }, (_, i) => <col key={i} style={{ width: 34 }} />)}
                  <col style={{ width: 62 }} />
                </colgroup>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: 'var(--card2)', zIndex: 1 }}>
                    {[L.product, L.colOpen, L.colAdd, L.colTotal, L.colLeft, L.colSold, `${L.valueCol} ${sym}`].map((h, i) => (
                      <th
                        key={h}
                        style={{
                          padding: '8px 5px',
                          textAlign: i === 0 ? 'left' : 'right',
                          fontSize: 8.5,
                          fontWeight: 800,
                          letterSpacing: 0.2,
                          textTransform: 'uppercase',
                          color: 'var(--ink3)',
                          borderBottom: '1px solid var(--line)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewingLines.map((l) => {
                    const counted = viewingCounts[l.id] !== undefined && viewingCounts[l.id] !== null;
                    const left = counted ? Number(viewingCounts[l.id]) : null;
                    const sold = soldOfLine(l, viewingCounts);
                    return (
                      <tr key={l.id} style={{ borderBottom: '1px solid var(--line)', opacity: counted ? 1 : 0.55 }}>
                        <td style={{ padding: '8px 5px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</td>
                        <td style={{ padding: '8px 5px', textAlign: 'right', color: 'var(--ink2)' }}>{l.opening}</td>
                        <td style={{ padding: '8px 5px', textAlign: 'right', color: 'var(--ink2)' }}>{l.added || '—'}</td>
                        <td style={{ padding: '8px 5px', textAlign: 'right', fontWeight: 700 }}>{availableOf(l)}</td>
                        {/* An uncounted line is a gap in the count, not a zero. */}
                        <td style={{ padding: '8px 5px', textAlign: 'right', fontWeight: 700 }}>{left === null ? '—' : left}</td>
                        <td style={{ padding: '8px 5px', textAlign: 'right', fontWeight: 800, color: sold ? 'var(--ink)' : 'var(--ink3)' }}>{sold || '—'}</td>
                        <td style={{ padding: '8px 5px', textAlign: 'right', fontWeight: 800 }}>{sold ? plain(sold * l.price) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ position: 'sticky', bottom: 0, background: 'var(--card2)' }}>
                    <td style={{ padding: '9px 5px', fontWeight: 800, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--ink3)' }}>{L.total}</td>
                    <td style={{ padding: '9px 5px', textAlign: 'right', fontWeight: 800 }}>{viewingTotals.opening}</td>
                    <td style={{ padding: '9px 5px', textAlign: 'right', fontWeight: 800 }}>{viewingTotals.added}</td>
                    <td style={{ padding: '9px 5px', textAlign: 'right', fontWeight: 800 }}>{viewingTotals.available}</td>
                    <td style={{ padding: '9px 5px', textAlign: 'right', fontWeight: 800 }}>{viewingTotals.closing}</td>
                    <td style={{ padding: '9px 5px', textAlign: 'right', fontWeight: 800 }}>{viewingTotals.sold}</td>
                    <td style={{ padding: '9px 5px', textAlign: 'right', fontWeight: 800 }}>{plain(viewingTotals.sales)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="card" style={{ padding: 14 }}>
              {[
                { k: L.sales, v: fmt(viewing.lines?.length ? viewingTotals.sales : (viewing.total_calculated_sales || viewingTotals.sales)) },
                ...(owner ? [{ k: L.grossProfit, v: fmt(viewing.lines?.length ? viewingTotals.profit : (viewing.total_calculated_profit || viewingTotals.profit)), c: 'var(--ok)' }] : []),
                { k: L.soldCol, v: `${viewingTotals.sold} ${L.unitsSold}` },
                { k: L.stockLeft, v: `${viewingTotals.closing} ${L.unitsSold}` },
                { k: L.stockLeftValue, v: fmt(viewingTotals.stockValue) },
              ].map((r) => (
                <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                  <span style={{ color: 'var(--ink2)', fontWeight: 600 }}>{r.k}</span>
                  <span style={{ fontWeight: 800, color: (r as { c?: string }).c }}>{r.v}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: 14 }}>
              {[
                { k: L.cash, v: fmt(viewing.cash || 0) },
                { k: L.mobileMoney, v: fmt(viewing.mobile || 0) },
                { k: L.bank, v: fmt(viewing.bank_in || 0) },
                { k: L.expensesLossesDebt, v: fmt(closingItemsTotal(viewing)) },
              ].map((r) => (
                <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                  <span style={{ color: 'var(--ink2)', fontWeight: 600 }}>{r.k}</span>
                  <span style={{ fontWeight: 800 }}>{r.v}</span>
                </div>
              ))}
            </div>

            {viewing.owner_comments && (
              <div className="card" style={{ padding: 12, background: 'var(--warnSoft)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{L.ownerComments}</div>
                <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600 }}>{viewing.owner_comments}</div>
              </div>
            )}

            {(viewing.status === 'open' || viewing.status === 'rejected') && (
              <button
                className="btn-primary tap"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={() => { resumeSession(viewing); setViewing(null); nav('/close'); }}
              >
                <Icon name="edit" size={15} />
                {L.resumeClosing}
              </button>
            )}
            <button className="btn-ghost tap" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => void report(viewing)}>
              <Icon name="doc" size={15} />
              {L.report}
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={L.deleteSession}>
        {confirmDelete && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13.5, color: 'var(--ink2)', lineHeight: 1.5 }}>
              {confirmDelete.status === 'verified' ? L.deleteVerifiedWarning : L.deleteSessionWarning}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost tap" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>{L.cancel}</button>
              <button className="btn-primary tap" style={{ flex: 1, background: 'var(--bad)' }} data-disabled={busy} onClick={doDelete}>{L.delete}</button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
