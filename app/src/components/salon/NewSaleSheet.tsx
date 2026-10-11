import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '../Sheet';
import { Icon } from '../../lib/icons';
import { useSettings } from '../../lib/useSettings';
import { useData } from '../../state/DataContext';
import { useSalon } from '../../state/SalonContext';
import { useToast } from '../../state/ToastContext';
import { haptic } from '../../lib/haptics';
import { visitCommission, visitTotals, type QueueTicket, type SalonAppointment, type SalonClient, type VisitLine } from '../../lib/salon';

type Method = 'cash' | 'mobile' | 'card' | 'split';

/**
 * Ring up a visit.
 *
 * Built for one hand and a queue at the door: who (a regular, a phone number or
 * just "walk-in"), which barber, tap the services, take the money. Every
 * service's price is editable on the ticket, because a fade on a regular is not
 * always list price and the book should say what was actually charged.
 */
export function NewSaleSheet({ open, onClose, fromAppointment, initialServiceId, fromQueue, onRecorded }: {
  open: boolean; onClose: () => void; fromAppointment?: SalonAppointment | null; initialServiceId?: string | null;
  /** A walk-in from today's queue: their name, phone, chosen services and barber come along. */
  fromQueue?: QueueTicket | null;
  onRecorded?: () => void;
}) {
  const { lang, fmt, owner } = useSettings();
  const sw = lang === 'sw';
  const { staffMembers, activeStaff, activeBusiness } = useData();
  const { services, clients, recordVisit } = useSalon();
  const { flash } = useToast();
  const settings = activeBusiness?.settings || {};
  // Who cuts hair. A barber in staff mode records only their own chair; a
  // cashier (or someone who does both) rings up for whoever did the work.
  const barbers = staffMembers.filter((m) => (m.salon_role || 'barber') !== 'cashier');
  const myRole = activeStaff ? staffMembers.find((m) => m.id === activeStaff.id)?.salon_role || 'barber' : null;
  const lockedToSelf = !owner && !!activeStaff && myRole === 'barber';
  const canEditPrice = owner || settings.staff_edit_price !== false;
  const canDiscount = owner || settings.staff_discount === true;

  const [client, setClient] = useState<SalonClient | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [query, setQuery] = useState('');
  const [barberId, setBarberId] = useState<string | null>(null);
  const [lines, setLines] = useState<VisitLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [tip, setTip] = useState('');
  const [method, setMethod] = useState<Method>('cash');
  const [split, setSplit] = useState({ cash: '', mobile: '', card: '' });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Fresh ticket each time it opens; prefilled when it comes from a booking.
  useEffect(() => {
    if (!open) return;
    const a = fromAppointment;
    const c = a?.client_id ? clients.find((x) => x.id === a.client_id) || null : null;
    setClient(c);
    setName(a && !c ? a.client_name : '');
    setPhone(a && !c ? a.client_phone || '' : '');
    setQuery('');
    setBarberId(a?.barber_id ?? (lockedToSelf ? activeStaff!.id : barbers.length === 1 ? barbers[0].id : null));
    const q = fromQueue;
    if (q && !a) {
      const qc = q.client_phone ? clients.find((x) => x.phone === q.client_phone) || null : null;
      setClient(qc);
      setName(qc ? '' : q.client_name.startsWith('Walk-in #') ? '' : q.client_name);
      setPhone(qc ? '' : q.client_phone || '');
      if (q.barber_id) setBarberId(q.barber_id);
    }
    const first = a ? services.filter((s) => a.service_ids.includes(s.id))
      : q ? services.filter((s) => q.service_ids.includes(s.id))
      : services.filter((s) => s.id === initialServiceId);
    setLines(first.map((s) => ({ service_id: s.id, name: s.name, list_price: Number(s.price), price_charged: Number(s.price), qty: 1 })));
    setDiscount(''); setTip(''); setMethod('cash'); setSplit({ cash: '', mobile: '', card: '' }); setNote(''); setError(''); setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const active = services.filter((s) => s.active);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return clients.filter((c) => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q.replace(/\s/g, ''))).slice(0, 6);
  }, [query, clients]);

  const totals = visitTotals(lines, Number(discount) || 0, Number(tip) || 0);
  const barberPct = barberId ? activeBusiness?.settings?.barber_commission?.[barberId] : undefined;
  const commission = visitCommission(lines, totals.discount, totals.tip, services, barberPct ?? null, !!barberId);
  const splitSum = (Number(split.cash) || 0) + (Number(split.mobile) || 0) + (Number(split.card) || 0);

  function toggle(id: string) {
    haptic(8);
    setLines((ls) => {
      if (ls.some((l) => l.service_id === id)) return ls.filter((l) => l.service_id !== id);
      const s = services.find((x) => x.id === id)!;
      return [...ls, { service_id: s.id, name: s.name, list_price: Number(s.price), price_charged: Number(s.price), qty: 1 }];
    });
  }

  async function save() {
    setError('');
    if (!lines.length) { setError(sw ? 'Chagua angalau huduma moja.' : 'Pick at least one service.'); return; }
    if (barbers.length > 0 && !barberId) { setError(sw ? 'Chagua kinyozi.' : 'Pick the barber.'); return; }
    const pay = method === 'split'
      ? { paid_cash: Number(split.cash) || 0, paid_mobile: Number(split.mobile) || 0, paid_card: Number(split.card) || 0 }
      : { paid_cash: method === 'cash' ? totals.total : 0, paid_mobile: method === 'mobile' ? totals.total : 0, paid_card: method === 'card' ? totals.total : 0 };
    if (method === 'split' && Math.abs(splitSum - totals.total) > 0.5) {
      setError(sw ? `Malipo ${fmt(splitSum)} hayalingani na jumla ${fmt(totals.total)}.` : `Payments ${fmt(splitSum)} don't match the total ${fmt(totals.total)}.`);
      return;
    }
    setBusy(true);
    const res = await recordVisit({
      client_id: client?.id || null,
      client_name: client ? undefined : name.trim() || undefined,
      client_phone: client ? undefined : phone.trim() || undefined,
      barber_id: barberId,
      items: lines,
      discount: totals.discount,
      tip: totals.tip,
      ...pay,
      appointment_id: fromAppointment?.id || null,
      note: note.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    haptic(20);
    flash(sw ? `Imerekodiwa — ${fmt(res.total)}` : `Recorded — ${fmt(res.total)}`);
    onRecorded?.();
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={sw ? 'Mauzo mapya' : 'New sale'} sub={fromAppointment ? `${fromAppointment.client_name} · ${fromAppointment.service_names || ''}` : fromQueue ? `#${fromQueue.number} · ${fromQueue.client_name}` : undefined}>
      {/* Who */}
      <div className="s-label">{sw ? 'Mteja' : 'Client'}</div>
      {client ? (
        <div className="card s-row" style={{ padding: '10px 12px' }}>
          <div style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--brandSoft)', color: 'var(--brand)', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{client.name.slice(0, 1).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{client.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{client.visits} {sw ? 'ziara' : 'visits'} · {fmt(client.total_spent)}{client.notes ? ` · ${client.notes}` : ''}</div>
          </div>
          <button type="button" className="chip tap" onClick={() => setClient(null)}>{sw ? 'Badilisha' : 'Change'}</button>
        </div>
      ) : (
        <>
          <input className="s-input" placeholder={sw ? 'Tafuta mteja kwa jina au simu…' : 'Find a client by name or phone…'} value={query} onChange={(e) => setQuery(e.target.value)} />
          {matches.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {matches.map((c) => (
                <button key={c.id} type="button" className="s-svc tap" onClick={() => { setClient(c); setQuery(''); }}>
                  <Icon name="user" size={14} />
                  <span style={{ flex: 1, fontWeight: 800, fontSize: 13.5 }}>{c.name}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{c.phone || ''}</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <input className="s-input" placeholder={sw ? 'Jina (hiari)' : 'Name (optional)'} value={name} onChange={(e) => setName(e.target.value)} />
            <input className="s-input" placeholder={sw ? 'Simu (hiari)' : 'Phone (optional)'} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600, marginTop: 5 }}>
            {sw ? 'Ukiacha wazi ni "mteja wa kupita". Ukiweka simu, mteja anahifadhiwa na historia yake.' : 'Leave blank for a walk-in. Add a phone and the client is saved with their history.'}
          </div>
        </>
      )}

      {/* Barber */}
      {barbers.length > 0 && (
        <>
          <div className="s-label">{sw ? 'Kinyozi aliyehudumia' : 'Who did the work'}</div>
          <div className="s-chipset">
            {barbers.map((m) => (
              <button key={m.id} type="button" aria-pressed={barberId === m.id} onClick={() => setBarberId(m.id)} disabled={lockedToSelf && activeStaff?.id !== m.id}>
                {m.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Services */}
      <div className="s-label">{sw ? 'Huduma' : 'Services'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 7 }}>
        {active.map((s) => {
          const on = lines.some((l) => l.service_id === s.id);
          return (
            <button key={s.id} type="button" className="s-svc tap" aria-pressed={on} onClick={() => toggle(s.id)}>
              <span style={{ width: 18, height: 18, borderRadius: 6, border: `2px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand)' : 'transparent', display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0 }}>
                {on && <Icon name="check" size={11} />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                <span style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{fmt(Number(s.price))} · {s.duration_min}′</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* The ticket: price per customer */}
      {lines.length > 0 && (
        <div className="card" style={{ marginTop: 12, padding: 12 }}>
          {lines.map((l, i) => (
            <div key={l.service_id || i} className="s-row" style={{ padding: '6px 0', borderTop: i ? '1px solid var(--line)' : undefined }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{l.name}</div>
                {l.price_charged !== l.list_price && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: l.price_charged > l.list_price ? 'var(--ok)' : 'var(--warn)' }}>
                    {sw ? 'Bei ya orodha' : 'List'} {fmt(l.list_price)}
                  </div>
                )}
              </div>
              <input
                aria-label={sw ? `Bei ya ${l.name}` : `Price for ${l.name}`}
                className="s-input"
                style={{ width: 110, textAlign: 'right', padding: '8px 10px' }}
                inputMode="numeric"
                readOnly={!canEditPrice}
                value={String(l.price_charged)}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(/[^0-9.]/g, '')) || 0;
                  setLines((ls) => ls.map((x, j) => (j === i ? { ...x, price_charged: v } : x)));
                }}
              />
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: canDiscount ? '1fr 1fr' : '1fr', gap: 8, marginTop: 8 }}>
            {canDiscount && <input className="s-input" inputMode="numeric" placeholder={sw ? 'Punguzo' : 'Discount'} value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^0-9.]/g, ''))} />}
            <input className="s-input" inputMode="numeric" placeholder={sw ? 'Bakshishi' : 'Tip'} value={tip} onChange={(e) => setTip(e.target.value.replace(/[^0-9.]/g, ''))} />
          </div>
          <div className="s-row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink2)', fontWeight: 700 }}>
              {owner && barberId ? `${sw ? 'Kamisheni' : 'Commission'} ${fmt(commission)}` : `${lines.length} ${sw ? 'huduma' : lines.length === 1 ? 'service' : 'services'}`}
            </span>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.4 }}>{fmt(totals.total)}</span>
          </div>
        </div>
      )}

      {/* Money */}
      <div className="s-label">{sw ? 'Malipo' : 'Payment'}</div>
      <div className="s-seg" role="group">
        {(['cash', 'mobile', 'card', 'split'] as Method[]).map((m) => (
          <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)}>
            {m === 'cash' ? (sw ? 'Taslimu' : 'Cash') : m === 'mobile' ? (sw ? 'Simu' : 'Mobile') : m === 'card' ? (sw ? 'Kadi' : 'Card') : (sw ? 'Gawanya' : 'Split')}
          </button>
        ))}
      </div>
      {method === 'split' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 8 }}>
          {(['cash', 'mobile', 'card'] as const).map((k) => (
            <input key={k} className="s-input" inputMode="numeric" placeholder={k === 'cash' ? (sw ? 'Taslimu' : 'Cash') : k === 'mobile' ? (sw ? 'Simu' : 'Mobile') : (sw ? 'Kadi' : 'Card')}
              value={split[k]} onChange={(e) => setSplit((s) => ({ ...s, [k]: e.target.value.replace(/[^0-9.]/g, '') }))} />
          ))}
        </div>
      )}
      <input className="s-input" style={{ marginTop: 8 }} placeholder={sw ? 'Maelezo (hiari) — mfano "#1 pembeni, #3 juu"' : 'Note (optional) — e.g. "#1 sides, #3 top"'} value={note} onChange={(e) => setNote(e.target.value)} />

      {error && <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--badSoft)', color: 'var(--bad)', fontSize: 12.5, fontWeight: 700 }}>{error}</div>}
      <button type="button" className="btn-primary tap" style={{ width: '100%', marginTop: 14, border: 'none' }} data-disabled={busy || !lines.length} onClick={save}>
        {busy ? (sw ? 'Inahifadhi…' : 'Saving…') : `${sw ? 'Lipwa' : 'Paid'} · ${fmt(totals.total)}`}
      </button>
    </Sheet>
  );
}
