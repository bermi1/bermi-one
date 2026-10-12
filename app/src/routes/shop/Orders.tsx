import { useMemo, useState } from 'react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../lib/icons';
import { useSettings } from '../../lib/useSettings';
import { useData } from '../../state/DataContext';
import { useShop } from '../../state/ShopContext';
import { useToast } from '../../state/ToastContext';
import { METHOD_LABEL, STATUS_LABEL, shopError, storeUrl, waLink, type OrderStatus, type ShopOrder } from '../../lib/shop';
import { printReceipt } from '../../lib/shopMedia';

type Tab = 'new' | 'pack' | 'out' | 'done' | 'all';
const TAB_STATUSES: Record<Exclude<Tab, 'all'>, OrderStatus[]> = {
  new: ['new', 'pending_payment'],
  pack: ['confirmed', 'packed'],
  out: ['ready', 'out_for_delivery'],
  done: ['completed', 'cancelled'],
};

export function statusTone(s: OrderStatus) {
  if (s === 'completed') return { bg: 'var(--okSoft)', fg: 'var(--ok)' };
  if (s === 'cancelled') return { bg: 'var(--badSoft)', fg: 'var(--bad)' };
  if (s === 'new' || s === 'pending_payment') return { bg: 'var(--warnSoft)', fg: 'var(--warn)' };
  return { bg: 'var(--brandSoft)', fg: 'var(--brand)' };
}

/**
 * Online orders as a pipeline — new, packing, on the way, done — and every
 * counter sale alongside. Each step is a button, and the customer can be told
 * about it on WhatsApp in one more tap.
 */
export function Orders() {
  const { lang, fmt } = useSettings();
  const sw = lang === 'sw';
  const { orders, loaded } = useShop();
  const [tab, setTab] = useState<Tab>('new');
  const [open, setOpen] = useState<ShopOrder | null>(null);
  const [q, setQ] = useState('');

  const online = orders.filter((o) => o.channel === 'online');
  const counts = Object.fromEntries((Object.keys(TAB_STATUSES) as (keyof typeof TAB_STATUSES)[]).map((k) => [k, online.filter((o) => TAB_STATUSES[k].includes(o.status)).length]));
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = tab === 'all' ? orders : online.filter((o) => TAB_STATUSES[tab].includes(o.status));
    return s ? base.filter((o) => String(o.number).includes(s) || (o.customer_name || '').toLowerCase().includes(s) || (o.customer_phone || '').includes(s)) : base;
  }, [orders, online, tab, q]);
  const current = open ? orders.find((o) => o.id === open.id) || open : null;

  return (
    <div className="screen sb">
      <ScreenHeader title={sw ? 'Oda' : 'Orders'} sub={counts.new ? (sw ? `${counts.new} mpya zinasubiri` : `${counts.new} new waiting`) : (sw ? 'Mtandaoni na kaunta' : 'Online and at the counter')} />
      <input className="s-input" style={{ marginTop: 6 }} placeholder={sw ? 'Tafuta namba, jina au simu…' : 'Search number, name or phone…'} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="s-seg" style={{ marginTop: 10, overflowX: 'auto' }}>
        {([['new', sw ? 'Mpya' : 'New'], ['pack', sw ? 'Kufunga' : 'To pack'], ['out', sw ? 'Tayari' : 'Ready/out'], ['done', sw ? 'Zimeisha' : 'Done'], ['all', sw ? 'Mauzo yote' : 'All sales']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} style={{ whiteSpace: 'nowrap' }}>
            {l}{k !== 'all' && k !== 'done' && counts[k] ? ` ${counts[k]}` : ''}
          </button>
        ))}
      </div>

      {!loaded ? <div className="skeleton" style={{ height: 220, marginTop: 12 }} /> : list.length === 0 ? (
        <div className="card empty" style={{ marginTop: 12 }}>
          {tab === 'new' ? (sw ? 'Hakuna oda mpya. Shiriki duka lako ili wateja waagize.' : 'No new orders. Share your store so customers can order.') : (sw ? 'Hakuna oda hapa.' : 'Nothing here.')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {list.slice(0, 200).map((o) => {
            const tone = statusTone(o.status);
            return (
              <div key={o.id} className="card tap" onClick={() => setOpen(o)} style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 52, flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>#{o.number}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--ink3)' }}>{o.channel === 'online' ? (sw ? 'MTANDAO' : 'ONLINE') : (sw ? 'KAUNTA' : 'COUNTER')}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.customer_name || (sw ? 'Mteja wa kaunta' : 'Walk-in')}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(o.items || []).reduce((n, l) => n + Number(l.qty), 0)} {sw ? 'bidhaa' : 'items'} · {o.fulfilment === 'delivery' ? `${sw ? 'Kuleta' : 'Delivery'}${o.delivery_area ? ` · ${o.delivery_area}` : ''}` : o.fulfilment === 'pickup' ? (sw ? 'Kuchukua' : 'Pickup') : new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>{fmt(Number(o.total))}</div>
                  <span className="s-badge" style={{ background: tone.bg, color: tone.fg }}>{STATUS_LABEL[o.status][sw ? 1 : 0]}</span>
                  {o.payment_status !== 'paid' && o.status !== 'cancelled' && <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--bad)', marginTop: 2 }}>{sw ? 'HAIJALIPWA' : 'UNPAID'}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {current && <OrderSheet o={current} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function OrderSheet({ o, onClose }: { o: ShopOrder; onClose: () => void }) {
  const { lang, fmt } = useSettings();
  const sw = lang === 'sw';
  const { activeBusiness } = useData();
  const { setOrderStatus } = useShop();
  const { flash } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const shop = activeBusiness?.name || '';
  const closed = o.status === 'completed' || o.status === 'cancelled';
  const paid = o.payment_status === 'paid';
  const link = storeUrl(activeBusiness?.slug, `/o/${o.token}`);

  const next: [OrderStatus, string][] = o.channel !== 'online' || closed ? [] : o.status === 'new' || o.status === 'pending_payment'
    ? [['confirmed', sw ? 'Kubali oda' : 'Accept order']]
    : o.status === 'confirmed' ? [['packed', sw ? 'Imefungwa' : 'Mark packed']]
    : o.status === 'packed' ? [[o.fulfilment === 'delivery' ? 'out_for_delivery' : 'ready', o.fulfilment === 'delivery' ? (sw ? 'Imetumwa' : 'Out for delivery') : (sw ? 'Iko tayari kuchukuliwa' : 'Ready for pickup')]]
    : [['completed', sw ? 'Imekabidhiwa' : 'Handed over']];

  function tell(s: OrderStatus) {
    const msg: Partial<Record<OrderStatus, [string, string]>> = {
      confirmed: [`Hi ${o.customer_name || ''}, ${shop} has your order #${o.number}. We're preparing it now.`, `Habari ${o.customer_name || ''}, ${shop} imepokea oda yako #${o.number}. Tunaiandaa sasa.`],
      ready: [`Your order #${o.number} from ${shop} is ready for pickup.`, `Oda yako #${o.number} kutoka ${shop} iko tayari kuchukuliwa.`],
      out_for_delivery: [`Your order #${o.number} from ${shop} is on its way.`, `Oda yako #${o.number} kutoka ${shop} iko njiani.`],
      completed: [`Thank you for shopping at ${shop}! 🙏`, `Asante kwa kununua ${shop}! 🙏`],
    };
    const m = msg[s];
    return m ? `${m[sw ? 1 : 0]}\n${link}` : link;
  }

  async function go(s: OrderStatus, markPaid = false) {
    if (s === 'completed' && !paid && !markPaid) { flash(sw ? 'Weka imelipwa kwanza' : 'Mark it paid first'); return; }
    setBusy(true);
    const err = await setOrderStatus(o.id, s, markPaid);
    setBusy(false);
    if (err) { flash(shopError(err, sw)); return; }
    flash(sw ? 'Imesasishwa' : 'Updated');
  }

  return (
    <Sheet open onClose={onClose} title={`#${o.number} · ${o.customer_name || (sw ? 'Mteja' : 'Walk-in')}`} sub={`${new Date(o.created_at).toLocaleString()} · ${METHOD_LABEL[o.payment_method][sw ? 1 : 0]}`}>
      <div className="s-row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <span className="s-badge" style={{ background: statusTone(o.status).bg, color: statusTone(o.status).fg }}>{STATUS_LABEL[o.status][sw ? 1 : 0]}</span>
        <span className="s-badge" style={{ background: paid ? 'var(--okSoft)' : 'var(--badSoft)', color: paid ? 'var(--ok)' : 'var(--bad)' }}>{paid ? (sw ? 'Imelipwa' : 'Paid') : o.payment_status === 'refunded' ? (sw ? 'Imerejeshwa' : 'Refunded') : (sw ? 'Haijalipwa' : 'Unpaid')}</span>
        {o.fulfilment !== 'counter' && <span className="s-badge" style={{ background: 'var(--card2)', color: 'var(--ink2)' }}>{o.fulfilment === 'delivery' ? (sw ? 'Kuleta' : 'Delivery') : (sw ? 'Kuchukua' : 'Pickup')}</span>}
      </div>

      {o.fulfilment === 'delivery' && (
        <div className="card" style={{ marginTop: 10, padding: 12, fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>
          <div><Icon name="truck" size={14} /> {o.delivery_area}</div>
          <div style={{ color: 'var(--ink2)' }}>{o.delivery_address}</div>
        </div>
      )}
      {o.note && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--ink2)' }}>“{o.note}”</div>}

      <div className="card" style={{ marginTop: 10, padding: '2px 12px' }}>
        {(o.items || []).map((l, i) => (
          <div key={i} className="s-row" style={{ padding: '8px 0', borderTop: i ? '1px solid var(--line)' : undefined, fontSize: 13, fontWeight: 700 }}>
            <span style={{ width: 30, color: 'var(--ink3)' }}>{l.qty}×</span>
            <span style={{ flex: 1, minWidth: 0 }}>{l.name}</span>
            <span>{fmt(Number(l.line_total))}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 4, marginTop: 10, fontSize: 13, fontWeight: 700, color: 'var(--ink2)' }}>
        {Number(o.discount) > 0 && <Row l={`${sw ? 'Punguzo' : 'Discount'}${o.promo_code ? ` (${o.promo_code})` : ''}`} r={'−' + fmt(Number(o.discount))} />}
        {Number(o.delivery_fee) > 0 && <Row l={sw ? 'Usafirishaji' : 'Delivery'} r={fmt(Number(o.delivery_fee))} />}
        {Number(o.points_value) > 0 && <Row l={sw ? 'Pointi' : 'Points'} r={'−' + fmt(Number(o.points_value))} />}
        {Number(o.gift_amount) > 0 && <Row l={sw ? 'Kadi ya zawadi' : 'Gift card'} r={'−' + fmt(Number(o.gift_amount))} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink)', fontSize: 16, fontWeight: 800 }}><span>{sw ? 'Jumla' : 'Total'}</span><span>{fmt(Number(o.total))}</span></div>
      </div>

      {!closed && (
        <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
          {!paid && o.payment_method !== 'payme' && Number(o.total) > 0 && (
            <button type="button" className="btn-ghost tap" disabled={busy} onClick={() => go(o.status === 'pending_payment' ? 'new' : o.status, true)} style={{ color: 'var(--ok)' }}>
              <Icon name="check" size={15} /> {o.payment_method === 'till' ? (sw ? 'Malipo ya till yamepokelewa' : 'Till payment received') : (sw ? 'Pesa imepokelewa' : 'Payment received')}
            </button>
          )}
          {!paid && o.payment_method === 'payme' && (
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink2)', textAlign: 'center' }}>{sw ? 'Inasubiri mteja alipe kwa simu.' : 'Waiting for the customer to pay on their phone.'}</div>
          )}
          {next.map(([s, label]) => (
            <button key={s} type="button" className="btn-primary tap" disabled={busy} style={{ border: 'none' }} onClick={() => go(s)}>{label}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: o.customer_phone ? '1fr 1fr 1fr' : '1fr', gap: 8, marginTop: 8 }}>
        {o.customer_phone && <a className="btn-ghost tap" style={{ textDecoration: 'none', fontSize: 13 }} href={waLink(o.customer_phone, tell(o.status))} target="_blank" rel="noreferrer"><Icon name="chat" size={14} /> WhatsApp</a>}
        {o.customer_phone && <a className="btn-ghost tap" style={{ textDecoration: 'none', fontSize: 13 }} href={`tel:${o.customer_phone}`}><Icon name="phone" size={14} /> {sw ? 'Piga' : 'Call'}</a>}
        <button type="button" className="btn-ghost tap" style={{ fontSize: 13 }} onClick={() => printReceipt(o, { shop, fmt, sw })}><Icon name="print" size={14} /> {sw ? 'Chapisha' : 'Print'}</button>
      </div>

      {!closed && (confirmCancel ? (
        <div className="card" style={{ marginTop: 12, padding: 12, background: 'var(--badSoft)' }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>{sw ? 'Ghairi oda hii? Stoo, kadi ya zawadi na pointi vitarudishwa.' : 'Cancel this order? Stock, gift card and points go back.'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            <button type="button" className="btn-ghost tap" onClick={() => setConfirmCancel(false)}>{sw ? 'Hapana' : 'Keep it'}</button>
            <button type="button" className="btn-primary tap" style={{ border: 'none', background: 'var(--bad)' }} onClick={() => { setConfirmCancel(false); void go('cancelled'); }}>{sw ? 'Ndiyo, ghairi' : 'Yes, cancel'}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="tap" onClick={() => setConfirmCancel(true)} style={{ width: '100%', marginTop: 12, padding: 10, color: 'var(--bad)', fontWeight: 800, fontSize: 13 }}>{sw ? 'Ghairi oda' : 'Cancel order'}</button>
      ))}
    </Sheet>
  );
}

function Row({ l, r }: { l: string; r: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{l}</span><span>{r}</span></div>;
}
