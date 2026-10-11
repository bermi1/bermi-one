import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icon } from '../lib/icons';
import { formatMoney, countryByCode } from '../lib/countries';
import { hhmm, localDate, waLink } from '../lib/salon';

interface PublicShop {
  name: string;
  city: string | null;
  country_code: string;
  tz: string;
  phone: string | null;
  hours: Record<string, [string | null, string | null] | null>;
  services: { id: string; name: string; category: string; price: number; duration_min: number }[];
  barbers: { id: string; name: string }[];
}

const ERR: Record<string, [string, string]> = {
  SLOT_TAKEN: ['Someone just took that time. Please pick another.', 'Mtu amechukua muda huo sasa hivi. Chagua mwingine.'],
  SLOT_UNAVAILABLE: ['That time is not available. Please pick another.', 'Muda huo haupatikani. Chagua mwingine.'],
  TOO_MANY_REQUESTS: ['You already have requests waiting. The shop will confirm them soon.', 'Una maombi yanayosubiri. Duka litayathibitisha hivi karibuni.'],
  NAME_REQUIRED: ['Please enter your name.', 'Tafadhali weka jina lako.'],
  PHONE_REQUIRED: ['Please enter a phone number we can reach you on.', 'Tafadhali weka namba ya simu.'],
  SERVICE_REQUIRED: ['Pick at least one service.', 'Chagua angalau huduma moja.'],
};

function addDays(n: number) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d; }

/**
 * The shop's own booking page, for its clients. No account, no app: open the
 * link from Instagram or WhatsApp, pick a cut, a barber and a time, leave a
 * name and number. The request lands in the shop's Bookings for them to confirm.
 */
export function Book() {
  const { slug = '' } = useParams();
  const [sw, setSw] = useState(() => typeof navigator !== 'undefined' && /^sw/i.test(navigator.language || ''));
  const [shop, setShop] = useState<PublicShop | null | undefined>(undefined);
  const [picked, setPicked] = useState<string[]>([]);
  const [barber, setBarber] = useState<string | null>(null);
  const [day, setDay] = useState(addDays(0));
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ start_at: string; services: string; barber: string | null; estimate: number } | null>(null);

  useEffect(() => {
    window.__bermiReady?.();
    document.title = 'Book · Bermi One';
    void supabase.rpc('salon_public', { p_slug: slug }).then(({ data, error: e }) => setShop(e ? null : (data as PublicShop | null)));
  }, [slug]);

  const minutes = useMemo(() => (shop?.services || []).filter((s) => picked.includes(s.id)).reduce((m, s) => m + s.duration_min, 0), [shop, picked]);
  const estimate = useMemo(() => (shop?.services || []).filter((s) => picked.includes(s.id)).reduce((m, s) => m + Number(s.price), 0), [shop, picked]);
  const money = (n: number) => formatMoney(n, countryByCode(shop?.country_code || 'TZ'));

  // Keyed on the date string, so tapping the day already chosen does not wipe the chosen time.
  const dayKey = localDate(day);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    setSlot(null);
    setSlots(null);
    if (!shop || !minutes) return;
    let stale = false;
    void supabase.rpc('salon_slots', { p_slug: slug, p_date: dayKey, p_duration: minutes, p_barber: barber })
      .then(({ data }) => { if (!stale) setSlots(((data as string[] | null) || [])); });
    return () => { stale = true; };
  }, [shop, slug, dayKey, minutes, barber, refresh]);

  async function submit() {
    setError('');
    if (!slot) return;
    setBusy(true);
    const { data, error: e } = await supabase.rpc('salon_book', {
      p_slug: slug, p_service_ids: picked, p_barber: barber, p_start: slot, p_name: name, p_phone: phone, p_note: note || null,
    });
    setBusy(false);
    if (e) {
      const code = Object.keys(ERR).find((k) => e.message.includes(k));
      setError(code ? ERR[code][sw ? 1 : 0] : (sw ? 'Imeshindikana. Jaribu tena.' : 'Something went wrong. Please try again.'));
      if (code === 'SLOT_TAKEN') setRefresh((n) => n + 1);
      return;
    }
    setDone(data as typeof done);
  }

  const t = (en: string, s: string) => (sw ? s : en);
  const days = Array.from({ length: 14 }, (_, i) => addDays(i));

  if (shop === undefined) return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}><div className="skeleton" style={{ width: 280, height: 160 }} /></div>;
  if (shop === null) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)', textAlign: 'center' }}>
        <div><Icon name="scissors" size={34} /><div style={{ fontSize: 18, fontWeight: 800, marginTop: 10 }}>{t('This booking link is not active', 'Kiungo hiki cha miadi hakifanyi kazi')}</div>
          <div style={{ fontSize: 13, color: 'var(--ink2)', marginTop: 6 }}>{t('Ask the shop for its current link.', 'Uliza duka kiungo chake kipya.')}</div></div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--grad)', color: '#fff', padding: 'calc(28px + env(safe-area-inset-top)) 20px 26px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,.1)', top: -80, right: -60 }} />
        <div style={{ maxWidth: 560, margin: '0 auto', position: 'relative' }}>
          <div className="s-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center' }}><Icon name="scissors" size={20} /></span>
            <button type="button" className="chip tap" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', border: 'none' }} onClick={() => setSw(!sw)}>{sw ? 'English' : 'Kiswahili'}</button>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.6, marginTop: 14 }}>{shop.name}</div>
          <div style={{ fontSize: 13.5, opacity: 0.85, fontWeight: 600, marginTop: 2 }}>{shop.city ? `${shop.city} · ` : ''}{t('Book your next visit', 'Weka miadi yako')}</div>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '8px 16px 48px' }}>
        {done ? (
          <div className="card" style={{ marginTop: 18, padding: 22, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--okSoft)', color: 'var(--ok)', display: 'grid', placeItems: 'center', margin: '0 auto' }}><Icon name="check" size={26} /></div>
            <div style={{ fontSize: 19, fontWeight: 800, marginTop: 12 }}>{t('Request sent', 'Ombi limetumwa')}</div>
            <div style={{ fontSize: 14, color: 'var(--ink2)', marginTop: 8, lineHeight: 1.6 }}>
              {done.services}<br />
              <b>{new Date(done.start_at).toLocaleString(sw ? 'sw-TZ' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</b>
              {done.barber ? <><br />{t('with', 'na')} {done.barber.split(' ')[0]}</> : null}
              {done.estimate ? <><br />~{money(done.estimate)}</> : null}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 12, fontWeight: 600 }}>{t('The shop will confirm your booking.', 'Duka litathibitisha miadi yako.')}</div>
            {shop.phone && (
              <a className="btn-ghost tap" style={{ display: 'block', marginTop: 14 }} target="_blank" rel="noreferrer"
                href={waLink(shop.phone, t(`Hi, I just booked ${done.services} for ${hhmm(done.start_at)} — ${name}`, `Habari, nimeweka miadi ya ${done.services} saa ${hhmm(done.start_at)} — ${name}`), shop.country_code)}>
                {t('Message the shop on WhatsApp', 'Tuma ujumbe kwa duka WhatsApp')}
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="s-label">1 · {t('Choose services', 'Chagua huduma')}</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {shop.services.map((s) => {
                const on = picked.includes(s.id);
                return (
                  <button key={s.id} type="button" className="s-svc tap" aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))}>
                    <span style={{ width: 20, height: 20, borderRadius: 7, border: `2px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand)' : 'transparent', display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0 }}>{on && <Icon name="check" size={12} />}</span>
                    <span style={{ flex: 1 }}><b style={{ fontSize: 14.5 }}>{s.name}</b><br /><span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 700 }}>{s.duration_min} {t('min', 'dakika')}</span></span>
                    <b>{money(Number(s.price))}</b>
                  </button>
                );
              })}
            </div>

            {picked.length > 0 && (
              <>
                {shop.barbers.length > 0 && (
                  <>
                    <div className="s-label">2 · {t('Barber', 'Kinyozi')}</div>
                    <div className="s-chipset">
                      <button type="button" aria-pressed={barber === null} onClick={() => setBarber(null)}>{t('Any barber', 'Yeyote')}</button>
                      {shop.barbers.map((b) => <button key={b.id} type="button" aria-pressed={barber === b.id} onClick={() => setBarber(b.id)}>{b.name}</button>)}
                    </div>
                  </>
                )}
                <div className="s-label">{shop.barbers.length ? 3 : 2} · {t('Day and time', 'Siku na muda')}</div>
                <div className="s-chipset" style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 4 }}>
                  {days.map((d) => (
                    <button key={d.toISOString()} type="button" style={{ flexShrink: 0 }} aria-pressed={localDate(d) === localDate(day)} onClick={() => setDay(d)}>
                      {d.toLocaleDateString(sw ? 'sw-TZ' : 'en-GB', { weekday: 'short', day: 'numeric' })}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 10 }}>
                  {slots === null ? <div className="skeleton" style={{ height: 90 }} /> : slots.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--ink3)', fontWeight: 700 }}>{t('Fully booked or closed this day — try another day.', 'Imejaa au imefungwa siku hii — jaribu siku nyingine.')}</div>
                  ) : (
                    <div className="s-slots">
                      {slots.map((s) => <button key={s} type="button" aria-pressed={slot === s} onClick={() => setSlot(s)}>{hhmm(s)}</button>)}
                    </div>
                  )}
                </div>
              </>
            )}

            {slot && (
              <>
                <div className="s-label">{shop.barbers.length ? 4 : 3} · {t('Your details', 'Taarifa zako')}</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <input className="s-input" autoComplete="name" placeholder={t('Your name', 'Jina lako')} value={name} onChange={(e) => setName(e.target.value)} />
                  <input className="s-input" autoComplete="tel" inputMode="tel" placeholder={t('Phone (WhatsApp)', 'Simu (WhatsApp)')} value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <input className="s-input" placeholder={t('Anything we should know? (optional)', 'Maelezo yoyote? (hiari)')} value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                {error && <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--badSoft)', color: 'var(--bad)', fontSize: 13, fontWeight: 700 }}>{error}</div>}
                <button type="button" className="btn-primary tap" style={{ width: '100%', marginTop: 14, border: 'none' }} data-disabled={busy || name.trim().length < 2 || phone.replace(/\D/g, '').length < 9} onClick={submit}>
                  {busy ? '…' : `${t('Request', 'Omba')} ${new Date(slot).toLocaleDateString(sw ? 'sw-TZ' : 'en-GB', { weekday: 'short' })} ${hhmm(slot)}${estimate ? ` · ~${money(estimate)}` : ''}`}
                </button>
              </>
            )}
          </>
        )}
        <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700, marginTop: 28 }}>Powered by Bermi One</div>
      </div>
    </div>
  );
}
