import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Icon } from '../lib/icons';

type State =
  | { at: 'idle' }
  | { at: 'sending' }
  | { at: 'waiting'; id: string; since: number }
  | { at: 'sent' }
  | { at: 'failed'; why: string }
  | { at: 'off' }
  | { at: 'error'; why: string };

/**
 * "Send me a test SMS" — the owner's proof that alerts actually reach the
 * phone. The message goes through the real outbox and worker, and this watches
 * the row until it is sent or refused, then says which in plain words. A
 * setting that might or might not work is worse than no setting.
 */
export function TestSms({ businessId, phone, sw }: { businessId: string; phone: string | null | undefined; sw: boolean }) {
  const [s, setS] = useState<State>({ at: 'idle' });
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (s.at !== 'waiting') return;
    const poll = async () => {
      const [{ data: row }, { data: status }] = await Promise.all([
        supabase.from('notifications').select('status, provider_message').eq('id', s.id).maybeSingle(),
        supabase.rpc('sms_status'),
      ]);
      const r = row as { status: string; provider_message: string | null } | null;
      if (r?.status === 'sent') { setS({ at: 'sent' }); return; }
      if (r?.status === 'failed' || (r?.status === 'queued' && r.provider_message)) { setS({ at: 'failed', why: r.provider_message || '' }); return; }
      // The worker runs every minute and says whether it has an SMS key at all.
      const st = status as { sms?: boolean; checked_at?: string } | null;
      if (st?.checked_at && new Date(st.checked_at).getTime() > s.since && st.sms === false) { setS({ at: 'off' }); return; }
      if (Date.now() - s.since > 150_000) { setS({ at: 'failed', why: sw ? 'Hakuna jibu baada ya dakika 2.' : 'No answer after 2 minutes.' }); return; }
      timer.current = window.setTimeout(poll, 5000);
    };
    timer.current = window.setTimeout(poll, 4000);
    return () => window.clearTimeout(timer.current);
  }, [s, sw]);

  async function send() {
    setS({ at: 'sending' });
    const { data, error } = await supabase.rpc('queue_test_sms', { p_business: businessId });
    if (error) {
      const why = /NO_ALERTS_PHONE/.test(error.message) ? (sw ? 'Weka namba ya simu ya taarifa kwanza.' : 'Add the alerts phone number first.')
        : /TOO_MANY_TESTS/.test(error.message) ? (sw ? 'Majaribio 3 kwa saa tayari. Jaribu baadaye.' : 'Three tests an hour already. Try again later.')
        : error.message;
      setS({ at: 'error', why });
      return;
    }
    setS({ at: 'waiting', id: data as string, since: Date.now() });
  }

  const busy = s.at === 'sending' || s.at === 'waiting';
  const tone = s.at === 'sent' ? 'var(--ok)' : s.at === 'failed' || s.at === 'error' || s.at === 'off' ? 'var(--bad)' : 'var(--ink2)';
  const line = s.at === 'sending' ? (sw ? 'Inatuma…' : 'Sending…')
    : s.at === 'waiting' ? (sw ? `Inasubiri mtoa huduma wa SMS… (hadi dakika 1)` : 'Waiting for the SMS provider… (up to a minute)')
    : s.at === 'sent' ? (sw ? `Imetumwa kwa ${phone}. Angalia simu yako.` : `Sent to ${phone}. Check your phone.`)
    : s.at === 'off' ? (sw ? 'Utumaji wa SMS bado haujawashwa na Bermi. Ujumbe wako umehifadhiwa na utatumwa ukiwashwa.' : 'SMS sending is not switched on by Bermi yet. Your message is kept and goes out as soon as it is.')
    : s.at === 'failed' ? `${sw ? 'Mtoa huduma amekataa' : 'The SMS provider refused it'}: ${s.why}`
    : s.at === 'error' ? s.why : '';

  return (
    <div style={{ marginTop: 10 }}>
      <button type="button" className="btn-ghost tap" disabled={busy || !phone?.trim()} onClick={send}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: !phone?.trim() ? 0.5 : 1 }}>
        <Icon name="chat" size={15} /> {busy ? (sw ? 'Inatuma SMS ya majaribio…' : 'Sending test SMS…') : (sw ? 'Nitumie SMS ya majaribio' : 'Send me a test SMS')}
      </button>
      {line && <div role="status" style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: tone, lineHeight: 1.5 }}>{line}</div>}
    </div>
  );
}
