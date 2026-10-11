import { useEffect, useMemo, useState } from 'react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../lib/icons';
import { useSettings } from '../../lib/useSettings';
import { useData } from '../../state/DataContext';
import { useSalon } from '../../state/SalonContext';
import { useToast } from '../../state/ToastContext';
import { NewSaleSheet } from '../../components/salon/NewSaleSheet';
import { ApptActions } from '../../components/salon/ApptActions';
import { StatusBadge } from './SalonToday';
import { BookingLinkCard } from '../../components/salon/BookingLinkCard';
import { freeSlots, hhmm, localDate, type ApptSource, type SalonAppointment, type SalonClient } from '../../lib/salon';
import { haptic } from '../../lib/haptics';

function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); x.setHours(0, 0, 0, 0); return x; }

export function Bookings() {
  const { lang, owner } = useSettings();
  const sw = lang === 'sw';
  const { staffMembers, activeStaff } = useData();
  const { appointments, loaded } = useSalon();
  const [day, setDay] = useState(() => addDays(new Date(), 0));
  const [barber, setBarber] = useState<string>(() => (!owner && activeStaff ? activeStaff.id : 'all'));
  const [booking, setBooking] = useState(false);
  const [actOn, setActOn] = useState<SalonAppointment | null>(null);
  const [checkout, setCheckout] = useState<SalonAppointment | null>(null);

  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(new Date(), i - 3)), []);
  const key = localDate(day);
  const list = appointments
    .filter((a) => localDate(new Date(a.start_at)) === key && (barber === 'all' || a.barber_id === barber || (!a.barber_id && barber !== 'all' && owner)))
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
  const requests = appointments.filter((a) => a.status === 'requested' && new Date(a.end_at).getTime() > Date.now());
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of appointments) if (!['cancelled', 'no_show'].includes(a.status)) m.set(localDate(new Date(a.start_at)), (m.get(localDate(new Date(a.start_at))) || 0) + 1);
    return m;
  }, [appointments]);

  return (
    <div className="screen sb desk-wide">
      <ScreenHeader title={sw ? 'Miadi' : 'Bookings'} sub={sw ? 'Kalenda ya viti vyako' : 'Your chairs, by the day'} />

      {owner && <BookingLinkCard compact />}

      {requests.length > 0 && (
        <>
          <div className="s-label">{sw ? 'Maombi mapya mtandaoni' : 'New online requests'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {requests.map((a) => <ApptRow key={a.id} a={a} sw={sw} onClick={() => setActOn(a)} showDay />)}
          </div>
        </>
      )}

      {/* Day strip */}
      <div className="sb" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '16px -16px 0', padding: '2px 16px 6px' }}>
        {days.map((d) => {
          const k = localDate(d);
          const on = k === key;
          const n = counts.get(k) || 0;
          return (
            <button key={k} type="button" className="tap" onClick={() => setDay(d)}
              style={{ flexShrink: 0, width: 54, padding: '9px 0', borderRadius: 16, background: on ? 'var(--grad)' : 'var(--card)', color: on ? '#fff' : 'var(--ink)', boxShadow: 'var(--sh)', textAlign: 'center' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, opacity: 0.8 }}>{d.toLocaleDateString(sw ? 'sw-TZ' : 'en-GB', { weekday: 'short' })}</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{d.getDate()}</div>
              <div style={{ height: 6, display: 'flex', justifyContent: 'center', gap: 2 }}>
                {Array.from({ length: Math.min(n, 4) }).map((_, i) => <span key={i} style={{ width: 4, height: 4, borderRadius: 2, background: on ? '#fff' : 'var(--brand)' }} />)}
              </div>
            </button>
          );
        })}
      </div>

      {staffMembers.length > 1 && (
        <div className="s-chipset" style={{ marginTop: 10 }}>
          {owner && <button type="button" aria-pressed={barber === 'all'} onClick={() => setBarber('all')}>{sw ? 'Wote' : 'Everyone'}</button>}
          {staffMembers.map((m) => (
            <button key={m.id} type="button" aria-pressed={barber === m.id} onClick={() => setBarber(m.id)}>{m.name.split(' ')[0]}</button>
          ))}
        </div>
      )}

      <div className="s-row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{day.toLocaleDateString(sw ? 'sw-TZ' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)' }}>{list.filter((a) => !['cancelled'].includes(a.status)).length} {sw ? 'miadi' : 'bookings'}</span>
      </div>
      {!loaded ? <div className="skeleton" style={{ height: 140, marginTop: 10 }} /> : list.length === 0 ? (
        <div className="card" style={{ marginTop: 10, padding: 22, textAlign: 'center', color: 'var(--ink3)', fontSize: 13, fontWeight: 700 }}>
          {sw ? 'Hakuna miadi siku hii.' : 'Nothing booked on this day.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {list.map((a) => <ApptRow key={a.id} a={a} sw={sw} onClick={() => setActOn(a)} />)}
        </div>
      )}

      <button type="button" className="s-fab tap" onClick={() => setBooking(true)}>
        <Icon name="calendar" size={17} /> {sw ? 'Weka miadi' : 'Book'}
      </button>
      <NewAppointmentSheet open={booking} onClose={() => setBooking(false)} initialDay={day} />
      <ApptActions appt={actOn} onClose={() => setActOn(null)} onCheckout={(a) => { setActOn(null); setCheckout(a); }} />
      <NewSaleSheet open={!!checkout} onClose={() => setCheckout(null)} fromAppointment={checkout} />
    </div>
  );
}

function ApptRow({ a, sw, onClick, showDay }: { a: SalonAppointment; sw: boolean; onClick: () => void; showDay?: boolean }) {
  const faded = ['cancelled', 'no_show', 'done'].includes(a.status);
  return (
    <div className="card tap" onClick={onClick} style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, opacity: faded ? 0.6 : 1 }}>
      <div style={{ width: 56, textAlign: 'center', flexShrink: 0 }}>
        {showDay && <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--ink3)' }}>{new Date(a.start_at).toLocaleDateString(sw ? 'sw-TZ' : 'en-GB', { weekday: 'short', day: 'numeric' })}</div>}
        <div style={{ fontSize: 15, fontWeight: 800 }}>{hhmm(a.start_at)}</div>
        <div style={{ fontSize: 10.5, color: 'var(--ink3)', fontWeight: 700 }}>{hhmm(a.end_at)}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: a.status === 'cancelled' ? 'line-through' : undefined }}>{a.client_name}</div>
        <div style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {a.service_names || '—'} · {a.barber_name ? a.barber_name.split(' ')[0] : (sw ? 'Yeyote' : 'Any barber')}
          {a.source === 'online' && <span style={{ marginLeft: 6, color: 'var(--brand)', fontWeight: 800 }}>● {sw ? 'mtandaoni' : 'online'}</span>}
        </div>
      </div>
      <StatusBadge status={a.status} sw={sw} />
    </div>
  );
}

export function NewAppointmentSheet({ open, onClose, initialDay, client: preset }: { open: boolean; onClose: () => void; initialDay?: Date; client?: SalonClient | null }) {
  const { lang, fmt } = useSettings();
  const sw = lang === 'sw';
  const { staffMembers, activeBusiness } = useData();
  const { services, clients, appointments, createAppointment } = useSalon();
  const { flash } = useToast();
  const [client, setClient] = useState<SalonClient | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [day, setDay] = useState(addDays(new Date(), 0));
  const [slot, setSlot] = useState<Date | null>(null);
  const [source, setSource] = useState<ApptSource>('phone');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClient(preset || null); setName(''); setPhone(''); setQuery(''); setPicked([]); setBarberId(null);
    setDay(initialDay && initialDay.getTime() >= addDays(new Date(), 0).getTime() ? initialDay : addDays(new Date(), 0));
    setSlot(null); setSource('phone'); setNote(''); setError(''); setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const minutes = services.filter((s) => picked.includes(s.id)).reduce((m, s) => m + s.duration_min, 0) || 30;
  const estimate = services.filter((s) => picked.includes(s.id)).reduce((m, s) => m + Number(s.price), 0);
  const slots = useMemo(() => freeSlots({
    day, minutes, barberId, barberIds: staffMembers.map((m) => m.id), appts: appointments,
    hours: activeBusiness?.settings?.hours, step: activeBusiness?.settings?.slot_min || 30,
  }), [day, minutes, barberId, staffMembers, appointments, activeBusiness]);
  const matches = query.trim() ? clients.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()) || (c.phone || '').includes(query.replace(/\s/g, ''))).slice(0, 5) : [];
  const days = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  async function save() {
    setError('');
    const who = client?.name || name.trim();
    if (!who) { setError(sw ? 'Weka jina la mteja.' : 'Add the client’s name.'); return; }
    if (!picked.length) { setError(sw ? 'Chagua huduma.' : 'Pick a service.'); return; }
    if (!slot) { setError(sw ? 'Chagua muda.' : 'Pick a time.'); return; }
    setBusy(true);
    const err = await createAppointment({
      client_id: client?.id || null, client_name: who, client_phone: client?.phone || phone.trim() || null,
      barber_id: barberId, service_ids: picked, start_at: slot.toISOString(), source, note: note.trim() || null,
    });
    setBusy(false);
    if (err) { setError(err); return; }
    haptic(20);
    flash(sw ? 'Miadi imewekwa' : 'Booked');
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={sw ? 'Weka miadi' : 'New booking'}>
      <div className="s-label">{sw ? 'Mteja' : 'Client'}</div>
      {client ? (
        <div className="card s-row" style={{ padding: '10px 12px' }}>
          <div style={{ flex: 1, fontWeight: 800 }}>{client.name} <span style={{ color: 'var(--ink3)', fontWeight: 700, fontSize: 12 }}>{client.phone || ''}</span></div>
          <button type="button" className="chip tap" onClick={() => setClient(null)}>{sw ? 'Badilisha' : 'Change'}</button>
        </div>
      ) : (
        <>
          <input className="s-input" placeholder={sw ? 'Tafuta mteja…' : 'Find a client…'} value={query} onChange={(e) => setQuery(e.target.value)} />
          {matches.map((c) => (
            <button key={c.id} type="button" className="s-svc tap" style={{ marginTop: 6 }} onClick={() => { setClient(c); setQuery(''); }}>
              <Icon name="user" size={14} /><span style={{ flex: 1, fontWeight: 800 }}>{c.name}</span><span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{c.phone}</span>
            </button>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <input className="s-input" placeholder={sw ? 'Jina' : 'Name'} value={name} onChange={(e) => setName(e.target.value)} />
            <input className="s-input" placeholder={sw ? 'Simu' : 'Phone'} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </>
      )}

      <div className="s-label">{sw ? 'Huduma' : 'Services'}</div>
      <div className="s-chipset">
        {services.filter((s) => s.active).map((s) => (
          <button key={s.id} type="button" aria-pressed={picked.includes(s.id)} onClick={() => { setSlot(null); setPicked((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id])); }}>
            {s.name}
          </button>
        ))}
      </div>
      {picked.length > 0 && <div style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 700, marginTop: 6 }}>{minutes} {sw ? 'dakika' : 'min'} · ~{fmt(estimate)}</div>}

      {staffMembers.length > 0 && (
        <>
          <div className="s-label">{sw ? 'Kinyozi' : 'Barber'}</div>
          <div className="s-chipset">
            <button type="button" aria-pressed={barberId === null} onClick={() => { setBarberId(null); setSlot(null); }}>{sw ? 'Yeyote' : 'Any'}</button>
            {staffMembers.map((m) => (
              <button key={m.id} type="button" aria-pressed={barberId === m.id} onClick={() => { setBarberId(m.id); setSlot(null); }}>{m.name.split(' ')[0]}</button>
            ))}
          </div>
        </>
      )}

      <div className="s-label">{sw ? 'Siku' : 'Day'}</div>
      <div className="s-chipset" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
        {days.map((d) => (
          <button key={d.toISOString()} type="button" style={{ flexShrink: 0 }} aria-pressed={localDate(d) === localDate(day)} onClick={() => { setDay(d); setSlot(null); }}>
            {d.toLocaleDateString(sw ? 'sw-TZ' : 'en-GB', { weekday: 'short', day: 'numeric' })}
          </button>
        ))}
      </div>

      <div className="s-label">{sw ? 'Muda' : 'Time'}</div>
      {slots.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink3)', fontWeight: 700 }}>{sw ? 'Hakuna nafasi siku hii — jaribu siku au kinyozi mwingine.' : 'No free time this day — try another day or barber.'}</div>
      ) : (
        <div className="s-slots">
          {slots.map((t) => (
            <button key={t.toISOString()} type="button" aria-pressed={slot?.getTime() === t.getTime()} onClick={() => setSlot(t)}>{hhmm(t.toISOString())}</button>
          ))}
        </div>
      )}

      <div className="s-label">{sw ? 'Imepokelewa kupitia' : 'Booked by'}</div>
      <div className="s-seg">
        <button type="button" aria-pressed={source === 'phone'} onClick={() => setSource('phone')}>{sw ? 'Simu' : 'Phone'}</button>
        <button type="button" aria-pressed={source === 'walk_in'} onClick={() => setSource('walk_in')}>{sw ? 'Ana kwa ana' : 'In person'}</button>
      </div>
      <input className="s-input" style={{ marginTop: 8 }} placeholder={sw ? 'Maelezo (hiari)' : 'Note (optional)'} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--badSoft)', color: 'var(--bad)', fontSize: 12.5, fontWeight: 700 }}>{error}</div>}
      <button type="button" className="btn-primary tap" style={{ width: '100%', marginTop: 14, border: 'none' }} data-disabled={busy} onClick={save}>
        {busy ? '…' : slot ? `${sw ? 'Weka' : 'Book'} ${hhmm(slot.toISOString())}` : (sw ? 'Weka miadi' : 'Book')}
      </button>
    </Sheet>
  );
}
