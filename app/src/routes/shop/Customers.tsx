import { useMemo, useState } from 'react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../lib/icons';
import { useSettings } from '../../lib/useSettings';
import { useData } from '../../state/DataContext';
import { useShop } from '../../state/ShopContext';
import { useToast } from '../../state/ToastContext';
import { lapsedCustomers, repeatRate, storeUrl, waLink, type ShopCustomer } from '../../lib/shop';

type Tab = 'recent' | 'top' | 'loyal' | 'lapsed';

/** Who buys, how often, what they have in points — and who has gone quiet. */
export function Customers() {
  const { lang, fmt, owner } = useSettings();
  const sw = lang === 'sw';
  const { customers, loaded } = useShop();
  const [tab, setTab] = useState<Tab>('recent');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<ShopCustomer | null>(null);
  const [adding, setAdding] = useState(false);

  const lapsed = useMemo(() => lapsedCustomers(customers), [customers]);
  const list = useMemo(() => {
    const base = tab === 'top' ? [...customers].sort((a, b) => b.total_spent - a.total_spent)
      : tab === 'loyal' ? customers.filter((c) => c.orders >= 3).sort((a, b) => b.orders - a.orders)
      : tab === 'lapsed' ? lapsed : customers;
    const s = q.trim().toLowerCase();
    return s ? base.filter((c) => c.name.toLowerCase().includes(s) || (c.phone || '').includes(s.replace(/\s/g, ''))) : base;
  }, [customers, lapsed, tab, q]);
  const current = open ? customers.find((c) => c.id === open.id) || open : null;
  const rate = repeatRate(customers);

  return (
    <div className="screen sb">
      <ScreenHeader title={sw ? 'Wateja' : 'Customers'} sub={`${customers.length} ${sw ? 'wateja' : 'customers'} · ${Math.round(rate * 100)}% ${sw ? 'wanarudi' : 'come back'}`}
        right={<button type="button" className="icon-btn tap" aria-label={sw ? 'Ongeza mteja' : 'Add customer'} onClick={() => setAdding(true)}><Icon name="plus" size={16} /></button>} />
      <input className="s-input" style={{ marginTop: 6 }} placeholder={sw ? 'Tafuta kwa jina au simu…' : 'Search by name or phone…'} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="s-seg" style={{ marginTop: 10 }}>
        <button type="button" aria-pressed={tab === 'recent'} onClick={() => setTab('recent')}>{sw ? 'Karibuni' : 'Recent'}</button>
        {owner && <button type="button" aria-pressed={tab === 'top'} onClick={() => setTab('top')}>{sw ? 'Bora' : 'Top'}</button>}
        <button type="button" aria-pressed={tab === 'loyal'} onClick={() => setTab('loyal')}>{sw ? 'Waaminifu' : 'Loyal'}</button>
        <button type="button" aria-pressed={tab === 'lapsed'} onClick={() => setTab('lapsed')}>{sw ? 'Warudishe' : 'Win back'}{lapsed.length ? ` ${lapsed.length}` : ''}</button>
      </div>
      {tab === 'lapsed' && lapsed.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600, marginTop: 8, lineHeight: 1.5 }}>
          {sw ? 'Walinunua lakini kimya siku 60+. Wapelekee ofa kwenye Masoko → Kampeni.' : 'Bought before, silent for 60+ days. Send them an offer from Marketing → Campaigns.'}
        </div>
      )}
      {!loaded ? <div className="skeleton" style={{ height: 220, marginTop: 12 }} /> : list.length === 0 ? (
        <div className="card empty" style={{ marginTop: 12 }}>
          {customers.length === 0 ? (sw ? 'Wateja wanaongezwa wenyewe wanapoagiza mtandaoni au ukiweka simu kwenye POS.' : 'Customers are added automatically when they order online or you take a phone number at the till.') : (sw ? 'Hakuna aliyepatikana.' : 'No one matches.')}
        </div>
      ) : (
        <div className="card" style={{ marginTop: 12, padding: '2px 12px' }}>
          {list.slice(0, 200).map((c, i) => (
            <div key={c.id} className="s-row tap" onClick={() => setOpen(c)} style={{ padding: '10px 0', borderTop: i ? '1px solid var(--line)' : undefined }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--brandSoft)', color: 'var(--brand)', display: 'grid', placeItems: 'center', fontWeight: 800, flexShrink: 0 }}>{(c.name || '?').slice(0, 1).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{c.name || c.phone}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{c.orders} {sw ? 'oda' : c.orders === 1 ? 'order' : 'orders'} · {c.points} {sw ? 'pointi' : 'pts'}{c.last_order_at ? ` · ${ago(c.last_order_at, sw)}` : ''}</div>
              </div>
              {owner && <div style={{ fontSize: 13, fontWeight: 800 }}>{fmt(Number(c.total_spent))}</div>}
            </div>
          ))}
        </div>
      )}
      {current && <CustomerSheet c={current} onClose={() => setOpen(null)} />}
      {adding && <CustomerSheet c={null} onClose={() => setAdding(false)} />}
    </div>
  );
}

function ago(iso: string, sw: boolean) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? (sw ? 'leo' : 'today') : sw ? `siku ${d} zilizopita` : `${d}d ago`;
}

function CustomerSheet({ c, onClose }: { c: ShopCustomer | null; onClose: () => void }) {
  const { lang, fmt, owner } = useSettings();
  const sw = lang === 'sw';
  const { activeBusiness } = useData();
  const { orders, saveCustomer } = useShop();
  const { flash } = useToast();
  const [name, setName] = useState(c?.name || '');
  const [phone, setPhone] = useState(c?.phone || '');
  const [points, setPoints] = useState(String(c?.points ?? 0));
  const [optOut, setOptOut] = useState(!!c?.sms_opt_out);
  const [editing, setEditing] = useState(!c);
  const mine = c ? orders.filter((o) => o.customer_id === c.id) : [];

  async function save() {
    if (!name.trim() && !phone.trim()) { flash(sw ? 'Weka jina au simu' : 'Enter a name or phone'); return; }
    const err = await saveCustomer({ id: c?.id, name: name.trim() || phone, phone, points: Number(points) || 0, sms_opt_out: optOut });
    if (err) { flash(err); return; }
    flash(sw ? 'Imehifadhiwa' : 'Saved');
    if (c) setEditing(false); else onClose();
  }

  const hello = c ? (sw
    ? `Habari ${c.name.split(' ')[0]}! Tumekukumbuka ${activeBusiness?.name}. Una pointi ${c.points}. Karibu: ${storeUrl(activeBusiness?.slug)}`
    : `Hi ${c.name.split(' ')[0]}! We miss you at ${activeBusiness?.name}. You have ${c.points} points waiting. Shop: ${storeUrl(activeBusiness?.slug)}`) : '';

  return (
    <Sheet open onClose={onClose} title={c ? c.name || c.phone || '' : (sw ? 'Mteja mpya' : 'New customer')} sub={c?.phone || undefined}>
      {c && !editing && (
        <>
          <div className="s-kpis">
            <div className="s-kpi"><span>{sw ? 'Oda' : 'Orders'}</span><b>{c.orders}</b></div>
            <div className="s-kpi"><span>{sw ? 'Pointi' : 'Points'}</span><b>{c.points}</b></div>
            <div className="s-kpi"><span>{sw ? 'Ametumia' : 'Spent'}</span><b>{owner ? fmt(Number(c.total_spent)) : '—'}</b></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: c.phone ? '1fr 1fr 1fr' : '1fr', gap: 8, marginTop: 12 }}>
            {c.phone && <a className="btn-ghost tap" style={{ textDecoration: 'none', fontSize: 13 }} href={waLink(c.phone, hello)} target="_blank" rel="noreferrer"><Icon name="chat" size={14} /> WhatsApp</a>}
            {c.phone && <a className="btn-ghost tap" style={{ textDecoration: 'none', fontSize: 13 }} href={`tel:${c.phone}`}><Icon name="phone" size={14} /> {sw ? 'Piga' : 'Call'}</a>}
            {owner && <button type="button" className="btn-ghost tap" style={{ fontSize: 13 }} onClick={() => setEditing(true)}><Icon name="edit" size={14} /> {sw ? 'Hariri' : 'Edit'}</button>}
          </div>
          {c.sms_opt_out && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: 'var(--warn)' }}>{sw ? 'Hapokei SMS za kampeni.' : 'Opted out of campaign SMS.'}</div>}
          <div className="section-label">{sw ? 'Oda za siku 35' : 'Orders, last 35 days'}</div>
          {mine.length === 0 ? <div className="empty">{sw ? 'Hakuna za karibuni.' : 'None recently.'}</div> : (
            <div className="card" style={{ padding: '2px 12px' }}>
              {mine.slice(0, 20).map((o, i) => (
                <div key={o.id} className="s-row" style={{ padding: '8px 0', borderTop: i ? '1px solid var(--line)' : undefined, fontSize: 12.5, fontWeight: 700 }}>
                  <span style={{ width: 52 }}>#{o.number}</span>
                  <span style={{ flex: 1, color: 'var(--ink3)' }}>{new Date(o.created_at).toLocaleDateString()} · {o.channel === 'online' ? (sw ? 'mtandao' : 'online') : (sw ? 'kaunta' : 'counter')}</span>
                  <span>{fmt(Number(o.total))}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {editing && (
        <div style={{ display: 'grid', gap: 8 }}>
          <input className="field" placeholder={sw ? 'Jina' : 'Name'} value={name} onChange={(e) => setName(e.target.value)} />
          <input className="field" inputMode="tel" placeholder={sw ? 'Simu' : 'Phone'} value={phone} onChange={(e) => setPhone(e.target.value)} />
          {owner && <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink3)' }}>{sw ? 'Pointi' : 'Points'}<input className="field" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} style={{ marginTop: 4 }} /></label>}
          <label className="s-row" style={{ fontSize: 13, fontWeight: 700 }}>
            <input type="checkbox" checked={optOut} onChange={(e) => setOptOut(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--brand)' }} />
            {sw ? 'Asipokee SMS za kampeni' : 'No campaign SMS'}
          </label>
          <button type="button" className="btn-primary tap" style={{ border: 'none', marginTop: 4 }} onClick={save}>{sw ? 'Hifadhi' : 'Save'}</button>
        </div>
      )}
    </Sheet>
  );
}
