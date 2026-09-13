import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { expectedSales, soldOf, closingItemsTotal } from '../lib/calc';
import { tintVars, KIND_ICON, type ClosingItemKind } from '../lib/types';

export function Close() {
  const nav = useNavigate();
  const { L, fmt, short, owner } = useSettings();
  const { products, session, setClosingCount, setSessionMoney, addClosingItem, removeClosingItem } = useData();
  const counts = session?.counts || {};
  const locked = session?.status === 'approved' || (session?.status === 'submitted' && !owner);
  const closingItems = session?.closing_items || [];

  const [itemSheetOpen, setItemSheetOpen] = useState(false);
  const [itemKind, setItemKind] = useState<ClosingItemKind>('expense');
  const [itemAmount, setItemAmount] = useState('');
  const [itemNote, setItemNote] = useState('');

  const expected = expectedSales(products, counts);
  const soldUnits = products.reduce((s, p) => s + soldOf(p, counts), 0);

  const moneyFields: { key: 'cash' | 'mobile' | 'bank_in'; label: string; icon: string }[] = [
    { key: 'cash', label: L.cash, icon: 'cash' },
    { key: 'mobile', label: L.mobileMoney, icon: 'phone' },
    { key: 'bank_in', label: L.bank, icon: 'bank' },
  ];

  const itemKindLabel: Record<ClosingItemKind, string> = { expense: L.rExpense, loss: L.rLoss, debt: L.rDebt };

  function openItemSheet() {
    setItemKind('expense');
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

  return (
    <div className="screen sb">
      <ScreenHeader title={L.closeToday} sub={L.closeSub} />

      <div className="card" style={{ padding: 6, marginBottom: 16 }}>
        {products.map((p, i) => {
          const tv = tintVars(i);
          const sold = soldOf(p, counts);
          const val = sold * p.price;
          const avail = p.opening + p.added;
          const closingVal = counts[p.id];
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 8px', borderBottom: i === products.length - 1 ? 'none' : '1px solid var(--line)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name={p.icon} size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>
                  {L.open} {avail} {p.unit}
                </div>
              </div>
              <input
                inputMode="numeric"
                placeholder="—"
                disabled={locked}
                value={closingVal === undefined ? '' : String(closingVal)}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  void setClosingCount(p.id, v === '' ? null : Number(v));
                }}
                style={{ width: 54, textAlign: 'center', padding: '8px 0', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card2)', fontSize: 14, fontWeight: 700 }}
              />
              <div style={{ width: 66, textAlign: 'right', fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>{short(val)}</div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{soldUnits} {L.unitsSold}</div>
          <div style={{ marginTop: 3, fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>{L.sold}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{fmt(expected)}</div>
          <div style={{ marginTop: 3, fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>{L.sales}</div>
        </div>
      </div>

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
              disabled={locked}
              value={session?.[f.key] || ''}
              onChange={(e) => void setSessionMoney(f.key, Number(e.target.value.replace(/[^0-9]/g, '') || 0))}
              style={{ width: 110, textAlign: 'right', padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card2)', fontSize: 14, fontWeight: 700 }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{L.expensesLossesDebt}</div>
        {!locked && (
          <button className="chip tap" onClick={openItemSheet} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px' }}>
            <Icon name="plus" size={12} />
            {L.add}
          </button>
        )}
      </div>
      <div className="card" style={{ padding: 6, marginBottom: 20 }}>
        {closingItems.length === 0 ? (
          <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 12.5, color: 'var(--ink3)' }}>{L.noItemsYet}</div>
        ) : (
          <>
            {closingItems.map((it, i) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderBottom: i === closingItems.length - 1 ? 'none' : '1px solid var(--line)' }}>
                <div style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--card2)', color: 'var(--ink2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Icon name={KIND_ICON[it.kind]} size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{itemKindLabel[it.kind]}</div>
                  {it.note && <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.note}</div>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{fmt(it.amount)}</div>
                {!locked && (
                  <button className="icon-btn tap" style={{ width: 28, height: 28 }} onClick={() => void removeClosingItem(it.id)} aria-label={L.removeLine}>
                    <Icon name="x" size={13} />
                  </button>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 8px 4px', fontSize: 12.5, fontWeight: 700, color: 'var(--ink2)' }}>
              <span>{L.total}</span>
              <span>{fmt(closingItemsTotal({ closing_items: closingItems }))}</span>
            </div>
          </>
        )}
      </div>

      {!locked && (
        <button className="btn-primary tap" style={{ width: '100%' }} onClick={() => nav('/diff')}>
          {L.continue}
        </button>
      )}

      <Sheet open={itemSheetOpen} onClose={() => setItemSheetOpen(false)} title={L.addClosingItem}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['expense', 'loss', 'debt'] as ClosingItemKind[]).map((k) => (
              <button
                key={k}
                className="tap"
                onClick={() => setItemKind(k)}
                style={{ flex: 1, padding: '10px 4px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: itemKind === k ? 'var(--brandSoft)' : 'var(--card2)', color: itemKind === k ? 'var(--brand)' : 'var(--ink2)', border: `1.5px solid ${itemKind === k ? 'var(--brand)' : 'transparent'}` }}
              >
                {itemKindLabel[k]}
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
            placeholder={L.entryNote}
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
