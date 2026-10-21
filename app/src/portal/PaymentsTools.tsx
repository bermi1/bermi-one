import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';

interface Manual { id: string; reference: string; amount: number; network: string | null; payer_phone: string | null; txn_code: string; status: string; created_at: string; owner_name: string | null; plan_code: string | null }
interface Recent { reference: string; amount: number; msisdn: string; status: string; created_at: string; txn: string | null; network: string | null; selcom_ref: string | null; message: string | null; owner_name: string | null }

/**
 * Payments, from the console: where clients pay by hand when the phone prompt
 * fails (Lipa Namba), the codes they sent to confirm or reject, and the last
 * payments with the gateway's own ids — what Payme support asks for.
 */
export function PaymentsTools() {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const [manual, setManual] = useState<Manual[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [till, setTill] = useState({ till: '', name: '', network: '' });
  const [saved, setSaved] = useState<{ till?: string | null; name?: string | null; network?: string | null }>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [{ data, error: e }, { data: info }] = await Promise.all([supabase.rpc('hq_payments_overview'), supabase.rpc('manual_pay_info')]);
    if (e) { setError(e.message); return; }
    const o = data as { manual: Manual[]; recent: Recent[] };
    setManual(o.manual || []);
    setRecent(o.recent || []);
    setSaved((info as typeof saved) || {});
    setError('');
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function saveTill() {
    setBusy('till');
    const { error: e } = await supabase.rpc('hq_set_manual_pay', { p_till: till.till || saved.till || '', p_name: till.name || saved.name || '', p_network: till.network || saved.network || '' });
    setBusy(null);
    if (e) { setError(e.message); return; }
    setTill({ till: '', name: '', network: '' });
    void load();
  }

  async function decide(id: string, approve: boolean) {
    setBusy(id);
    const { error: e } = await supabase.rpc('hq_decide_manual_payment', { p_id: id, p_approve: approve, p_note: null });
    setBusy(null);
    if (e) { setError(e.message); return; }
    void load();
  }

  const waiting = manual.filter((m) => m.status === 'claimed');
  const tone = (st: string) => (/COMPLETED|confirmed/.test(st) ? 'var(--ok)' : /FAILED|CANCELLED|rejected/.test(st) ? 'var(--bad)' : 'var(--warn)');

  return (
    <div className="hq-card" style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, fontWeight: 800 }}>{sw ? 'Malipo kwa mkono (Lipa Namba)' : 'Manual payments (Lipa Namba)'}</div>
        <button className="hq-icon-btn" onClick={() => void load()} aria-label="Refresh"><Icon name="refresh" size={14} /></button>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginTop: 4 }}>
        {saved.till
          ? `${sw ? 'Wateja wanaona' : 'Clients see'}: ${saved.till}${saved.name ? ` (${saved.name})` : ''}${saved.network ? ` · ${saved.network}` : ''}`
          : (sw ? 'Hakuna Lipa Namba bado — chaguo la kulipa kwa mkono limefichwa.' : 'No Lipa Namba yet — the pay-by-hand option is hidden from clients.')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 10 }}>
        <input className="hq-input" placeholder={saved.till || (sw ? 'Lipa Namba / till' : 'Lipa Namba / till')} value={till.till} onChange={(e) => setTill({ ...till, till: e.target.value })} />
        <input className="hq-input" placeholder={saved.name || (sw ? 'Jina linaloonekana' : 'Name it shows')} value={till.name} onChange={(e) => setTill({ ...till, name: e.target.value })} />
        <input className="hq-input" placeholder={saved.network || 'M-Pesa / Mixx / Airtel'} value={till.network} onChange={(e) => setTill({ ...till, network: e.target.value })} />
      </div>
      <button className="hq-nav-item" style={{ marginTop: 8, justifyContent: 'center', background: 'var(--brand)', color: 'var(--brandInk)', fontWeight: 800, width: '100%' }} disabled={busy === 'till' || (!till.till && !till.name && !till.network)} onClick={() => void saveTill()}>
        <Icon name="check" size={14} /> {sw ? 'Hifadhi' : 'Save'}
      </button>

      <div className="hq-section-sub" style={{ marginTop: 16 }}>{sw ? `Za kuthibitisha (${waiting.length})` : `To confirm (${waiting.length})`}</div>
      {waiting.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{sw ? 'Hakuna kwa sasa.' : 'Nothing waiting.'}</div>}
      {waiting.map((m) => (
        <div key={m.id} style={{ padding: '9px 0', borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
          <div><b>{m.owner_name || '—'}</b> · {Number(m.amount).toLocaleString('en-US')} TZS · {m.plan_code || ''}</div>
          <div style={{ color: 'var(--ink2)' }}>
            {sw ? 'Msimbo' : 'Code'}: <b style={{ userSelect: 'all' }}>{m.txn_code}</b>{m.payer_phone ? ` · ${m.payer_phone}` : ''}{m.network ? ` · ${m.network}` : ''} · {new Date(m.created_at).toLocaleString()}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className="hq-nav-item" style={{ flex: 1, justifyContent: 'center', background: 'var(--ok)', color: '#fff', fontWeight: 800 }} disabled={busy === m.id} onClick={() => void decide(m.id, true)}>
              {sw ? 'Thibitisha — pesa imefika' : 'Confirm — money arrived'}
            </button>
            <button className="hq-nav-item" style={{ flex: 1, justifyContent: 'center', fontWeight: 800 }} disabled={busy === m.id} onClick={() => void decide(m.id, false)}>
              {sw ? 'Kataa' : 'Reject'}
            </button>
          </div>
        </div>
      ))}

      <div className="hq-section-sub" style={{ marginTop: 16 }}>{sw ? 'Malipo ya karibuni (kwa Payme)' : 'Recent payments (for Payme support)'}</div>
      {recent.map((r) => (
        <div key={r.reference} style={{ display: 'flex', gap: 10, padding: '7px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
          <span style={{ width: 78, fontWeight: 800, color: tone(r.status) }}>{r.status}</span>
          <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
            <b>{r.owner_name || '—'}</b> · {Number(r.amount).toLocaleString('en-US')} · {r.msisdn}{r.network ? ` · ${r.network}` : ''}
            <span style={{ display: 'block', color: 'var(--ink3)', userSelect: 'all' }}>
              Payme {r.txn || '—'} · Selcom {r.selcom_ref || '—'} · {r.reference}
            </span>
            {r.message && <span style={{ display: 'block', color: 'var(--ink3)' }}>{r.message}</span>}
          </span>
          <span style={{ color: 'var(--ink3)', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString()}</span>
        </div>
      ))}
      {error && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--bad)' }}>{error}</div>}
    </div>
  );
}
