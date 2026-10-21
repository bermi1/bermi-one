import { useEffect, useMemo, useState } from 'react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Sheet } from '../../components/Sheet';
import { useSettings } from '../../lib/useSettings';
import { useData } from '../../state/DataContext';
import { useSalon } from '../../state/SalonContext';
import { useToast } from '../../state/ToastContext';
import { barberLeaderboard, type SalonVisit } from '../../lib/salon';
import type { LedgerEntry } from '../../lib/types';

type Period = 'week' | 'month' | 'last';

function range(p: Period) {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  if (p === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (p === 'month') start.setDate(1);
  if (p === 'last') { start.setDate(1); start.setMonth(start.getMonth() - 1); const end = new Date(start); end.setMonth(end.getMonth() + 1); end.setMilliseconds(-1); return { from: start, to: end }; }
  return { from: start, to: now };
}

const PREFIX = 'Payout · ';

/**
 * What each barber has earned and what they have been paid.
 *
 * Earned is the commission stamped on every visit (service share plus tips).
 * Paid is the "Payout · <name>" expenses in the cash book over the same period,
 * so paying a barber here and recording the expense are one and the same act.
 */
export function Payouts() {
  const { lang, fmt } = useSettings();
  const sw = lang === 'sw';
  const { activeBusiness, fetchReportSource, addLedgerLines } = useData();
  const { fetchVisits } = useSalon();
  const { flash } = useToast();
  const [period, setPeriod] = useState<Period>('week');
  const [visits, setVisits] = useState<SalonVisit[] | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [paying, setPaying] = useState<{ id: string | null; name: string; due: number } | null>(null);
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState<'cash' | 'mobile' | 'bank'>('cash');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!activeBusiness) return;
    const { from, to } = range(period);
    setVisits(null);
    void Promise.all([
      fetchVisits(from.toISOString(), to.toISOString()),
      fetchReportSource([activeBusiness.id], from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)),
    ]).then(([v, src]) => { setVisits(v); setLedger(src.ledger); });
  }, [period, activeBusiness, fetchVisits, fetchReportSource, tick]);

  const rows = useMemo(() => barberLeaderboard(visits || []).filter((r) => r.id), [visits]);
  const paidTo = (name: string) => ledger.filter((l) => l.kind === 'expense' && l.label === PREFIX + name).reduce((s, l) => s + Math.abs(l.amount), 0);

  async function pay() {
    if (!paying) return;
    const n = Number(amount);
    if (!(n > 0)) return;
    await addLedgerLines([{ kind: 'expense', label: PREFIX + paying.name, amount: -n, account }]);
    flash(sw ? `Umemlipa ${paying.name.split(' ')[0]} ${fmt(n)}` : `Paid ${paying.name.split(' ')[0]} ${fmt(n)}`);
    setPaying(null);
    setTick((t) => t + 1);
  }

  return (
    <div className="screen sb">
      <ScreenHeader back title={sw ? 'Malipo ya vinyozi' : 'Barber payouts'} sub={sw ? 'Kamisheni na bakshishi walizopata dhidi ya walicholipwa' : 'Commission and tips earned, against what has been paid'} />
      <div className="s-seg">
        <button type="button" aria-pressed={period === 'week'} onClick={() => setPeriod('week')}>{sw ? 'Wiki hii' : 'This week'}</button>
        <button type="button" aria-pressed={period === 'month'} onClick={() => setPeriod('month')}>{sw ? 'Mwezi huu' : 'This month'}</button>
        <button type="button" aria-pressed={period === 'last'} onClick={() => setPeriod('last')}>{sw ? 'Mwezi uliopita' : 'Last month'}</button>
      </div>
      {visits === null ? <div className="skeleton" style={{ height: 160, marginTop: 12 }} /> : rows.length === 0 ? (
        <div className="card" style={{ marginTop: 12, padding: 22, textAlign: 'center', color: 'var(--ink3)', fontSize: 13, fontWeight: 700 }}>
          {sw ? 'Hakuna mauzo yenye kinyozi katika kipindi hiki.' : 'No sales with a barber in this period.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {rows.map((r) => {
            const paid = paidTo(r.name);
            const due = Math.max(0, r.commission - paid);
            return (
              <div key={r.id} className="card" style={{ padding: 14 }}>
                <div className="s-row" style={{ justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{r.name}</div>
                  <span className="s-badge" style={{ background: due ? 'var(--warnSoft)' : 'var(--okSoft)', color: due ? 'var(--warn)' : 'var(--ok)' }}>{due ? (sw ? 'Anadai' : 'Owed') : (sw ? 'Amelipwa' : 'Settled')}</span>
                </div>
                <div className="s-kpis" style={{ marginTop: 10 }}>
                  <div className="s-kpi" style={{ boxShadow: 'none', background: 'var(--card2)' }}><span>{sw ? 'Mauzo' : 'Sales'}</span><b>{fmt(r.revenue)}</b></div>
                  <div className="s-kpi" style={{ boxShadow: 'none', background: 'var(--card2)' }}><span>{sw ? 'Amepata' : 'Earned'}</span><b>{fmt(r.commission)}</b></div>
                  <div className="s-kpi" style={{ boxShadow: 'none', background: 'var(--card2)' }}><span>{sw ? 'Amelipwa' : 'Paid'}</span><b>{fmt(paid)}</b></div>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700, marginTop: 8 }}>
                  {r.clients} {sw ? 'wateja' : 'clients'} · {sw ? 'wastani' : 'avg'} {fmt(r.avgTicket)} · {sw ? 'bakshishi' : 'tips'} {fmt(r.tips)}
                </div>
                {due > 0 && (
                  <button type="button" className="btn-primary tap" style={{ width: '100%', marginTop: 10, border: 'none', padding: 12 }} onClick={() => { setPaying({ id: r.id, name: r.name, due }); setAmount(String(due)); }}>
                    {sw ? 'Lipa' : 'Pay'} {fmt(due)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Sheet open={!!paying} onClose={() => setPaying(null)} title={paying ? `${sw ? 'Mlipe' : 'Pay'} ${paying.name}` : ''} sub={sw ? 'Itarekodiwa kama matumizi kwenye cash book' : 'Recorded as an expense in the cash book'}>
        <input className="s-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
        <div className="s-seg" style={{ marginTop: 10 }}>
          <button type="button" aria-pressed={account === 'cash'} onClick={() => setAccount('cash')}>{sw ? 'Cash' : 'Cash'}</button>
          <button type="button" aria-pressed={account === 'mobile'} onClick={() => setAccount('mobile')}>{sw ? 'Mobile' : 'Mobile'}</button>
          <button type="button" aria-pressed={account === 'bank'} onClick={() => setAccount('bank')}>{sw ? 'Bank' : 'Bank'}</button>
        </div>
        <button type="button" className="btn-primary tap" style={{ width: '100%', marginTop: 14, border: 'none' }} onClick={pay}>{sw ? 'Thibitisha malipo' : 'Confirm payout'}</button>
      </Sheet>
    </div>
  );
}
