import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../lib/icons';
import { useSettings } from '../../lib/useSettings';
import { useData } from '../../state/DataContext';
import { useSalon } from '../../state/SalonContext';
import { useToast } from '../../state/ToastContext';
import { BookingLinkCard } from '../../components/salon/BookingLinkCard';
import { DEFAULT_HOURS, type SalonService } from '../../lib/salon';

const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_SW = ['Jtt', 'Jnn', 'Jtn', 'Alh', 'Ijm', 'Jms', 'Jpl'];

/** The shop's menu, prices, hours and who earns what — everything a barbershop sets once. */
export function Services() {
  const { lang, fmt, owner } = useSettings();
  const sw = lang === 'sw';
  const { activeBusiness, staffMembers, updateBusiness, updateStaffMember } = useData();
  const { services, saveService, loaded } = useSalon();
  const { flash } = useToast();
  const nav = useNavigate();
  const [edit, setEdit] = useState<Partial<SalonService> | null>(null);
  const settings = activeBusiness?.settings || {};
  const [hours, setHours] = useState<Record<string, [string, string] | null>>(settings.hours || DEFAULT_HOURS);
  const [rates, setRates] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(settings.barber_commission || {}).map(([k, v]) => [k, String(v)])));
  const [slot, setSlot] = useState(settings.slot_min || 30);
  const [publicPhone, setPublicPhone] = useState(settings.public_phone || '');
  const [bookingsOn, setBookingsOn] = useState(!!settings.bookings_enabled);
  const [queueOn, setQueueOn] = useState(settings.queue_enabled !== false);
  const [editPrice, setEditPrice] = useState(settings.staff_edit_price !== false);
  const [discountOk, setDiscountOk] = useState(settings.staff_discount === true);

  useEffect(() => {
    setHours(activeBusiness?.settings?.hours || DEFAULT_HOURS);
    setSlot(activeBusiness?.settings?.slot_min || 30);
  }, [activeBusiness?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveSettings() {
    const barber_commission: Record<string, number> = {};
    for (const [k, v] of Object.entries(rates)) if (v.trim() !== '' && !Number.isNaN(Number(v))) barber_commission[k] = Math.min(100, Math.max(0, Number(v)));
    await updateBusiness({ settings: { ...settings, hours, barber_commission, slot_min: slot, public_phone: publicPhone.trim() || undefined,
      bookings_enabled: bookingsOn, queue_enabled: queueOn, staff_edit_price: editPrice, staff_discount: discountOk } });
    flash(sw ? 'Mipangilio imehifadhiwa' : 'Settings saved');
  }

  const groups = services.reduce<Record<string, SalonService[]>>((m, s) => { (m[s.category] ||= []).push(s); return m; }, {});

  return (
    <div className="screen sb desk-wide">
      <ScreenHeader back title={sw ? 'Huduma na mipangilio' : 'Services & setup'} sub={sw ? 'Bei, muda, saa za kazi na kamisheni' : 'Prices, durations, hours and commission'}
        right={owner ? <button type="button" className="icon-btn tap" aria-label={sw ? 'Ongeza huduma' : 'Add service'} onClick={() => setEdit({ name: '', category: 'Hair', price: 0, duration_min: 30, commission_pct: 0, active: true })}><Icon name="plus" size={16} /></button> : undefined} />

      {!loaded ? <div className="skeleton" style={{ height: 200 }} /> : Object.entries(groups).map(([cat, list]) => (
        <div key={cat}>
          <div className="s-label">{cat}</div>
          <div className="card" style={{ padding: '2px 14px' }}>
            {list.map((s, i) => (
              <div key={s.id} className={owner ? 's-row tap' : 's-row'} onClick={owner ? () => setEdit(s) : undefined} style={{ padding: '11px 0', borderTop: i ? '1px solid var(--line)' : undefined, opacity: s.active ? 1 : 0.5 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{s.name}{!s.active && <span style={{ fontSize: 11, color: 'var(--ink3)' }}> · {sw ? 'imezimwa' : 'hidden'}</span>}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{s.duration_min} {sw ? 'dakika' : 'min'}{owner && s.commission_pct ? ` · ${s.commission_pct}% ${sw ? 'kamisheni' : 'commission'}` : ''}</div>
                </div>
                <b style={{ fontSize: 14 }}>{fmt(Number(s.price))}</b>
              </div>
            ))}
          </div>
        </div>
      ))}

      {owner && (
        <>
          <div className="s-label">{sw ? 'Timu' : 'Team'}</div>
          <div style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600, marginBottom: 8, lineHeight: 1.5 }}>
            {sw ? 'Kinyozi anarekodi kazi yake tu. Keshia anarekodi kwa kinyozi yeyote. Asilimia ya kamisheni ikiwekwa hapa inachukua nafasi ya asilimia ya kila huduma; bakshishi yote ni ya kinyozi.' : 'A barber records their own work. A cashier records for any barber. A commission rate here overrides each service’s rate; tips always go to the barber.'}
          </div>
          {staffMembers.length === 0 ? (
            <button type="button" className="btn-ghost tap" style={{ width: '100%' }} onClick={() => nav('/staff')}>{sw ? 'Ongeza vinyozi na keshia' : 'Add barbers and cashiers'}</button>
          ) : (
            <div className="card" style={{ padding: '4px 14px' }}>
              {staffMembers.map((m, i) => {
                const role = m.salon_role || 'barber';
                return (
                  <div key={m.id} style={{ padding: '10px 0', borderTop: i ? '1px solid var(--line)' : undefined }}>
                    <div className="s-row">
                      <span style={{ flex: 1, fontWeight: 800, fontSize: 13.5 }}>{m.name}</span>
                      {role !== 'cashier' && (
                        <>
                          <input className="s-input" inputMode="numeric" aria-label={`${m.name} commission`} style={{ width: 70, textAlign: 'right', padding: '7px 10px' }} placeholder="—" value={rates[m.id] || ''}
                            onChange={(e) => setRates((r) => ({ ...r, [m.id]: e.target.value.replace(/[^0-9.]/g, '') }))} />
                          <span style={{ fontWeight: 800, color: 'var(--ink3)' }}>%</span>
                        </>
                      )}
                    </div>
                    <div className="s-seg" style={{ marginTop: 8 }}>
                      {(['barber', 'cashier', 'both'] as const).map((r) => (
                        <button key={r} type="button" aria-pressed={role === r} onClick={async () => { const err = await updateStaffMember(m.id, { salon_role: r }); if (err) flash(err); }}>
                          {r === 'barber' ? (sw ? 'Kinyozi' : 'Barber') : r === 'cashier' ? (sw ? 'Keshia' : 'Cashier') : (sw ? 'Wote wawili' : 'Both')}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {staffMembers.length > 0 && <button type="button" className="chip tap" style={{ marginTop: 8 }} onClick={() => nav('/staff')}>{sw ? '+ Ongeza / PIN za timu' : '+ Add people / set PINs'}</button>}

          <div className="s-label">{sw ? 'Ruhusa za wafanyakazi' : 'What staff may do'}</div>
          <div className="card" style={{ padding: '4px 14px' }}>
            {[
              [sw ? 'Kubadilisha bei ya huduma kwenye tiketi' : 'Change a service’s price on the ticket', editPrice, setEditPrice],
              [sw ? 'Kutoa punguzo' : 'Give discounts', discountOk, setDiscountOk],
            ].map(([label, on, set], i) => (
              <label key={String(label)} className="s-row" style={{ padding: '11px 0', borderTop: i ? '1px solid var(--line)' : undefined, cursor: 'pointer' }}>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{label as string}</span>
                <input type="checkbox" checked={on as boolean} onChange={(e) => (set as (v: boolean) => void)(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--brand)' }} />
              </label>
            ))}
          </div>

          <div className="s-label">{sw ? 'Foleni na miadi' : 'Queue & appointments'}</div>
          <label className="card s-row" style={{ padding: '12px 14px', cursor: 'pointer', marginBottom: 8 }}>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800 }}>{sw ? 'Foleni ya namba (wateja wa kupita)' : 'Walk-in queue with numbers'}</span>
              <span style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600 }}>{sw ? 'Wateja wanaona foleni ya leo mtandaoni na kupata namba — bila msimbo.' : 'Clients see today’s queue online and get a number — no codes.'}</span>
            </span>
            <input type="checkbox" checked={queueOn} onChange={(e) => setQueueOn(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--brand)' }} />
          </label>
          <label className="card s-row" style={{ padding: '12px 14px', cursor: 'pointer' }}>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800 }}>{sw ? 'Pokea miadi na booking mtandaoni' : 'Take appointments and online bookings'}</span>
              <span style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600 }}>{sw ? 'Zima kama duka lako ni la wateja wa kupita tu.' : 'Leave off if your shop runs on walk-ins.'}</span>
            </span>
            <input type="checkbox" checked={bookingsOn} onChange={(e) => setBookingsOn(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--brand)' }} />
          </label>

          {(queueOn || bookingsOn) && <BookingLinkCard />}
          {bookingsOn && (<>

          <div className="s-label">{sw ? 'Saa za kazi' : 'Opening hours'}</div>
          <div className="card" style={{ padding: '4px 14px' }}>
            {DAYS_EN.map((d, i) => {
              const k = String(i + 1);
              const h = hours[k];
              return (
                <div key={k} className="s-row" style={{ padding: '8px 0', borderTop: i ? '1px solid var(--line)' : undefined }}>
                  <span style={{ width: 38, fontWeight: 800, fontSize: 13 }}>{sw ? DAYS_SW[i] : d}</span>
                  {h ? (
                    <>
                      <input type="time" aria-label={`${d} open`} className="s-input" style={{ padding: '7px 8px', width: 'auto', flex: 1 }} value={h[0]} onChange={(e) => setHours((x) => ({ ...x, [k]: [e.target.value, h[1]] }))} />
                      <span style={{ color: 'var(--ink3)' }}>–</span>
                      <input type="time" aria-label={`${d} close`} className="s-input" style={{ padding: '7px 8px', width: 'auto', flex: 1 }} value={h[1]} onChange={(e) => setHours((x) => ({ ...x, [k]: [h[0], e.target.value] }))} />
                      <button type="button" className="chip tap" onClick={() => setHours((x) => ({ ...x, [k]: null }))}>{sw ? 'Funga' : 'Closed'}</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, color: 'var(--ink3)', fontWeight: 700, fontSize: 13 }}>{sw ? 'Imefungwa' : 'Closed'}</span>
                      <button type="button" className="chip tap" onClick={() => setHours((x) => ({ ...x, [k]: DEFAULT_HOURS[k] }))}>{sw ? 'Fungua' : 'Open'}</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="s-label">{sw ? 'Urefu wa nafasi ya miadi' : 'Booking slot length'}</div>
          <div className="s-seg">
            {[15, 20, 30, 45, 60].map((m) => <button key={m} type="button" aria-pressed={slot === m} onClick={() => setSlot(m)}>{m}′</button>)}
          </div>

          <div className="s-label">{sw ? 'Simu ya duka (kwa wateja)' : 'Shop phone (shown to clients)'}</div>
          <input className="s-input" inputMode="tel" placeholder="07XX XXX XXX" value={publicPhone} onChange={(e) => setPublicPhone(e.target.value)} />

          </>)}
          <button type="button" className="btn-primary tap" style={{ width: '100%', marginTop: 16, border: 'none' }} onClick={saveSettings}>{sw ? 'Hifadhi mipangilio' : 'Save settings'}</button>
        </>
      )}

      <ServiceSheet service={edit} onClose={() => setEdit(null)} onSave={async (s) => {
        const err = await saveService(s as SalonService);
        if (err) return err;
        flash(sw ? 'Huduma imehifadhiwa' : 'Service saved');
        setEdit(null);
        return null;
      }} />
    </div>
  );
}

function ServiceSheet({ service, onClose, onSave }: { service: Partial<SalonService> | null; onClose: () => void; onSave: (s: Partial<SalonService> & { name: string }) => Promise<string | null> }) {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const [f, setF] = useState<Partial<SalonService>>({});
  const [error, setError] = useState('');
  useEffect(() => { setF(service || {}); setError(''); }, [service]);
  if (!service) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  const set = (k: keyof SalonService, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Sheet open={!!service} onClose={onClose} title={service.id ? (sw ? 'Hariri huduma' : 'Edit service') : (sw ? 'Huduma mpya' : 'New service')}>
      <div style={{ display: 'grid', gap: 8 }}>
        <input className="s-input" placeholder={sw ? 'Jina — mfano Skin fade' : 'Name — e.g. Skin fade'} value={f.name || ''} onChange={(e) => set('name', e.target.value)} />
        <div className="s-chipset">
          {['Hair', 'Beard', 'Care', 'Colour', 'Kids', 'Ladies'].map((c) => <button key={c} type="button" aria-pressed={f.category === c} onClick={() => set('category', c)}>{c}</button>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <label style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink3)' }}>{sw ? 'Bei' : 'Price'}
            <input className="s-input" inputMode="numeric" value={String(f.price ?? '')} onChange={(e) => set('price', e.target.value.replace(/[^0-9.]/g, ''))} /></label>
          <label style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink3)' }}>{sw ? 'Dakika' : 'Minutes'}
            <input className="s-input" inputMode="numeric" value={String(f.duration_min ?? '')} onChange={(e) => set('duration_min', e.target.value.replace(/[^0-9]/g, ''))} /></label>
          <label style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink3)' }}>{sw ? 'Kamisheni %' : 'Commission %'}
            <input className="s-input" inputMode="numeric" value={String(f.commission_pct ?? '')} onChange={(e) => set('commission_pct', e.target.value.replace(/[^0-9.]/g, ''))} /></label>
        </div>
        {service.id && (
          <button type="button" className="btn-ghost tap" onClick={() => set('active', !(f.active ?? true))}>
            {(f.active ?? true) ? (sw ? 'Ficha huduma hii (haitauzwa tena)' : 'Hide this service (stop selling it)') : (sw ? 'Rudisha huduma hii' : 'Show this service again')}
          </button>
        )}
      </div>
      {error && <div style={{ marginTop: 10, color: 'var(--bad)', fontSize: 12.5, fontWeight: 700 }}>{error}</div>}
      <button type="button" className="btn-primary tap" style={{ width: '100%', marginTop: 14, border: 'none' }} onClick={async () => {
        if (!f.name?.trim()) { setError(sw ? 'Weka jina.' : 'Add a name.'); return; }
        const err = await onSave({ ...f, name: f.name });
        if (err) setError(err);
      }}>{sw ? 'Hifadhi' : 'Save'}</button>
    </Sheet>
  );
}
