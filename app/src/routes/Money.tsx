import { useEffect, useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { KIND_ICON, KIND_SIGN, tintVars, type AccountId, type Accounts, type EntryKind, type LedgerEntry } from '../lib/types';

const KINDS: EntryKind[] = ['sale', 'payment', 'purchase', 'expense', 'withdrawal', 'loss', 'debt'];

interface Line {
  amount: string;
  note: string;
}

export function Money() {
  const { L, fmt, fmt0, short, owner, lang } = useSettings();
  const { accounts, ledger, businesses, activeBusiness, addLedgerLines, deleteLedgerEntry, fetchBooks, plan } = useData();
  const { flash } = useToast();

  /**
   * The cash book can be read one business at a time or several at once, the
   * same way the portfolio reads. Recording, though, always lands in the
   * business you are actually standing in — an entry has to belong somewhere.
   */
  const [picked, setPicked] = useState<string[]>(() => (activeBusiness ? [activeBusiness.id] : []));
  const [combined, setCombined] = useState<{ accounts: Accounts[]; ledger: LedgerEntry[] } | null>(null);

  useEffect(() => {
    if (activeBusiness && picked.length === 0) setPicked([activeBusiness.id]);
  }, [activeBusiness, picked.length]);

  const isCombined = picked.length > 1;

  useEffect(() => {
    if (!isCombined) { setCombined(null); return; }
    let live = true;
    void fetchBooks(picked).then((b) => { if (live) setCombined(b); });
    return () => { live = false; };
  }, [isCombined, picked, fetchBooks]);

  function togglePicked(id: string) {
    setPicked((prev) => (prev.includes(id) ? (prev.length === 1 ? prev : prev.filter((x) => x !== id)) : [...prev, id]));
  }

  const bookLedger = isCombined ? combined?.ledger || [] : ledger;
  const balances: Record<AccountId, number> = isCombined
    ? (combined?.accounts || []).reduce(
        (acc, a) => ({ cash: acc.cash + a.cash, mobile: acc.mobile + a.mobile, bank: acc.bank + a.bank }),
        { cash: 0, mobile: 0, bank: 0 },
      )
    : { cash: accounts?.cash || 0, mobile: accounts?.mobile || 0, bank: accounts?.bank || 0 };
  const bizName = new Map(businesses.map((b) => [b.id, b.name]));

  // Any entry can be removed, and removal is final — so it asks first, once.
  const [confirmDelete, setConfirmDelete] = useState<LedgerEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [sheetStep, setSheetStep] = useState<'closed' | 'kinds' | 'entry'>('closed');
  const [kind, setKind] = useState<EntryKind>('expense');
  const [account, setAccount] = useState<AccountId>('cash');
  const [lines, setLines] = useState<Line[]>([{ amount: '', note: '' }]);

  const kindLabel: Record<EntryKind, string> = {
    sale: L.sale, payment: L.payment, purchase: L.purchase, expense: L.expense, withdrawal: L.withdrawal, loss: L.rLoss, stock: L.stock, debt: L.rDebt,
  };
  const accountLabel: Record<AccountId, string> = { cash: L.cash, mobile: L.mobileMoney, bank: L.bank };

  const sumKind = (k: EntryKind) => bookLedger.filter((e) => e.kind === k).reduce((s, e) => s + Math.abs(e.amount), 0);
  const book = useMemo(() => {
    const inflow = bookLedger.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const outflow = bookLedger.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0);
    return { inflow, outflow, net: inflow - outflow };
  }, [bookLedger]);
  const held = balances.cash + balances.mobile + balances.bank;

  function openKindPicker() {
    setKind('expense');
    setAccount('cash');
    setLines([{ amount: '', note: '' }]);
    setSheetStep('kinds');
  }

  function pickKind(k: EntryKind) {
    setKind(k);
    setLines([{ amount: '', note: '' }]);
    setSheetStep('entry');
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function save() {
    const sign = KIND_SIGN[kind];
    const valid = lines.filter((l) => Number(l.amount) > 0);
    if (!valid.length) {
      flash(lang === 'sw' ? 'Weka kiasi' : 'Enter an amount');
      return;
    }
    await addLedgerLines(
      valid.map((l) => ({ kind, label: l.note || kindLabel[kind], amount: Number(l.amount) * (sign || 1), account })),
    );
    setSheetStep('closed');
    flash(`${kindLabel[kind]} · ${fmt(valid.reduce((s, l) => s + Number(l.amount), 0))}`);
  }

  return (
    <div className="screen sb">
      <ScreenHeader title={L.cashBook} sub={owner ? L.cashBookSub : L.myEntries} right={
        <button className="icon-btn tap" onClick={openKindPicker} aria-label={L.add}>
          <Icon name="plus" />
        </button>
      } />

      {owner && businesses.length > 1 && plan.limits.combinedReporting && (
        <div className="sb" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
          {businesses.map((b) => {
            const on = picked.includes(b.id);
            return (
              <button
                key={b.id}
                className="tap"
                onClick={() => togglePicked(b.id)}
                style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 12, fontSize: 12.5, fontWeight: 700, background: on ? 'var(--brand)' : 'var(--card)', color: on ? 'var(--brandInk)' : 'var(--ink2)', border: '1px solid var(--line)' }}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
        {(['cash', 'mobile', 'bank'] as AccountId[]).map((id, i) => {
          const tv = tintVars(i);
          const accIcon: Record<AccountId, string> = { cash: 'cash', mobile: 'phone', bank: 'bank' };
          return (
            <div key={id} className="card" style={{ padding: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 9, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', marginBottom: 8 }}>
                <Icon name={accIcon[id]} size={13} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700 }}>{accountLabel[id]}</div>
              <div style={{ marginTop: 3, fontSize: 14, fontWeight: 800 }}>{balances[id] ? short(balances[id]) : '—'}</div>
            </div>
          );
        })}
      </div>

      {owner && (
        <div className="card" style={{ padding: 16, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{isCombined ? L.combinedBooks : L.cashBook}</div>
            <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 700 }}>{L.totalHeld} {fmt0(held)}</div>
          </div>
          {[
            { label: L.moneyIn, value: fmt0(book.inflow), color: book.inflow ? 'var(--ok)' : undefined },
            { label: L.salesRecorded, value: fmt0(sumKind('sale') + sumKind('payment')), sub: true },
            { label: L.moneyOut, value: fmt0(book.outflow), color: book.outflow ? 'var(--bad)' : undefined },
            { label: L.purchase, value: fmt0(sumKind('purchase')), sub: true },
            { label: L.opex, value: fmt0(sumKind('expense')), sub: true },
            { label: L.losses, value: fmt0(sumKind('loss')), sub: true },
            { label: L.withdrawals, value: fmt0(sumKind('withdrawal')), sub: true },
            { label: L.staffDebtOutstanding, value: fmt0(sumKind('debt')), sub: true },
            { label: L.netMovement, value: fmt0(book.net), color: book.net >= 0 ? 'var(--ok)' : 'var(--bad)', big: true },
          ].map((r) => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: r.sub ? '3px 0 3px 12px' : '7px 0', fontSize: r.big ? 15 : r.sub ? 12.5 : 13.5, borderTop: r.big ? '1px solid var(--line)' : undefined, marginTop: r.big ? 6 : undefined }}>
              <span style={{ color: r.sub ? 'var(--ink3)' : 'var(--ink2)', fontWeight: r.big ? 800 : r.sub ? 600 : 700 }}>{r.label}</span>
              <span style={{ fontWeight: r.sub ? 700 : 800, color: r.color || (r.sub ? 'var(--ink2)' : 'var(--ink)') }}>{r.value}</span>
            </div>
          ))}
          {isCombined && activeBusiness && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600 }}>
              {L.recordsInto} {activeBusiness.name}.
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>{L.recent}</div>
      <div className="card" style={{ padding: 6 }}>
        {bookLedger.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{L.noEntriesYet}</div>
            <div style={{ marginTop: 5, fontSize: 12.5, color: 'var(--ink3)' }}>{L.noEntriesYetSub}</div>
          </div>
        )}
        {bookLedger.map((e, i) => {
          const tv = tintVars(i);
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 8px', borderBottom: i === bookLedger.length - 1 ? 'none' : '1px solid var(--line)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name={KIND_ICON[e.kind]} size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>
                  {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {accountLabel[e.account]}{isCombined ? ` · ${bizName.get(e.business_id) || ''}` : ''}{e.who_name ? ` · ${e.who_name}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: e.amount > 0 ? 'var(--ok)' : e.amount < 0 ? 'var(--ink)' : 'var(--ink3)' }}>
                {e.amount === 0 ? '—' : (e.amount > 0 ? '+' : '−') + short(e.amount)}
              </div>
              {!isCombined && (
                <button
                  className="icon-btn tap"
                  style={{ width: 28, height: 28, flexShrink: 0, color: 'var(--ink3)' }}
                  aria-label={L.deleteEntry}
                  onClick={() => setConfirmDelete(e)}
                >
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <Sheet open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={L.deleteEntry} sub={confirmDelete?.label}>
        {confirmDelete && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--ink2)', fontWeight: 600 }}>{accountLabel[confirmDelete.account]}</span>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{fmt(Math.abs(confirmDelete.amount))}</span>
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--ink2)', lineHeight: 1.5 }}>{L.deleteEntryWarning}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost tap" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>{L.cancel}</button>
              <button
                className="btn-primary tap"
                style={{ flex: 1, background: 'var(--bad)' }}
                data-disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  await deleteLedgerEntry(confirmDelete.id);
                  setDeleting(false);
                  setConfirmDelete(null);
                  flash(L.deletedPermanently);
                }}
              >
                {L.delete}
              </button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={sheetStep !== 'closed'} onClose={() => setSheetStep('closed')} title={sheetStep === 'kinds' ? L.whatHappened : kindLabel[kind]} sub={sheetStep === 'kinds' ? L.whatHappenedSub : undefined}>
        {sheetStep === 'kinds' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {KINDS.map((k, i) => {
              const tv = tintVars(i);
              return (
                <div key={k} className="tap" onClick={() => pickKind(k)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, background: 'var(--card2)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 11, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon name={KIND_ICON[k]} size={16} />
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{kindLabel[k]}</div>
                </div>
              );
            })}
          </div>
        )}

        {sheetStep === 'entry' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['cash', 'mobile', 'bank'] as AccountId[]).map((a) => (
                <button
                  key={a}
                  className="tap"
                  onClick={() => setAccount(a)}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 12.5, fontWeight: 700, background: account === a ? 'var(--brandSoft)' : 'var(--card2)', color: account === a ? 'var(--brand)' : 'var(--ink2)', border: `1.5px solid ${account === a ? 'var(--brand)' : 'transparent'}` }}
                >
                  {accountLabel[a]}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lines.map((line, i) => (
                <div key={i} className="card" style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      inputMode="numeric"
                      placeholder={L.amount}
                      value={line.amount}
                      onChange={(e) => updateLine(i, { amount: e.target.value.replace(/[^0-9]/g, '') })}
                      style={{ border: 'none', background: 'transparent', fontSize: 16, fontWeight: 800 }}
                    />
                    <input
                      placeholder={L.entryNote}
                      value={line.note}
                      onChange={(e) => updateLine(i, { note: e.target.value })}
                      style={{ border: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--ink2)' }}
                    />
                  </div>
                  {lines.length > 1 && (
                    <button className="icon-btn tap" style={{ width: 32, height: 32 }} onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} aria-label={L.removeLine}>
                      <Icon name="x" size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button className="btn-ghost tap" style={{ width: '100%', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setLines((ls) => [...ls, { amount: '', note: '' }])}>
              <Icon name="plus" size={15} />
              {L.addLine}
            </button>

            <button className="btn-primary tap" style={{ width: '100%', marginTop: 14 }} onClick={save}>
              {L.record}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
