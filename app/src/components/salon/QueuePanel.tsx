import { useState } from 'react';
import { Icon } from '../../lib/icons';
import { useSettings } from '../../lib/useSettings';
import { useData } from '../../state/DataContext';
import { useSalon } from '../../state/SalonContext';
import { useToast } from '../../state/ToastContext';
import { haptic } from '../../lib/haptics';
import { Sheet } from '../Sheet';
import { NewSaleSheet } from './NewSaleSheet';
import type { QueueTicket } from '../../lib/salon';

/**
 * Today's walk-in queue, as the shop runs it.
 *
 * Customers join online and get a number; the desk adds people who walk in.
 * Call the next number, start them in a chair, and "Done" rings up the sale
 * with their name and services already on the ticket.
 */
export function QueuePanel() {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const { staffMembers } = useData();
  const { queue, services, addToQueue, setQueueStatus } = useSalon();
  const { flash } = useToast();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [checkout, setCheckout] = useState<QueueTicket | null>(null);
  const [startFor, setStartFor] = useState<QueueTicket | null>(null);

  const barbers = staffMembers.filter((m) => (m.salon_role || 'barber') !== 'cashier');
  const active = queue.filter((q) => ['waiting', 'called', 'serving'].includes(q.status));
  const waiting = active.filter((q) => q.status !== 'serving');
  const serving = active.filter((q) => q.status === 'serving');
  const nowServing = Math.max(0, ...queue.filter((q) => ['called', 'serving', 'done'].includes(q.status)).map((q) => q.number));
  const done = queue.filter((q) => q.status === 'done').length;

  async function add() {
    haptic();
    const err = await addToQueue(name.trim(), phone.trim(), picked);
    if (err) { flash(err); return; }
    setAdding(false); setName(''); setPhone(''); setPicked([]);
  }

  function start(q: QueueTicket, barberId: string | null) {
    haptic();
    void setQueueStatus(q.id, 'serving', barberId);
    setStartFor(null);
  }

  const mins = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

  return (
    <div style={{ marginTop: 20 }}>
      <div className="s-row" style={{ justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{sw ? 'Foleni ya leo' : "Today's queue"}</div>
        <button type="button" className="chip tap" onClick={() => setAdding(true)}><Icon name="plus" size={12} /> {sw ? 'Ongeza' : 'Walk-in'}</button>
      </div>
      <div className="card" style={{ marginTop: 10, padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ textAlign: 'center', minWidth: 74 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--ink3)', textTransform: 'uppercase' }}>{sw ? 'Sasa' : 'Now'}</div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, color: 'var(--brand)', lineHeight: 1.05 }}>#{nowServing || '–'}</div>
        </div>
        <div style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: 'var(--ink2)', lineHeight: 1.6 }}>
          <div><b style={{ color: 'var(--ink)' }}>{waiting.length}</b> {sw ? 'wanasubiri' : 'waiting'} · <b style={{ color: 'var(--ink)' }}>{serving.length}</b> {sw ? 'kitini' : 'in the chair'}</div>
          <div>{done} {sw ? 'wamehudumiwa leo' : 'served today'}</div>
        </div>
        {waiting.length > 0 && (
          <button type="button" className="btn-primary tap" style={{ border: 'none', padding: '12px 14px' }}
            onClick={() => { haptic(); void setQueueStatus(waiting[0].id, 'called'); flash(sw ? `Namba #${waiting[0].number} imeitwa` : `Calling #${waiting[0].number}`); }}>
            {sw ? 'Ita' : 'Call'} #{waiting[0].number}
          </button>
        )}
      </div>

      {active.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {active.map((q) => (
            <div key={q.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, borderLeft: `4px solid ${q.status === 'serving' ? 'var(--ok)' : q.status === 'called' ? 'var(--brand)' : 'var(--line)'}` }}>
              <div style={{ width: 44, textAlign: 'center', fontSize: 20, fontWeight: 800 }}>#{q.number}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {q.client_name} {q.source === 'online' && <span style={{ fontSize: 10.5, color: 'var(--brand)' }}>● {sw ? 'mtandaoni' : 'online'}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {q.service_names || (sw ? 'Huduma haijachaguliwa' : 'No service picked')}
                  {q.barber_name ? ` · ${q.barber_name.split(' ')[0]}` : ''} · {q.status === 'serving' ? `${mins(q.called_at || q.created_at)}′ ${sw ? 'kitini' : 'in chair'}` : `${mins(q.created_at)}′ ${sw ? 'anasubiri' : 'waiting'}`}
                </div>
              </div>
              {q.status === 'serving' ? (
                <button type="button" className="chip tap" style={{ background: 'var(--ok)', color: '#fff', border: 'none' }} onClick={() => setCheckout(q)}>{sw ? 'Maliza' : 'Done'}</button>
              ) : (
                <button type="button" className="chip tap" style={{ background: 'var(--brand)', color: '#fff', border: 'none' }} onClick={() => (barbers.length > 1 ? setStartFor(q) : start(q, barbers[0]?.id || null))}>{sw ? 'Anza' : 'Start'}</button>
              )}
              <button type="button" className="mini-btn tap" aria-label={sw ? 'Ameondoka' : 'Left'} onClick={() => { void setQueueStatus(q.id, 'left'); }}><Icon name="x" size={13} /></button>
            </div>
          ))}
        </div>
      )}

      <Sheet open={!!startFor} onClose={() => setStartFor(null)} title={startFor ? `#${startFor.number} · ${startFor.client_name}` : ''} sub={sw ? 'Nani anamhudumia?' : 'Who is taking them?'}>
        <div style={{ display: 'grid', gap: 8 }}>
          {barbers.map((m) => (
            <button key={m.id} type="button" className="btn-ghost tap" onClick={() => startFor && start(startFor, m.id)}>{m.name}</button>
          ))}
        </div>
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title={sw ? 'Ongeza kwenye foleni' : 'Add to the queue'}>
        <div style={{ display: 'grid', gap: 8 }}>
          <input className="field" placeholder={sw ? 'Jina (hiari)' : 'Name (optional)'} value={name} onChange={(e) => setName(e.target.value)} />
          <input className="field" inputMode="tel" placeholder={sw ? 'Simu (hiari)' : 'Phone (optional)'} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="section-label">{sw ? 'Huduma (hiari)' : 'Services (optional)'}</div>
        <div className="s-chipset">
          {services.filter((x) => x.active).map((x) => (
            <button key={x.id} type="button" aria-pressed={picked.includes(x.id)} onClick={() => setPicked((p) => (p.includes(x.id) ? p.filter((y) => y !== x.id) : [...p, x.id]))}>{x.name}</button>
          ))}
        </div>
        <button type="button" className="btn-primary tap" style={{ width: '100%', marginTop: 16, border: 'none' }} onClick={add}>{sw ? 'Mpe namba' : 'Give them a number'}</button>
      </Sheet>

      <NewSaleSheet open={!!checkout} onClose={() => setCheckout(null)} fromQueue={checkout}
        onRecorded={() => { if (checkout) void setQueueStatus(checkout.id, 'done'); }} />
    </div>
  );
}
