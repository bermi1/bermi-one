import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icon } from '../lib/icons';

interface QueueInfo { open: boolean; hours: [string, string] | null; now_serving: number | null; waiting: number; eta_min: number; barbers: number }
const ERR: Record<string, [string, string]> = {
  CLOSED_TODAY: ['The shop is closed today.', 'Duka limefungwa leo.'],
  TOO_MANY_REQUESTS: ['You already have a number for today.', 'Tayari una namba ya leo.'],
  NAME_REQUIRED: ['Please enter your name.', 'Tafadhali weka jina lako.'],
  PHONE_REQUIRED: ['Please enter your phone number.', 'Tafadhali weka namba ya simu.'],
};

export function etaText(min: number, sw: boolean) {
  if (min <= 0) return sw ? 'Sasa hivi' : 'Right away';
  const at = new Date(Date.now() + min * 60000);
  const hm = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  return sw ? `~dakika ${min} (karibu ${hm})` : `~${min} min (around ${hm})`;
}

/**
 * Join today's queue: no account, no code. See how busy it is, leave a name and
 * number, get a ticket number — then come in when it is nearly your turn.
 */
export function QueueJoin({ slug, sw, services, barbers }: { slug: string; sw: boolean; services: { id: string; name: string; duration_min: number }[]; barbers: { id: string; name: string }[] }) {
  const nav = useNavigate();
  const t = (en: string, s: string) => (sw ? s : en);
  const [info, setInfo] = useState<QueueInfo | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [barber, setBarber] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let on = true;
    const load = () => supabase.rpc('salon_queue_public', { p_slug: slug }).then(({ data }) => { if (on) setInfo(data as QueueInfo | null); });
    void load();
    const i = setInterval(load, 20_000);
    return () => { on = false; clearInterval(i); };
  }, [slug]);

  async function join() {
    setError('');
    setBusy(true);
    const { data, error: e } = await supabase.rpc('salon_queue_join', { p_slug: slug, p_name: name, p_phone: phone, p_service_ids: picked, p_barber: barber });
    setBusy(false);
    if (e) {
      const code = Object.keys(ERR).find((k) => e.message.includes(k));
      setError(code ? ERR[code][sw ? 1 : 0] : t('Something went wrong. Try again.', 'Imeshindikana. Jaribu tena.'));
      return;
    }
    const token = (data as { token: string }).token;
    try { localStorage.setItem(`bermi:ticket:${slug}`, token); } catch { /* keep going */ }
    nav(`/q/${token}`);
  }

  if (info === null) return <div className="skeleton" style={{ height: 160, marginTop: 16 }} />;
  if (!info.open) return <div className="card empty" style={{ marginTop: 16 }}>{t('Closed today — come back tomorrow.', 'Imefungwa leo — karibu kesho.')}</div>;

  return (
    <>
      <div className="card" style={{ marginTop: 16, padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
        <div><div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink3)' }}>{t('NOW SERVING', 'SASA')}</div><div style={{ fontSize: 26, fontWeight: 800, color: 'var(--brand)' }}>#{info.now_serving ?? '–'}</div></div>
        <div><div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink3)' }}>{t('WAITING', 'WANASUBIRI')}</div><div style={{ fontSize: 26, fontWeight: 800 }}>{info.waiting}</div></div>
        <div><div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink3)' }}>{t('WAIT', 'MUDA')}</div><div style={{ fontSize: 15, fontWeight: 800, marginTop: 6 }}>{info.eta_min ? `~${info.eta_min} min` : t('None', 'Hakuna')}</div></div>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink2)', fontWeight: 600, marginTop: 8, textAlign: 'center' }}>
        {info.hours ? `${t('Open today', 'Leo tunafungua')} ${info.hours[0]}–${info.hours[1]}` : ''}
      </div>

      <div className="section-label">{t('What are you coming for? (optional)', 'Unakuja kwa huduma gani? (hiari)')}</div>
      <div className="s-chipset">
        {services.map((s) => (
          <button key={s.id} type="button" aria-pressed={picked.includes(s.id)} onClick={() => setPicked((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))}>{s.name}</button>
        ))}
      </div>
      {barbers.length > 1 && (
        <>
          <div className="section-label">{t('Barber', 'Kinyozi')}</div>
          <div className="s-chipset">
            <button type="button" aria-pressed={barber === null} onClick={() => setBarber(null)}>{t('First free', 'Yeyote wa kwanza')}</button>
            {barbers.map((b) => <button key={b.id} type="button" aria-pressed={barber === b.id} onClick={() => setBarber(b.id)}>{b.name}</button>)}
          </div>
        </>
      )}
      <div className="section-label">{t('Your details', 'Taarifa zako')}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        <input className="field" autoComplete="name" placeholder={t('Your name', 'Jina lako')} value={name} onChange={(e) => setName(e.target.value)} />
        <input className="field" autoComplete="tel" inputMode="tel" placeholder={t('Phone', 'Simu')} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      {error && <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--badSoft)', color: 'var(--bad)', fontSize: 13, fontWeight: 700 }}>{error}</div>}
      <button type="button" className="btn-primary tap" style={{ width: '100%', marginTop: 14, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        data-disabled={busy || name.trim().length < 2 || phone.replace(/\D/g, '').length < 9} onClick={join}>
        <Icon name="users" size={16} /> {busy ? '…' : t('Get my number', 'Nipe namba yangu')}
      </button>
      <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600, marginTop: 8, textAlign: 'center' }}>{t('No account or code needed. Come in when your number is close.', 'Hakuna akaunti wala msimbo. Njoo namba yako ikikaribia.')}</div>
    </>
  );
}
