import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Icon } from '../lib/icons';

interface Till { till?: string | null; name?: string | null; network?: string | null }

/**
 * When the phone prompt does not arrive: pay Bermi's Lipa Namba from the phone
 * menu, then paste the confirmation code from the mobile-money SMS. Bermi
 * checks the till and switches the plan on — the same as a prompt that went
 * through. Hidden until a till number is set in HQ.
 */
export function ManualPay({ reference, amount, sw }: { reference: string; amount: string; sw: boolean }) {
  const [till, setTill] = useState<Till | null>(null);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void supabase.rpc('manual_pay_info').then(({ data }) => setTill((data as Till) || {}));
  }, []);

  if (!till?.till) return null;

  async function claim() {
    setBusy(true);
    setError('');
    const { error: e } = await supabase.rpc('claim_manual_payment', { p_reference: reference, p_txn_code: code.trim(), p_payer_phone: phone.trim() || null, p_network: till?.network || null });
    setBusy(false);
    if (e) {
      const m = e.message;
      setError(/CODE_REQUIRED/.test(m) ? (sw ? 'Weka msimbo wa muamala kutoka kwenye SMS ya malipo.' : 'Enter the transaction code from your payment SMS.')
        : /CODE_USED/.test(m) ? (sw ? 'Msimbo huu umeshatumika.' : 'That code has already been used.')
        : /ALREADY_CLAIMED/.test(m) ? (sw ? 'Tayari umetuma msimbo kwa malipo haya. Tunauthibitisha.' : 'You already sent a code for this payment. We are checking it.')
        : /ALREADY_PAID/.test(m) ? (sw ? 'Malipo haya yameshapokelewa.' : 'This payment is already received.')
        : m);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="card" style={{ padding: 14, background: 'var(--okSoft)', fontSize: 12.5, fontWeight: 700, color: 'var(--ok)', lineHeight: 1.5 }}>
        {sw ? 'Tumepokea msimbo wako. Tutathibitisha malipo na kuwasha kifurushi — kwa kawaida ndani ya saa moja. Utapata SMS.' : 'Code received. We will confirm the payment and switch your plan on — usually within an hour. You will get an SMS.'}
      </div>
    );
  }

  if (!open) {
    return (
      <button id="manual-pay-open" type="button" className="btn-ghost tap" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setOpen(true)}>
        <Icon name="phone" size={15} /> {sw ? 'Ombi halijafika? Lipa kwa Lipa Namba' : 'No prompt? Pay to our Lipa Namba'}
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{sw ? 'Lipa kwa Lipa Namba' : 'Pay to our Lipa Namba'}</div>
      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.6 }}>
        <li>{sw ? 'Fungua menyu ya pesa kwenye simu yako → Lipa kwa simu / Lipa Namba.' : 'Open your mobile-money menu → Pay by phone / Lipa Namba.'}</li>
        <li>
          {sw ? 'Namba' : 'Number'}: <b style={{ userSelect: 'all' }}>{till.till}</b>
          {till.name ? ` (${till.name})` : ''}{till.network ? ` · ${till.network}` : ''}
        </li>
        <li>{sw ? 'Kiasi' : 'Amount'}: <b>{amount}</b></li>
        <li>{sw ? 'Ukishalipa, bandika msimbo wa muamala kutoka kwenye SMS hapa chini.' : 'When paid, paste the transaction code from the confirmation SMS below.'}</li>
      </ol>
      <input id="manual-pay-code" className="field" placeholder={sw ? 'Msimbo wa muamala, mfano QK72HX9AB1' : 'Transaction code, e.g. QK72HX9AB1'} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      <input className="field" inputMode="tel" placeholder={sw ? 'Namba uliyolipia nayo (si lazima)' : 'Number you paid from (optional)'} value={phone} onChange={(e) => setPhone(e.target.value)} />
      {error && <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--bad)' }}>{error}</div>}
      <button id="manual-pay-send" type="button" className="btn-primary tap" style={{ width: '100%' }} data-disabled={busy || code.trim().length < 6} onClick={() => void claim()}>
        {busy ? '…' : (sw ? 'Tuma msimbo' : 'Send code')}
      </button>
      <div style={{ fontSize: 10.5, color: 'var(--ink3)', fontWeight: 700, userSelect: 'all' }}>{reference}</div>
    </div>
  );
}
