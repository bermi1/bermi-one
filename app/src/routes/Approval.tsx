import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { diffOf, expectedSales, profitOf, soldOf } from '../lib/calc';
import { tintVars } from '../lib/types';

export function Approval() {
  const nav = useNavigate();
  const { L, fmt, owner, lang } = useSettings();
  const { products, session, approveSession, returnSession } = useData();
  const { flash } = useToast();

  const counts = session?.counts || {};
  const sessionMoney = { cash: session?.cash || 0, mobile: session?.mobile || 0, bank_in: session?.bank_in || 0, closing_items: session?.closing_items || [] };
  const expected = expectedSales(products, counts);
  const gross = profitOf(products, counts);
  const diff = diffOf(products, counts, sessionMoney);

  const reasonLabel: Record<string, string> = { expense: L.rExpense, loss: L.rLoss, debt: L.rDebt, short: L.rShort, other: L.rOther };

  if (!session || session.status === 'open' || (session.status === 'submitted' && !owner)) {
    return (
      <div className="screen sb">
        <ScreenHeader title={L.reviewClosing} />
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, margin: '0 auto 14px', background: 'var(--card2)', display: 'grid', placeItems: 'center', color: 'var(--ink3)' }}>
            <Icon name="lock" size={20} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{L.nothingPending}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink2)' }}>{L.nothingPendingSub}</div>
        </div>
      </div>
    );
  }

  const approved = session.status === 'approved';
  const closingItems = session.closing_items || [];
  const itemsByKind = { expense: 0, loss: 0, debt: 0 };
  for (const it of closingItems) itemsByKind[it.kind] += it.amount;

  const summaryRows = [
    { label: L.sales, value: fmt(expected) },
    { label: L.cash, value: fmt(session.cash) },
    { label: L.mobileMoney, value: fmt(session.mobile) },
    { label: L.bank, value: fmt(session.bank_in) },
    ...(itemsByKind.expense > 0 ? [{ label: L.rExpense, value: fmt(itemsByKind.expense) }] : []),
    ...(itemsByKind.loss > 0 ? [{ label: L.rLoss, value: fmt(itemsByKind.loss) }] : []),
    ...(itemsByKind.debt > 0 ? [{ label: L.rDebt, value: fmt(itemsByKind.debt) }] : []),
    { label: L.difference, value: fmt(Math.abs(diff)), color: diff === 0 ? 'var(--ok)' : 'var(--bad)' },
    { label: L.grossProfit, value: fmt(gross), color: 'var(--ok)' },
  ];

  return (
    <div className="screen sb">
      <ScreenHeader title={approved ? L.closed : L.reviewClosing} sub={session.submitted_by_name ? `${session.submitted_by_name} · ${L.tapToReview}` : undefined} />

      {approved && (
        <div className="card" style={{ padding: 18, marginBottom: 16, background: 'var(--okSoft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="lock" size={18} style={{ color: 'var(--ok)' }} />
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ok)' }}>{L.closed}</div>
          </div>
          <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink2)' }}>{L.closedNote}</div>
          {session.approved_by_name && (
            <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600 }}>
              {lang === 'sw' ? 'Imethibitishwa na' : 'Verified by'} {session.approved_by_name}
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>{L.stockCount}</div>
      <div className="card" style={{ padding: 6, marginBottom: 16 }}>
        {products.map((p, i) => {
          const tv = tintVars(i);
          const sold = soldOf(p, counts);
          const closing = counts[p.id];
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 8px', borderBottom: i === products.length - 1 ? 'none' : '1px solid var(--line)' }}>
              <div style={{ width: 30, height: 30, borderRadius: 10, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name={p.icon} size={14} />
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600, width: 50, textAlign: 'right' }}>{closing ?? '—'}</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, width: 70, textAlign: 'right' }}>{fmt(sold * p.price)}</div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        {summaryRows.map((r) => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13.5 }}>
            <span style={{ color: 'var(--ink2)', fontWeight: 600 }}>{r.label}</span>
            <span style={{ fontWeight: 800, color: r.color || 'var(--ink)' }}>{r.value}</span>
          </div>
        ))}
        {session.reason && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{L.reasonGiven}</div>
            <div style={{ marginTop: 3, fontSize: 13.5, fontWeight: 700 }}>{reasonLabel[session.reason] || session.reason}</div>
            {session.note && <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--ink2)' }}>{session.note}</div>}
          </div>
        )}
      </div>

      {!approved ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn-ghost tap"
            style={{ flex: 1 }}
            onClick={async () => {
              await returnSession();
              flash(L.returnCorrection);
              nav('/home');
            }}
          >
            {L.returnCorrection}
          </button>
          <button
            className="btn-primary tap"
            style={{ flex: 1 }}
            onClick={async () => {
              await approveSession();
              flash(L.closed);
            }}
          >
            {L.approve}
          </button>
        </div>
      ) : (
        <button className="btn-primary tap" style={{ width: '100%' }} onClick={() => nav('/reports')}>
          {L.seeReports}
        </button>
      )}
    </div>
  );
}
