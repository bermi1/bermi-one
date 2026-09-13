import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { expectedSales, profitOf, soldOf, closingItemsTotal, groupByCategory } from '../lib/calc';
import { tintVars, type ClosingItemKind } from '../lib/types';
import { openSessionReport } from '../lib/sessionReport';

const DEDUCTION_SECTIONS: { kind: ClosingItemKind; icon: string }[] = [
  { kind: 'expense', icon: 'receipt' },
  { kind: 'loss', icon: 'alert' },
  { kind: 'debt', icon: 'user' },
];

export function Close() {
  const nav = useNavigate();
  const { L, fmt, fmt0, short, owner, lang } = useSettings();
  const {
    products, session, activeBusiness, setClosingCount, setSessionMoney,
    addClosingItem, removeClosingItem, reopenSession,
  } = useData();
  const { flash } = useToast();

  const counts = session?.counts || {};
  const status = session?.status ?? 'open';
  const closingItems = session?.closing_items || [];

  // Verified is terminal — nobody edits it. Submitted and rejected days are
  // read-only until the owner explicitly reopens them.
  const editing = status === 'open';
  const canReopen = owner && (status === 'submitted' || status === 'rejected');

  const [itemSheetOpen, setItemSheetOpen] = useState(false);
  const [itemKind, setItemKind] = useState<ClosingItemKind>('expense');
  const [itemAmount, setItemAmount] = useState('');
  const [itemNote, setItemNote] = useState('');

  const expected = expectedSales(products, counts);
  const grossProfit = profitOf(products, counts);
  const soldUnits = products.reduce((s, p) => s + soldOf(p, counts), 0);
  const countedItems = products.filter((p) => counts[p.id] !== undefined).length;
  const groups = useMemo(() => groupByCategory(products), [products]);

  const moneyFields: { key: 'cash' | 'mobile' | 'bank_in' | 'amount_to_bank'; label: string; icon: string }[] = [
    { key: 'cash', label: L.cashReceived, icon: 'cash' },
    { key: 'mobile', label: L.mobileReceived, icon: 'phone' },
    { key: 'bank_in', label: L.bank, icon: 'bank' },
    { key: 'amount_to_bank', label: L.amountToBank, icon: 'out' },
  ];

  const itemKindLabel: Record<ClosingItemKind, string> = { expense: L.rExpense, loss: L.lossesDamages, debt: L.rDebt };

  function openItemSheet(kind: ClosingItemKind) {
    setItemKind(kind);
    setItemAmount('');
    setItemNote('');
    setItemSheetOpen(true);
  }

  async function saveItem() {
    const amount = Number(itemAmount || 0);
    if (amount <= 0) return;
    await addClosingItem(itemKind, amount, itemNote.trim());
    setItemSheetOpen(false);
  }

  function printReport() {
    if (!activeBusiness || !session) return;
    const ok = openSessionReport({ business: activeBusiness, products, session, lang });
    if (!ok) flash(lang === 'sw' ? 'Ruhusu dirisha jipya' : 'Allow pop-ups to open the report');
  }

  // --- No products yet: nothing to count ---
  if (products.length === 0) {
    return (
      <div className="screen sb">
        <ScreenHeader title={L.closeToday} sub={L.closeSub} />
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, margin: '0 auto 14px', background: 'var(--card2)', display: 'grid', placeItems: 'center', color: 'var(--ink3)' }}>
            <Icon name="box" size={20} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{L.noItemsToCount}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink2)' }}>{L.noItemsToCountSub}</div>
          <button className="btn-primary tap" style={{ marginTop: 16 }} onClick={() => nav('/stock')}>
            {L.stock}
          </button>
        </div>
      </div>
    );
  }

  // --- Already submitted, verified or sent back: show its state, not the form ---
  if (!editing) {
    const meta =
      status === 'verified'
        ? { color: 'var(--ok)', soft: 'var(--okSoft)', icon: 'lock', title: L.lockedByOwner, body: L.lockedByOwnerSub }
        : status === 'rejected'
          ? { color: 'var(--bad)', soft: 'var(--badSoft)', icon: 'alert', title: L.sentBack, body: L.sentBackSub }
          : { color: 'var(--brand)', soft: 'var(--brandSoft)', icon: 'clock', title: L.awaitingOwnerVerification, body: L.awaitingOwnerVerificationSub };

    return (
      <div className="screen sb">
        <ScreenHeader title={L.closeToday} sub={session?.session_date} />

        <div className="card" style={{ padding: 20, marginBottom: 14, background: meta.soft }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name={meta.icon} size={18} style={{ color: meta.color }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: meta.color }}>{meta.title}</div>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink2)', lineHeight: 1.5 }}>{meta.body}</div>
          {session?.submitted_by_name && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600 }}>
              {L.submittedBy} {session.submitted_by_name}
              {session.approved_by_name ? ` · ${L.verifiedBy} ${session.approved_by_name}` : ''}
            </div>
          )}
          {session?.owner_comments && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--card)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{L.ownerComments}</div>
              <div style={{ marginTop: 4, fontSize: 13.5, fontWeight: 600 }}>{session.owner_comments}</div>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          {[
            { k: L.sales, v: fmt0(session?.total_calculated_sales || expected) },
            { k: L.grossProfit, v: fmt0(session?.total_calculated_profit || grossProfit), c: 'var(--ok)' },
            { k: L.cashReceived, v: fmt0(session?.cash || 0) },
            { k: L.mobileReceived, v: fmt0(session?.mobile || 0) },
            { k: L.amountToBank, v: fmt0(session?.amount_to_bank || 0) },
            { k: L.expensesLossesDebt, v: fmt0(session ? closingItemsTotal(session) : 0) },
          ].map((r) => (
            <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13.5 }}>
              <span style={{ color: 'var(--ink2)', fontWeight: 600 }}>{r.k}</span>
              <span style={{ fontWeight: 800, color: r.c || 'var(--ink)' }}>{r.v}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost tap" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={printReport}>
            <Icon name="doc" size={15} />
            {L.report}
          </button>
          {canReopen && (
            <button className="btn-primary tap" style={{ flex: 1 }} onClick={async () => { await reopenSession(); flash(L.editResubmit); }}>
              {L.editResubmit}
            </button>
          )}
          {status === 'submitted' && owner && (
            <button className="btn-primary tap" style={{ flex: 1 }} onClick={() => nav('/approval')}>
              {L.reviewClosing}
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- The counting form ---
  return (
    <div className="screen sb">
      <ScreenHeader title={L.closeToday} sub={L.closeSub} />

      {session?.owner_comments && (
        <div className="card" style={{ padding: 14, marginBottom: 14, background: 'var(--badSoft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="alert" size={15} style={{ color: 'var(--bad)' }} />
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--bad)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{L.ownerComments}</div>
          </div>
          <div style={{ marginTop: 6, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{session.owner_comments}</div>
        </div>
      )}

      <div className="card" style={{ padding: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{L.counted}</div>
          <div style={{ marginTop: 3, fontSize: 16, fontWeight: 800 }}>{countedItems}<span style={{ fontSize: 12, color: 'var(--ink3)' }}> / {products.length}</span></div>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)' }} />
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{soldUnits} {L.unitsSold}</div>
          <div style={{ marginTop: 3, fontSize: 16, fontWeight: 800 }}>{fmt0(expected)}</div>
        </div>
      </div>

      {groups.map(({ cat, items }, gi) => {
        const tv = tintVars(gi);
        const catSold = items.reduce((s, p) => s + soldOf(p, counts), 0);
        const catValue = items.reduce((s, p) => s + soldOf(p, counts) * p.price, 0);
        const done = items.filter((p) => counts[p.id] !== undefined).length;
        return (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 8px' }}>
              <div style={{ width: 8, height: 8, borderRadius: 3, background: tv.ink, flexShrink: 0 }} />
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{cat}</div>
              <div style={{ fontSize: 11, color: done === items.length ? 'var(--ok)' : 'var(--ink3)', fontWeight: 700 }}>{done}/{items.length}</div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{catSold || '—'} · {catValue ? short(catValue) : '—'}</div>
            </div>

            <div className="card" style={{ padding: 6 }}>
              {items.map((p, i) => {
                const avail = p.opening + p.added;
                const closingVal = counts[p.id];
                const sold = soldOf(p, counts);
                const isCounted = closingVal !== undefined;
                return (
                  <div key={p.id} style={{ padding: '10px 8px', borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Icon name={p.icon} size={15} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>
                          {L.opening} {p.opening}
                          {p.added > 0 && <span style={{ color: 'var(--ok)' }}> + {p.added} {L.added.toLowerCase()}</span>}
                          {' = '}<span style={{ color: 'var(--ink2)', fontWeight: 700 }}>{avail} {p.unit}</span>
                          {' · '}{fmt(p.price)}/{p.unit}
                        </div>
                      </div>
                      <input
                        inputMode="numeric"
                        placeholder="—"
                        value={closingVal === undefined ? '' : String(closingVal)}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9]/g, '');
                          void setClosingCount(p.id, v === '' ? null : Number(v));
                        }}
                        style={{ width: 54, textAlign: 'center', padding: '8px 0', borderRadius: 10, border: `1px solid ${isCounted ? 'var(--brand)' : 'var(--line)'}`, background: 'var(--card2)', fontSize: 14, fontWeight: 700 }}
                      />
                    </div>
                    {isCounted && (
                      <div style={{ display: 'flex', gap: 10, marginTop: 6, paddingLeft: 42, fontSize: 11.5, fontWeight: 700 }}>
                        <span style={{ color: 'var(--ink3)' }}><span style={{ color: 'var(--ink)' }}>{sold || '—'}</span> {L.sold}</span>
                        <span style={{ color: 'var(--ink3)' }}>{L.sales} <span style={{ color: 'var(--ink)' }}>{fmt0(sold * p.price)}</span></span>
                        <span style={{ color: 'var(--ink3)' }}>{L.profit} <span style={{ color: 'var(--ok)' }}>{fmt0(sold * p.profit)}</span></span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

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
              value={session?.[f.key] || ''}
              onChange={(e) => void setSessionMoney(f.key, Number(e.target.value.replace(/[^0-9]/g, '') || 0))}
              style={{ width: 110, textAlign: 'right', padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card2)', fontSize: 14, fontWeight: 700 }}
            />
          </div>
        ))}
      </div>

      {DEDUCTION_SECTIONS.map(({ kind, icon }) => {
        const rows = closingItems.filter((it) => it.kind === kind);
        const total = rows.reduce((s, it) => s + it.amount, 0);
        return (
          <div key={kind} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {itemKindLabel[kind]}
                {total > 0 && <span style={{ marginLeft: 8, color: 'var(--ink3)' }}>{fmt(total)}</span>}
              </div>
              <button className="chip tap" onClick={() => openItemSheet(kind)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px' }}>
                <Icon name="plus" size={12} />
                {L.add}
              </button>
            </div>
            <div className="card" style={{ padding: 6 }}>
              {rows.length === 0 ? (
                <div style={{ padding: '12px 8px', textAlign: 'center', fontSize: 12, color: 'var(--ink3)' }}>{L.noItemsYet}</div>
              ) : (
                rows.map((it, i) => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--line)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 9, background: 'var(--card2)', color: 'var(--ink2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Icon name={icon} size={13} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.note || itemKindLabel[kind]}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{fmt(it.amount)}</div>
                    <button className="icon-btn tap" style={{ width: 28, height: 28 }} onClick={() => void removeClosingItem(it.id)} aria-label={L.removeLine}>
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}

      <button className="btn-primary tap" style={{ width: '100%' }} onClick={() => nav('/diff')}>
        {L.continue}
      </button>

      <Sheet open={itemSheetOpen} onClose={() => setItemSheetOpen(false)} title={itemKindLabel[itemKind]}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {DEDUCTION_SECTIONS.map(({ kind }) => (
              <button
                key={kind}
                className="tap"
                onClick={() => setItemKind(kind)}
                style={{ flex: 1, padding: '10px 4px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: itemKind === kind ? 'var(--brandSoft)' : 'var(--card2)', color: itemKind === kind ? 'var(--brand)' : 'var(--ink2)', border: `1.5px solid ${itemKind === kind ? 'var(--brand)' : 'transparent'}` }}
              >
                {itemKindLabel[kind]}
              </button>
            ))}
          </div>
          <input
            autoFocus
            inputMode="numeric"
            placeholder={L.amount}
            value={itemAmount}
            onChange={(e) => setItemAmount(e.target.value.replace(/[^0-9]/g, ''))}
            className="card"
            style={{ padding: '12px 14px', border: 'none', fontSize: 16, fontWeight: 800 }}
          />
          <input
            placeholder={itemKind === 'debt' ? L.whoOwes : L.entryNote}
            value={itemNote}
            onChange={(e) => setItemNote(e.target.value)}
            className="card"
            style={{ padding: '12px 14px', border: 'none', fontSize: 13.5 }}
          />
          <button className="btn-primary tap" style={{ width: '100%' }} data-disabled={!Number(itemAmount)} onClick={saveItem}>
            {L.add}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
