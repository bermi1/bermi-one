import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { fetchPaymeBalance, fetchPayouts, lookupWallet, withdrawPayme, type PayoutRow } from '../lib/platform';

const NETWORKS: { code: string; label: string }[] = [
  { code: 'CASHIN', label: 'Auto' }, { code: 'vodacom', label: 'M-Pesa' }, { code: 'airtel', label: 'Airtel Money' },
  { code: 'tigo', label: 'Mixx by Yas' }, { code: 'halotel', label: 'HaloPesa' }, { code: 'ttcl', label: 'T-Pesa' },
];

/**
 * Withdraw what clients have paid from the Payme balance to a mobile-money
 * wallet. Two steps on purpose: fill in and check the name, then type the
 * amount again to send. The function re-checks everything — this screen only
 * makes the honest path the easy one.
 */
export function WithdrawTools() {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const [balance, setBalance] = useState<number | null>(null);
  const [sandbox, setSandbox] = useState(false);
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [phone, setPhone] = useState('');
  const [network, setNetwork] = useState('CASHIN');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [b, p] = await Promise.all([fetchPaymeBalance(), fetchPayouts()]);
      setBalance(b.balance); setSandbox(b.sandbox); setRows(p);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const amt = Math.floor(Number(amount.replace(/[^0-9]/g, '')) || 0);
  const tooMuch = balance !== null && amt > balance;
  const ready = amt > 0 && !tooMuch && phone.replace(/[^0-9]/g, '').length >= 9;
  const fmt = (n: number) => `TSh ${n.toLocaleString('en-US')}`;

  async function checkName() {
    setBusy('lookup'); setError('');
    try {
      const r = await lookupWallet(phone, network);
      setName(r.name);
      if (!r.name) setNotice(sw ? 'Jina halikupatikana — hakikisha namba kabla ya kutuma.' : 'No name came back — double-check the number before sending.');
      else setNotice('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
  }

  async function send() {
    setBusy('send'); setError(''); setNotice('');
    try {
      const r = await withdrawPayme({ amount: amt, confirm, msisdn: phone, channel: network, recipient_name: name || undefined, notes: note || undefined });
      setNotice(r.status === 'FAILED'
        ? (sw ? `Imeshindikana: ${r.message || r.reference}` : `Failed: ${r.message || r.reference}`)
        : r.status === 'COMPLETED'
          ? (sw ? `Imetumwa ${fmt(amt)} · ${r.reference}` : `Sent ${fmt(amt)} · ${r.reference}`)
          : (sw ? `Inashughulikiwa · ${r.reference}` : `Processing · ${r.reference}`));
      setConfirming(false); setConfirm(''); setAmount(''); setNote('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
    void load();
  }

  const tone = (st: string) => (st === 'COMPLETED' ? 'var(--ok)' : st === 'FAILED' ? 'var(--bad)' : 'var(--warn)');

  return (
    <div id="withdraw-tools" className="hq-card" style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, fontWeight: 800 }}>{sw ? 'Toa pesa (Payme → mobile money)' : 'Withdraw (Payme → mobile money)'}</div>
        <button className="hq-icon-btn" onClick={() => void load()} aria-label="Refresh"><Icon name="refresh" size={14} /></button>
      </div>
      <div id="payme-balance" style={{ marginTop: 6, fontSize: 22, fontWeight: 800 }}>
        {balance === null ? '…' : fmt(balance)}
        {sandbox && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, color: 'var(--warn)' }}>SANDBOX</span>}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{sw ? 'Iliyopo kwenye Payme sasa hivi (ada za kutoa zinakatwa na Payme)' : 'Available on Payme right now (Payme deducts its payout fee)'}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 12 }}>
        <input className="hq-input" inputMode="tel" placeholder={sw ? 'Namba ya simu' : 'Phone number'} value={phone} onChange={(e) => { setPhone(e.target.value); setName(null); }} />
        <select className="hq-input" value={network} onChange={(e) => { setNetwork(e.target.value); setName(null); }}>
          {NETWORKS.map((n) => <option key={n.code} value={n.code}>{n.label}</option>)}
        </select>
        <input className="hq-input" inputMode="numeric" placeholder={sw ? 'Kiasi (TSh)' : 'Amount (TSh)'} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className="hq-input" placeholder={sw ? 'Maelezo (si lazima)' : 'Note (optional)'} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {tooMuch && <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--bad)' }}>{sw ? `Zipo ${fmt(balance!)} tu.` : `Only ${fmt(balance!)} is available.`}</div>}
      {name && <div id="wallet-name" style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--ok)' }}>{sw ? 'Jina' : 'Name'}: {name}</div>}

      {!confirming ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="hq-nav-item" style={{ flex: 1, justifyContent: 'center', fontWeight: 800 }} disabled={!phone || busy === 'lookup'} onClick={() => void checkName()}>
            {busy === 'lookup' ? '…' : (sw ? 'Angalia jina' : 'Check name')}
          </button>
          <button id="withdraw-next" className="hq-nav-item" style={{ flex: 1, justifyContent: 'center', background: 'var(--brand)', color: 'var(--brandInk)', fontWeight: 800 }} disabled={!ready} onClick={() => { setConfirming(true); setConfirm(''); }}>
            {sw ? 'Endelea' : 'Continue'}
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'var(--card2)' }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>
            {sw ? `Tuma ${fmt(amt)} kwenda ${name || phone}?` : `Send ${fmt(amt)} to ${name || phone}?`}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 2 }}>{sw ? 'Andika kiasi tena kuthibitisha. Pesa ikishatoka hairudi.' : 'Type the amount again to confirm. Money sent cannot be pulled back.'}</div>
          <input id="withdraw-confirm" className="hq-input" inputMode="numeric" style={{ marginTop: 8, width: '100%' }} placeholder={String(amt)} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="hq-nav-item" style={{ flex: 1, justifyContent: 'center', fontWeight: 800 }} onClick={() => setConfirming(false)}>{sw ? 'Ghairi' : 'Cancel'}</button>
            <button id="withdraw-send" className="hq-nav-item" style={{ flex: 1, justifyContent: 'center', background: 'var(--bad)', color: '#fff', fontWeight: 800 }}
              disabled={busy === 'send' || confirm.replace(/[^0-9]/g, '') !== String(amt)} onClick={() => void send()}>
              {busy === 'send' ? '…' : (sw ? 'Toa pesa' : 'Withdraw')}
            </button>
          </div>
        </div>
      )}
      {notice && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700 }}>{notice}</div>}
      {error && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--bad)' }}>{error}</div>}

      <div className="hq-section-sub" style={{ marginTop: 16 }}>{sw ? 'Zilizotolewa karibuni' : 'Recent withdrawals'}</div>
      {rows.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{sw ? 'Bado hakuna.' : 'None yet.'}</div>}
      {rows.map((r) => (
        <div key={r.reference} style={{ display: 'flex', gap: 10, padding: '7px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
          <span style={{ width: 78, fontWeight: 800, color: tone(r.status) }}>{r.status}</span>
          <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
            <b>{fmt(Number(r.amount))}</b> → {r.recipient_name ? `${r.recipient_name} · ` : ''}{r.msisdn}{r.sandbox ? ' · sandbox' : ''}
            <span style={{ display: 'block', color: 'var(--ink3)', userSelect: 'all' }}>{r.reference}{r.transaction_id ? ` · Payme ${r.transaction_id}` : ''}</span>
            {r.provider_message && <span style={{ display: 'block', color: 'var(--ink3)' }}>{r.provider_message}</span>}
          </span>
          <span style={{ color: 'var(--ink3)', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
