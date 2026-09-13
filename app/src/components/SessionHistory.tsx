import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../lib/icons';
import { Sheet } from './Sheet';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { closingItemsTotal, soldOf } from '../lib/calc';
import { openSessionReport } from '../lib/sessionReport';
import type { StockSession } from '../lib/types';

/** Every past closing for this business: review, verify, reprint, remove. */
export function SessionHistory() {
  const nav = useNavigate();
  const { L, fmt, lang } = useSettings();
  const { products, activeBusiness, fetchSessions, deleteSession } = useData();
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

  function salesOf(s: StockSession): number {
    const counts = s.counts || {};
    return products.filter((p) => counts[p.id] !== undefined).reduce((sum, p) => sum + soldOf(p, counts) * p.price, 0);
  }

  const statusMeta = (s: StockSession) =>
    s.status === 'approved'
      ? { label: L.verifiedLocked, color: 'var(--ok)', soft: 'var(--okSoft)', icon: 'lock' }
      : s.status === 'submitted'
        ? { label: L.awaitingVerification, color: 'var(--warn)', soft: 'var(--warnSoft)', icon: 'clock' }
        : { label: L.stillOpen, color: 'var(--ink3)', soft: 'var(--card2)', icon: 'edit' };

  function report(s: StockSession) {
    if (!activeBusiness) return;
    const ok = openSessionReport({ business: activeBusiness, products, session: s, lang });
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

  const viewingCounts = viewing?.counts || {};
  const viewingItems = viewing ? products.filter((p) => viewingCounts[p.id] !== undefined) : [];

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
                <button className="chip tap" style={{ padding: '6px 11px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => report(s)}>
                  <Icon name="doc" size={11} />
                  {L.report}
                </button>
                {s.status === 'submitted' && (
                  <button className="chip tap" style={{ padding: '6px 11px', fontSize: 11.5, color: 'var(--brand)' }} onClick={() => nav('/approval')}>
                    {L.reviewClosing}
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
            <div className="card" style={{ padding: 6, maxHeight: 260, overflowY: 'auto' }}>
              {viewingItems.map((p, i) => {
                const sold = soldOf(p, viewingCounts);
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 8px', borderBottom: i === viewingItems.length - 1 ? 'none' : '1px solid var(--line)', fontSize: 12.5 }}>
                    <div style={{ flex: 1, minWidth: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ color: 'var(--ink3)', width: 54, textAlign: 'right' }}>{sold} {L.sold}</div>
                    <div style={{ fontWeight: 700, width: 74, textAlign: 'right' }}>{fmt(sold * p.price)}</div>
                  </div>
                );
              })}
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

            <button className="btn-ghost tap" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => report(viewing)}>
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
              {confirmDelete.status === 'approved' ? L.deleteVerifiedWarning : L.deleteSessionWarning}
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
