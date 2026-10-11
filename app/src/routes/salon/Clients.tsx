import { useEffect, useMemo, useState } from 'react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../lib/icons';
import { useSettings } from '../../lib/useSettings';
import { useData } from '../../state/DataContext';
import { useSalon } from '../../state/SalonContext';
import { useToast } from '../../state/ToastContext';
import { NewAppointmentSheet } from './Bookings';
import { daysSince, waLink, winBack, type SalonClient, type SalonVisit } from '../../lib/salon';

export function Clients() {
  const { lang, fmt, owner } = useSettings();
  const sw = lang === 'sw';
  const { activeBusiness } = useData();
  const { clients, loaded } = useSalon();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'all' | 'top' | 'lost'>('all');
  const [open, setOpen] = useState<SalonClient | null>(null);
  const [adding, setAdding] = useState(false);

  const lost = useMemo(() => winBack(clients), [clients]);
  const list = useMemo(() => {
    const base = tab === 'lost' ? lost : tab === 'top' ? [...clients].sort((a, b) => b.total_spent - a.total_spent) : clients;
    const s = q.trim().toLowerCase();
    return s ? base.filter((c) => c.name.toLowerCase().includes(s) || (c.phone || '').includes(s.replace(/\s/g, ''))) : base;
  }, [clients, lost, tab, q]);

  return (
    <div className="screen sb">
      <ScreenHeader title={sw ? 'Wateja' : 'Clients'} sub={`${clients.length} ${sw ? 'wateja' : 'clients'}${lost.length ? ` · ${lost.length} ${sw ? 'hawajarudi' : 'to win back'}` : ''}`}
        right={<button type="button" className="icon-btn tap" aria-label={sw ? 'Ongeza mteja' : 'Add client'} onClick={() => setAdding(true)}><Icon name="plus" size={16} /></button>} />
      <input className="s-input" style={{ marginTop: 6 }} placeholder={sw ? 'Tafuta kwa jina au simu…' : 'Search by name or phone…'} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="s-seg" style={{ marginTop: 10 }}>
        <button type="button" aria-pressed={tab === 'all'} onClick={() => setTab('all')}>{sw ? 'Wa karibuni' : 'Recent'}</button>
        {owner && <button type="button" aria-pressed={tab === 'top'} onClick={() => setTab('top')}>{sw ? 'Bora' : 'Top spenders'}</button>}
        <button type="button" aria-pressed={tab === 'lost'} onClick={() => setTab('lost')}>{sw ? 'Warudishe' : 'Win back'}{lost.length ? ` (${lost.length})` : ''}</button>
      </div>
      {tab === 'lost' && lost.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600, marginTop: 8, lineHeight: 1.5 }}>
          {sw ? 'Wateja waliokuja angalau mara 2 lakini hawajarudi siku 30+. Watumie ujumbe wa WhatsApp.' : 'Regulars (2+ visits) who haven’t been back in 30+ days. Send them a WhatsApp.'}
        </div>
      )}
      {!loaded ? <div className="skeleton" style={{ height: 200, marginTop: 12 }} /> : list.length === 0 ? (
        <div className="card" style={{ marginTop: 12, padding: 22, textAlign: 'center', color: 'var(--ink3)', fontSize: 13, fontWeight: 700 }}>
          {clients.length === 0 ? (sw ? 'Wateja wanaongezwa wenyewe unaporekodi mauzo yenye simu.' : 'Clients are added automatically when you record a sale with a phone number.') : (sw ? 'Hakuna aliyepatikana.' : 'No one matches.')}
        </div>
      ) : (
        <div className="card" style={{ marginTop: 12, padding: '2px 14px' }}>
          {list.slice(0, 200).map((c, i) => {
            const ago = daysSince(c.last_visit_at);
            return (
              <div key={c.id} className="s-row tap" onClick={() => setOpen(c)} style={{ padding: '11px 0', borderTop: i ? '1px solid var(--line)' : undefined }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--brandSoft)', color: 'var(--brand)', display: 'grid', placeItems: 'center', fontWeight: 800, flexShrink: 0 }}>{c.name.slice(0, 1).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>
                    {c.visits} {sw ? 'ziara' : c.visits === 1 ? 'visit' : 'visits'} · {ago === Infinity ? (sw ? 'bado' : 'not yet') : ago === 0 ? (sw ? 'leo' : 'today') : `${ago}${sw ? ' siku zilizopita' : 'd ago'}`}
                  </div>
                </div>
                {owner && <b style={{ fontSize: 13 }}>{fmt(c.total_spent)}</b>}
                {tab === 'lost' && c.phone && (
                  <a className="icon-btn tap" onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer"
                    href={waLink(c.phone, sw ? `Habari ${c.name.split(' ')[0]}! Tumekukumbuka ${activeBusiness?.name || ''}. Karibu tena — weka miadi wiki hii.` : `Hi ${c.name.split(' ')[0]}! We miss you at ${activeBusiness?.name || ''}. Come back this week — reply to book a time.`, activeBusiness?.country_code)}>
                    <Icon name="chat" size={15} />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
      <ClientSheet client={open} onClose={() => setOpen(null)} />
      <EditClientSheet open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function ClientSheet({ client, onClose }: { client: SalonClient | null; onClose: () => void }) {
  const { lang, fmt, owner } = useSettings();
  const sw = lang === 'sw';
  const { activeBusiness } = useData();
  const { fetchClientVisits, appointments } = useSalon();
  const [history, setHistory] = useState<SalonVisit[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    setHistory(null);
    if (client) void fetchClientVisits(client.id).then(setHistory);
  }, [client, fetchClientVisits]);

  const favourite = useMemo(() => {
    if (!history?.length) return null;
    const svc = new Map<string, number>(); const bar = new Map<string, number>();
    for (const v of history) {
      for (const l of v.items || []) svc.set(l.name, (svc.get(l.name) || 0) + 1);
      if (v.barber_name) bar.set(v.barber_name, (bar.get(v.barber_name) || 0) + 1);
    }
    const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const gaps = history.slice(0, -1).map((v, i) => (new Date(v.created_at).getTime() - new Date(history[i + 1].created_at).getTime()) / 86_400_000);
    const every = gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null;
    return { service: top(svc), barber: top(bar), every };
  }, [history]);

  if (!client) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  const upcoming = appointments.filter((a) => a.client_id === client.id && new Date(a.start_at).getTime() > Date.now() && ['requested', 'confirmed'].includes(a.status));

  return (
    <Sheet open={!!client} onClose={onClose} title={client.name} sub={client.phone || undefined}>
      <div className="s-kpis">
        <div className="s-kpi"><span>{sw ? 'Ziara' : 'Visits'}</span><b>{client.visits}</b></div>
        {owner && <div className="s-kpi"><span>{sw ? 'Jumla' : 'Spent'}</span><b>{fmt(client.total_spent)}</b></div>}
        <div className="s-kpi"><span>{sw ? 'Kila' : 'Comes every'}</span><b>{favourite?.every ? `${favourite.every}${sw ? ' siku' : 'd'}` : '—'}</b></div>
      </div>
      {(favourite?.service || client.notes) && (
        <div className="card" style={{ marginTop: 10, padding: 12, fontSize: 13, lineHeight: 1.6 }}>
          {favourite?.service && <div><b>{sw ? 'Huduma anayopenda' : 'Usually has'}:</b> {favourite.service}{favourite.barber ? ` · ${sw ? 'na' : 'with'} ${favourite.barber.split(' ')[0]}` : ''}</div>}
          {client.notes && <div><b>{sw ? 'Maelezo' : 'Notes'}:</b> {client.notes}</div>}
        </div>
      )}
      {upcoming.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 800, color: 'var(--brand)' }}>
          {sw ? 'Miadi ijayo' : 'Next booking'}: {new Date(upcoming[0].start_at).toLocaleString(sw ? 'sw-TZ' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
        <button type="button" className="btn-ghost tap" style={{ padding: 11, fontSize: 13 }} onClick={() => setBooking(true)}>{sw ? 'Weka miadi' : 'Book'}</button>
        <a className="btn-ghost tap" style={{ padding: 11, fontSize: 13 }} target="_blank" rel="noreferrer" href={waLink(client.phone, sw ? `Habari ${client.name.split(' ')[0]}!` : `Hi ${client.name.split(' ')[0]}!`, activeBusiness?.country_code)}>WhatsApp</a>
        <button type="button" className="btn-ghost tap" style={{ padding: 11, fontSize: 13 }} onClick={() => setEditing(true)}>{sw ? 'Hariri' : 'Edit'}</button>
      </div>
      <div className="s-label">{sw ? 'Historia' : 'History'}</div>
      {history === null ? <div className="skeleton" style={{ height: 80 }} /> : history.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink3)', fontWeight: 700 }}>{sw ? 'Bado hakuna ziara.' : 'No visits yet.'}</div>
      ) : (
        <div className="card" style={{ padding: '2px 12px' }}>
          {history.map((v, i) => (
            <div key={v.id} className="s-row" style={{ padding: '9px 0', borderTop: i ? '1px solid var(--line)' : undefined }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{(v.items || []).map((l) => l.name).join(' + ')}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700 }}>
                  {new Date(v.created_at).toLocaleDateString(sw ? 'sw-TZ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}{v.barber_name ? ` · ${v.barber_name.split(' ')[0]}` : ''}{v.note ? ` · ${v.note}` : ''}
                </div>
              </div>
              <b style={{ fontSize: 13 }}>{fmt(v.total)}</b>
            </div>
          ))}
        </div>
      )}
      <EditClientSheet open={editing} onClose={() => setEditing(false)} client={client} />
      <NewAppointmentSheet open={booking} onClose={() => setBooking(false)} client={client} />
    </Sheet>
  );
}

function EditClientSheet({ open, onClose, client }: { open: boolean; onClose: () => void; client?: SalonClient }) {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const { saveClient } = useSalon();
  const { flash } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setName(client?.name || ''); setPhone(client?.phone || ''); setNotes(client?.notes || ''); setError(''); } }, [open, client]);
  async function save() {
    if (!name.trim()) { setError(sw ? 'Weka jina.' : 'Add a name.'); return; }
    const err = await saveClient({ id: client?.id, name, phone, notes });
    if (err) { setError(err); return; }
    flash(sw ? 'Imehifadhiwa' : 'Saved');
    onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} title={client ? (sw ? 'Hariri mteja' : 'Edit client') : (sw ? 'Mteja mpya' : 'New client')}>
      <div style={{ display: 'grid', gap: 8 }}>
        <input className="s-input" placeholder={sw ? 'Jina' : 'Name'} value={name} onChange={(e) => setName(e.target.value)} />
        <input className="s-input" placeholder={sw ? 'Simu' : 'Phone'} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <textarea className="s-input" rows={3} placeholder={sw ? 'Anachopenda — mfano "fade #1, ndevu fupi, hapendi wembe"' : 'Preferences — e.g. "skin fade #1, short beard, no razor"'} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <div style={{ marginTop: 10, color: 'var(--bad)', fontSize: 12.5, fontWeight: 700 }}>{error}</div>}
      <button type="button" className="btn-primary tap" style={{ width: '100%', marginTop: 14, border: 'none' }} onClick={save}>{sw ? 'Hifadhi' : 'Save'}</button>
    </Sheet>
  );
}
