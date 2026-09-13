import { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { KIND_ICON, KIND_SIGN, tintVars, type AccountId, type EntryKind } from '../lib/types';

const KINDS: EntryKind[] = ['sale', 'payment', 'purchase', 'expense', 'withdrawal', 'loss', 'debt'];

interface Line {
  amount: string;
  note: string;
}

export function Money() {
  const { L, fmt, short, owner, lang } = useSettings();
  const { accounts, ledger, addLedgerLines } = useData();
  const { flash } = useToast();

  const [sheetStep, setSheetStep] = useState<'closed' | 'kinds' | 'entry'>('closed');
  const [kind, setKind] = useState<EntryKind>('expense');
  const [account, setAccount] = useState<AccountId>('cash');
  const [lines, setLines] = useState<Line[]>([{ amount: '', note: '' }]);

  const kindLabel: Record<EntryKind, string> = {
    sale: L.sale, payment: L.payment, purchase: L.purchase, expense: L.expense, withdrawal: L.withdrawal, loss: L.rLoss, stock: L.stock, debt: L.rDebt,
  };
  const accountLabel: Record<AccountId, string> = { cash: L.cash, mobile: L.mobileMoney, bank: L.bank };

  const opexToday = useMemo(() => ledger.filter((e) => e.kind === 'expense').reduce((s, e) => s + Math.abs(e.amount), 0), [ledger]);
  const lossesToday = useMemo(() => ledger.filter((e) => e.kind === 'loss').reduce((s, e) => s + Math.abs(e.amount), 0), [ledger]);
  const debtToday = useMemo(() => ledger.filter((e) => e.kind === 'debt').reduce((s, e) => s + Math.abs(e.amount), 0), [ledger]);
  const draws = useMemo(() => ledger.filter((e) => e.kind === 'withdrawal').reduce((s, e) => s + Math.abs(e.amount), 0), [ledger]);
  const salesTotal = useMemo(() => ledger.filter((e) => e.kind === 'sale' || e.kind === 'payment').reduce((s, e) => s + e.amount, 0), [ledger]);
  const cogsEst = Math.round(salesTotal * 0.6);
  const net = salesTotal - cogsEst - opexToday - lossesToday;

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
      <ScreenHeader title={L.money} sub={owner ? L.todayAccount : L.myEntries} right={
        <button className="icon-btn tap" onClick={openKindPicker} aria-label={L.add}>
          <Icon name="plus" />
        </button>
      } />

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
              <div style={{ marginTop: 3, fontSize: 14, fontWeight: 800 }}>{short(accounts ? accounts[id] : 0)}</div>
            </div>
          );
        })}
      </div>

      {owner && (
        <div className="card" style={{ padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>{L.todayAccount}</div>
          {[
            { label: L.revenue, value: fmt(salesTotal) },
            { label: '− ' + L.costOfSales, value: fmt(cogsEst) },
            { label: '− ' + L.opex, value: fmt(opexToday) },
            ...(lossesToday > 0 ? [{ label: '− ' + L.losses, value: fmt(lossesToday) }] : []),
            { label: '= ' + L.netProfit, value: fmt(net), color: net >= 0 ? 'var(--ok)' : 'var(--bad)', big: true },
            { label: L.withdrawals, value: fmt(draws) },
            ...(debtToday > 0 ? [{ label: L.staffDebtOutstanding, value: fmt(debtToday) }] : []),
          ].map((r) => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: r.big ? 15 : 13.5 }}>
              <span style={{ color: 'var(--ink2)', fontWeight: r.big ? 800 : 600 }}>{r.label}</span>
              <span style={{ fontWeight: 800, color: r.color || 'var(--ink)' }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>{L.recent}</div>
      <div className="card" style={{ padding: 6 }}>
        {ledger.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>{L.entries}: 0</div>}
        {ledger.map((e, i) => {
          const tv = tintVars(i);
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 8px', borderBottom: i === ledger.length - 1 ? 'none' : '1px solid var(--line)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name={KIND_ICON[e.kind]} size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>
                  {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {accountLabel[e.account]} {e.who_name ? `· ${e.who_name}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: e.amount > 0 ? 'var(--ok)' : e.amount < 0 ? 'var(--ink)' : 'var(--ink3)' }}>
                {e.amount === 0 ? '—' : (e.amount > 0 ? '+' : '−') + short(e.amount)}
              </div>
            </div>
          );
        })}
      </div>

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
