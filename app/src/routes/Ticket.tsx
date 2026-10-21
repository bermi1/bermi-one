import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icon } from '../lib/icons';
import { etaText } from './QueueJoin';

interface Status { number: number; status: string; name: string; services: string | null; barber: string; shop: string; slug: string; day: string; ahead: number; now_serving: number | null; eta_min: number }

/** A customer's live queue ticket: their number, how many are ahead, and roughly when. */
export function Ticket() {
  const { token = '' } = useParams();
  const [sw, setSw] = useState(() => typeof navigator !== 'undefined' && /^sw/i.test(navigator.language || ''));
  const [s, setS] = useState<Status | null | undefined>(undefined);
  const t = (en: string, w: string) => (sw ? w : en);

  useEffect(() => {
    window.__bermiReady?.();
    let on = true;
    const load = () => supabase.rpc('salon_queue_status', { p_token: token }).then(({ data }) => { if (on) setS((data as Status | null) ?? null); });
    void load();
    const i = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 15_000);
    return () => { on = false; clearInterval(i); };
  }, [token]);

  async function leave() {
    await supabase.rpc('salon_queue_leave', { p_token: token });
    const { data } = await supabase.rpc('salon_queue_status', { p_token: token });
    setS(data as Status);
  }

  if (s === undefined) return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><div className="skeleton" style={{ width: 260, height: 220 }} /></div>;
  if (s === null) return <div className="empty" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>{t('This ticket was not found.', 'Tiketi hii haipo.')}</div>;

  const yourTurn = s.status === 'called' || s.status === 'serving';
  const finished = s.status === 'done' || s.status === 'left';
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: 'calc(20px + env(safe-area-inset-top)) 16px 40px' }}>
      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        <div className="s-row" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}><Icon name="scissors" size={16} /> {s.shop}</div>
          <button type="button" className="chip tap" onClick={() => setSw(!sw)}>{sw ? 'English' : 'Kiswahili'}</button>
        </div>
        <div className="card" style={{ marginTop: 16, padding: '26px 20px', textAlign: 'center', background: yourTurn ? 'var(--grad)' : 'var(--card)', color: yourTurn ? '#fff' : 'var(--ink)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 0.6 }}>{t('Your number', 'Namba yako')}</div>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>#{s.number}</div>
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 10 }}>
            {s.status === 'serving' ? t('You are in the chair', 'Uko kitini')
              : s.status === 'called' ? t('It is your turn — please come in!', 'Ni zamu yako — karibu ndani!')
              : s.status === 'done' ? t('Thanks for coming!', 'Asante kwa kuja!')
              : s.status === 'left' ? t('You left the queue', 'Umeondoka kwenye foleni')
              : s.ahead === 0 ? t('You are next', 'Wewe ndiye unayefuata') : t(`${s.ahead} ahead of you`, `Watu ${s.ahead} mbele yako`)}
          </div>
          {s.status === 'waiting' && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink2)', marginTop: 6 }}>{t('Estimated', 'Makadirio')}: {etaText(s.eta_min, sw)}</div>}
        </div>
        <div className="card" style={{ marginTop: 10, padding: 14, fontSize: 13.5, lineHeight: 1.7 }}>
          <div><b>{t('Now serving', 'Sasa inahudumiwa')}:</b> #{s.now_serving ?? '–'}</div>
          <div><b>{t('Name', 'Jina')}:</b> {s.name}</div>
          {s.services && <div><b>{t('Service', 'Huduma')}:</b> {s.services}</div>}
          {s.barber && <div><b>{t('Barber', 'Kinyozi')}:</b> {s.barber}</div>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600, marginTop: 10, textAlign: 'center' }}>{t('This page updates by itself. Keep it open or come back to the link.', 'Ukurasa huu unajisasisha wenyewe. Uache wazi au rudi kwenye link.')}</div>
        {!finished && <button type="button" className="btn-ghost tap" style={{ width: '100%', marginTop: 14, color: 'var(--bad)' }} onClick={leave}>{t('I can’t come — leave the queue', 'Siwezi kuja — ondoka kwenye foleni')}</button>}
        {finished && s.slug && <Link to={`/book/${s.slug}`} className="btn-primary tap" style={{ display: 'block', marginTop: 14 }}>{t('Get a new number', 'Pata namba mpya')}</Link>}
      </div>
    </div>
  );
}
