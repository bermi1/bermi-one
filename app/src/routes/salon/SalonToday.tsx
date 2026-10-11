import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../../components/AppHeader';
import { Icon } from '../../lib/icons';
import { useSettings } from '../../lib/useSettings';
import { useData } from '../../state/DataContext';
import { useSalon } from '../../state/SalonContext';
import { NewSaleSheet } from '../../components/salon/NewSaleSheet';
import { ApptActions } from '../../components/salon/ApptActions';
import { QueuePanel } from '../../components/salon/QueuePanel';
import { hhmm, localDate, type SalonAppointment } from '../../lib/salon';
import { tintVars } from '../../lib/types';

export function SalonToday() {
  const { lang, fmt, fmt0, owner, L } = useSettings();
  const sw = lang === 'sw';
  const nav = useNavigate();
  const { displayName, activeStaff, onTrial, trialDays, activeBusiness, staffMembers } = useData();
  const { visits, appointments, loaded, services } = useSalon();
  const [saleOpen, setSaleOpen] = useState(false);
  const [fromAppt, setFromAppt] = useState<SalonAppointment | null>(null);
  const [startWith, setStartWith] = useState<string | null>(null);
  const [actOn, setActOn] = useState<SalonAppointment | null>(null);
  const bookingsOn = !!activeBusiness?.settings?.bookings_enabled;

  const today = localDate(new Date());
  // A barber sees their own chair; a cashier sees the whole shop they ring up for.
  const myRole = activeStaff ? staffMembers.find((m) => m.id === activeStaff.id)?.salon_role || 'barber' : null;
  const seesAll = owner || !activeStaff || myRole !== 'barber';
  const mine = (barberId: string | null) => seesAll || barberId === activeStaff!.id;

  const todays = useMemo(() => visits.filter((v) => v.status === 'paid' && localDate(new Date(v.paid_at || v.created_at)) === today && mine(v.barber_id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visits, today, owner, activeStaff]);
  const revenue = todays.reduce((s, v) => s + v.total - v.tip, 0);
  const tips = todays.reduce((s, v) => s + v.tip, 0);
  const myCommission = todays.reduce((s, v) => s + v.commission, 0);
  const avg = todays.length ? Math.round(revenue / todays.length) : 0;

  const todaysAppts = appointments.filter((a) => localDate(new Date(a.start_at)) === today && !['cancelled'].includes(a.status) && mine(a.barber_id));
  const queue = todaysAppts.filter((a) => ['requested', 'confirmed', 'arrived'].includes(a.status));
  const requests = appointments.filter((a) => a.status === 'requested' && new Date(a.end_at).getTime() > Date.now() && mine(a.barber_id));
  const waiting = queue.filter((a) => a.status === 'arrived');

  function startSale(a: SalonAppointment | null, serviceId: string | null = null) {
    setFromAppt(a);
    setStartWith(serviceId);
    setSaleOpen(true);
  }

  const hour = new Date().getHours();
  const greet = sw ? (hour < 12 ? 'Habari za asubuhi' : hour < 17 ? 'Habari za mchana' : 'Habari za jioni') : (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

  return (
    <div className="screen sb desk-wide has-fab">
      <AppHeader />
      <div style={{ fontSize: 13.5, color: 'var(--ink2)', fontWeight: 600, marginTop: 6 }}>{greet}, {owner ? displayName : activeStaff?.name || displayName}</div>

      <div className="desk">
        <div className="desk-main">
          <div style={{ marginTop: 14, borderRadius: 26, background: 'var(--grad)', padding: 20, boxShadow: '0 20px 44px rgba(47,91,255,.3)', position: 'relative', overflow: 'hidden', color: '#fff' }}>
            <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.1)', top: -60, right: -50 }} />
            <div style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.8 }}>{seesAll ? (sw ? 'Mapato ya leo' : 'Takings today') : (sw ? 'Mauzo yangu leo' : 'My sales today')}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.7, marginTop: 2 }}>{fmt0(revenue)}</div>
            <div style={{ display: 'flex', gap: 18, marginTop: 12, fontSize: 12, fontWeight: 700, position: 'relative' }}>
              <span><b style={{ fontSize: 16 }}>{todays.length}</b> {sw ? 'wateja' : todays.length === 1 ? 'client' : 'clients'}</span>
              <span><b style={{ fontSize: 16 }}>{avg ? fmt(avg) : '—'}</b> {sw ? 'wastani' : 'avg ticket'}</span>
              <span><b style={{ fontSize: 16 }}>{tips ? fmt(tips) : '—'}</b> {sw ? 'bakshishi' : 'tips'}</span>
            </div>
            {!owner && myCommission > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, background: 'rgba(255,255,255,.16)', display: 'inline-block', padding: '5px 10px', borderRadius: 10 }}>
                {sw ? 'Kamisheni yangu' : 'My commission'}: {fmt(myCommission)}
              </div>
            )}
          </div>

          {owner && onTrial && trialDays <= 7 && (
            <div className="card tap" onClick={() => nav('/pricing')} style={{ marginTop: 12, padding: 13, display: 'flex', alignItems: 'center', gap: 10, background: trialDays <= 3 ? 'var(--warnSoft)' : 'var(--brandSoft)' }}>
              <Icon name="spark" size={16} />
              <div style={{ flex: 1, fontSize: 13, fontWeight: 800 }}>
                {trialDays > 0 ? (sw ? `Siku ${trialDays} za majaribio zimebaki` : `${trialDays} trial day${trialDays === 1 ? '' : 's'} left`) : (sw ? 'Majaribio yameisha' : 'Your trial has ended')}
              </div>
              <Icon name="right" size={14} />
            </div>
          )}

          {activeBusiness?.settings?.queue_enabled !== false && <QueuePanel />}

          {/* Record a service: one tap on what was done, then who did it and how it was paid. */}
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 20 }}>{sw ? 'Rekodi huduma' : 'Record a service'}</div>
          {!loaded ? <div className="skeleton" style={{ height: 120, marginTop: 10 }} /> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginTop: 10 }}>
              {services.filter((x) => x.active).map((x, i) => (
                <button key={x.id} type="button" className="card tap" onClick={() => startSale(null, x.id)} style={{ padding: '13px 12px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 10, display: 'grid', placeItems: 'center', background: tintVars(i).soft, color: tintVars(i).ink }}><Icon name="scissors" size={14} /></span>
                  <span style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.2 }}>{x.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)' }}>{fmt(Number(x.price))}</span>
                </button>
              ))}
              {owner && (
                <button type="button" className="tap" onClick={() => nav('/services')} style={{ padding: '13px 12px', borderRadius: 20, border: '1.5px dashed var(--line)', color: 'var(--ink3)', fontWeight: 800, fontSize: 13, display: 'grid', placeItems: 'center' }}>
                  <Icon name="plus" size={16} />{sw ? 'Huduma' : 'Service'}
                </button>
              )}
            </div>
          )}

          {bookingsOn && requests.length > 0 && (
            <div className="card tap" onClick={() => nav('/bookings')} style={{ marginTop: 12, padding: 13, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--warnSoft)' }}>
              <Icon name="calendar" size={16} style={{ color: 'var(--warn)' }} />
              <div style={{ flex: 1, fontSize: 13, fontWeight: 800 }}>
                {sw ? `Maombi ${requests.length} ya miadi mtandaoni yanasubiri` : `${requests.length} online booking${requests.length === 1 ? '' : 's'} waiting for you to confirm`}
              </div>
              <Icon name="right" size={14} />
            </div>
          )}

          {/* The queue — only for shops that take appointments */}
          {bookingsOn && (<>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{sw ? 'Foleni ya leo' : "Today's queue"}</div>
            <button type="button" className="chip tap" onClick={() => nav('/bookings')}>{sw ? 'Kalenda' : 'Calendar'}</button>
          </div>
          {!loaded ? (
            <div className="skeleton" style={{ height: 120, marginTop: 10 }} />
          ) : queue.length === 0 ? (
            <div className="card" style={{ marginTop: 10, padding: 18, textAlign: 'center', color: 'var(--ink3)', fontSize: 13, fontWeight: 700 }}>
              {waiting.length === 0 && (sw ? 'Hakuna miadi zaidi leo. Wateja wa kupita: gusa "Mauzo mapya".' : 'No more bookings today. Walk-ins: tap "New sale".')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {queue.map((a) => (
                <div key={a.id} className="card tap" onClick={() => setActOn(a)} style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 52, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{hhmm(a.start_at)}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink3)', fontWeight: 700 }}>{Math.round((new Date(a.end_at).getTime() - new Date(a.start_at).getTime()) / 60000)}′</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.client_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.service_names || '—'}{a.barber_name ? ` · ${a.barber_name.split(' ')[0]}` : ''}
                    </div>
                  </div>
                  <StatusBadge status={a.status} sw={sw} />
                  {a.status === 'arrived' && (
                    <button type="button" className="chip tap" style={{ background: 'var(--brand)', color: '#fff', border: 'none' }} onClick={(e) => { e.stopPropagation(); startSale(a); }}>
                      {sw ? 'Lipisha' : 'Check out'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          </>)}

          {/* Today's sales */}
          {todays.length > 0 && (
            <>
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 22 }}>{sw ? 'Mauzo ya leo' : "Today's sales"}</div>
              <div className="card" style={{ marginTop: 10, padding: '4px 14px' }}>
                {todays.slice(0, 12).map((v, i) => (
                  <div key={v.id} className="s-row" style={{ padding: '10px 0', borderTop: i ? '1px solid var(--line)' : undefined }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{v.client_name || (sw ? 'Mteja wa kupita' : 'Walk-in')}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {hhmm(v.paid_at || v.created_at)} · {(v.items || []).map((l) => l.name).join(' + ')}{v.barber_name ? ` · ${v.barber_name.split(' ')[0]}` : ''}
                      </div>
                    </div>
                    <b style={{ fontSize: 14 }}>{fmt(v.total)}</b>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="desk-side">
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 22 }}>{sw ? 'Vitendo' : 'Quick actions'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, marginTop: 10 }}>
            {[
              bookingsOn ? { label: sw ? 'Miadi' : 'Bookings', icon: 'calendar', go: '/bookings' } : { label: sw ? 'Timu' : 'Team', icon: 'user', go: owner ? '/staff' : '/clients' },
              { label: sw ? 'Wateja' : 'Clients', icon: 'users', go: '/clients' },
              { label: L.money, icon: 'wallet', go: '/money' },
              owner ? { label: L.reports, icon: 'chart', go: '/reports' } : { label: sw ? 'Huduma' : 'Menu', icon: 'scissors', go: '/services' },
            ].map((q, i) => (
              <button key={q.go} type="button" className="card tap" onClick={() => nav(q.go)} style={{ padding: '12px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 34, height: 34, borderRadius: 11, display: 'grid', placeItems: 'center', background: tintVars(i).soft, color: tintVars(i).ink }}><Icon name={q.icon} size={16} /></span>
                <span style={{ fontSize: 11.5, fontWeight: 800 }}>{q.label}</span>
              </button>
            ))}
          </div>
          {loaded && services.length === 0 && owner && (
            <div className="card tap" onClick={() => nav('/services')} style={{ marginTop: 12, padding: 14, fontSize: 13, fontWeight: 800 }}>
              {sw ? 'Ongeza huduma zako na bei kwanza →' : 'Add your services and prices first →'}
            </div>
          )}
        </div>
      </div>

      <button type="button" className="s-fab tap" onClick={() => startSale(null)}>
        <Icon name="plus" size={18} /> {sw ? 'Mauzo mapya' : 'New sale'}
      </button>
      <NewSaleSheet open={saleOpen} onClose={() => setSaleOpen(false)} fromAppointment={fromAppt} initialServiceId={startWith} />
      <ApptActions appt={actOn} onClose={() => setActOn(null)} onCheckout={(a) => { setActOn(null); startSale(a); }} />
    </div>
  );
}

export function StatusBadge({ status, sw }: { status: SalonAppointment['status']; sw: boolean }) {
  const map: Record<SalonAppointment['status'], [string, string, string, string]> = {
    requested: ['Request', 'Ombi', 'var(--warnSoft)', 'var(--warn)'],
    confirmed: ['Booked', 'Imewekwa', 'var(--brandSoft)', 'var(--brand)'],
    arrived: ['Here', 'Amefika', 'var(--okSoft)', 'var(--ok)'],
    done: ['Done', 'Imekamilika', 'var(--card2)', 'var(--ink2)'],
    no_show: ['No-show', 'Hakuja', 'var(--badSoft)', 'var(--bad)'],
    cancelled: ['Cancelled', 'Imeghairiwa', 'var(--card2)', 'var(--ink3)'],
  };
  const [en, swl, bg, ink] = map[status];
  return <span className="s-badge" style={{ background: bg, color: ink }}>{sw ? swl : en}</span>;
}
