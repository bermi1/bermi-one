import { useEffect, useMemo, useRef, useState } from 'react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../lib/icons';
import { useSettings } from '../../lib/useSettings';
import { useData } from '../../state/DataContext';
import { useShop, type PosResult } from '../../state/ShopContext';
import { useToast } from '../../state/ToastContext';
import { haptic } from '../../lib/haptics';
import { shopError, storeUrl, waLink, type CartItem, type Quote, type ShopProduct } from '../../lib/shop';
import { printReceipt, receiptText } from '../../lib/shopMedia';

type Pay = 'cash' | 'mobile' | 'card' | 'split';

/**
 * The counter. Tap or scan to build the cart, take a phone number to find the
 * customer and their points, and charge. Every total comes back from the
 * database's pricing, so what the till says is what the books say.
 */
export function Pos() {
  const { lang, fmt } = useSettings();
  const sw = lang === 'sw';
  const { activeBusiness } = useData();
  const { products, loaded, quote, sell, customers } = useShop();
  const { flash } = useToast();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const cats = useMemo(() => [...new Set(products.filter((p) => p.active && p.category).map((p) => p.category!))].sort(), [products]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => p.active && (!cat || p.category === cat) && (!s || p.name.toLowerCase().includes(s) || (p.sku || '').toLowerCase() === s || (p.barcode || '') === s));
  }, [products, q, cat]);

  const count = cart.reduce((n, c) => n + c.qty, 0);
  const rough = cart.reduce((s, c) => s + (Number(byId.get(c.product_id)?.price) || 0) * c.qty, 0);
  const inCart = (id: string) => cart.find((c) => c.product_id === id)?.qty || 0;

  function add(p: ShopProduct, n = 1) {
    if (p.track_stock && inCart(p.id) + n > p.stock) { flash(sw ? `${p.name}: stoo ni ${p.stock} tu` : `Only ${p.stock} ${p.name} in stock`); return; }
    haptic();
    setCart((xs) => {
      const has = xs.find((x) => x.product_id === p.id);
      const next = has ? xs.map((x) => (x.product_id === p.id ? { ...x, qty: x.qty + n } : x)) : [...xs, { product_id: p.id, qty: n }];
      return next.filter((x) => x.qty > 0);
    });
  }

  // A barcode scanner types the code and presses Enter.
  function onScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const code = q.trim();
    if (!code) return;
    const hit = products.find((p) => p.active && ((p.barcode && p.barcode === code) || (p.sku && p.sku.toLowerCase() === code.toLowerCase())))
      || (list.length === 1 ? list[0] : null);
    if (hit) { add(hit); setQ(''); } else flash(sw ? 'Bidhaa haijapatikana' : 'No product with that code');
  }

  return (
    <div className="screen sb" style={{ paddingBottom: count ? 170 : undefined }}>
      <ScreenHeader title={sw ? 'Uza' : 'Sell'} sub={activeBusiness?.name} />
      <div style={{ position: 'relative', marginTop: 6 }}>
        <input ref={scanRef} className="s-input" style={{ paddingLeft: 40 }} placeholder={sw ? 'Tafuta, au piga skana ya barcode…' : 'Search, or scan a barcode…'} value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={onScan} aria-label={sw ? 'Tafuta au skana' : 'Search or scan'} />
        <span style={{ position: 'absolute', left: 13, top: 13, color: 'var(--ink3)' }}><Icon name="scan" size={17} /></span>
      </div>
      {cats.length > 1 && (
        <div className="s-chipset" style={{ marginTop: 10, flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 2 }}>
          <button type="button" aria-pressed={!cat} onClick={() => setCat(null)}>{sw ? 'Zote' : 'All'}</button>
          {cats.map((c) => <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(cat === c ? null : c)} style={{ whiteSpace: 'nowrap' }}>{c}</button>)}
        </div>
      )}

      {!loaded ? <div className="skeleton" style={{ height: 260, marginTop: 12 }} /> : products.length === 0 ? (
        <div className="card empty" style={{ marginTop: 12 }}>{sw ? 'Bado hakuna bidhaa. Ongeza kwenye Bidhaa.' : 'No products yet. Add them under Products.'}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginTop: 12 }}>
          {list.map((p) => {
            const out = p.track_stock && p.stock <= 0;
            const n = inCart(p.id);
            return (
              <button key={p.id} type="button" className="card tap" disabled={out} onClick={() => add(p)}
                style={{ padding: 0, textAlign: 'left', overflow: 'hidden', opacity: out ? 0.45 : 1, position: 'relative', outline: n ? '2px solid var(--brand)' : undefined }}>
                <div style={{ aspectRatio: '4 / 3', background: 'var(--card2)', display: 'grid', placeItems: 'center', color: 'var(--ink3)' }}>
                  {p.images?.[0] ? <img src={p.images[0]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="tag" size={22} />}
                </div>
                <div style={{ padding: '8px 10px 10px' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand)' }}>{fmt(Number(p.price))}</span>
                    {p.track_stock && <span style={{ fontSize: 10.5, fontWeight: 800, color: p.stock <= p.low_stock ? 'var(--warn)' : 'var(--ink3)' }}>{out ? (sw ? 'Imeisha' : 'Out') : `${p.stock}`}</span>}
                  </div>
                </div>
                {n > 0 && <span style={{ position: 'absolute', top: 8, right: 8, minWidth: 24, height: 24, borderRadius: 12, background: 'var(--brand)', color: '#fff', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 6px' }}>{n}</span>}
              </button>
            );
          })}
          {list.length === 0 && <div className="empty" style={{ gridColumn: '1 / -1' }}>{sw ? 'Hakuna kinacholingana.' : 'Nothing matches.'}</div>}
        </div>
      )}

      {count > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(86px + env(safe-area-inset-bottom))', zIndex: 39, display: 'flex', justifyContent: 'center', padding: '0 16px', pointerEvents: 'none' }}>
          <div className="pos-bar" style={{ pointerEvents: 'auto', width: '100%', maxWidth: 520, display: 'flex', gap: 8 }}>
            <button type="button" className="btn-ghost tap" onClick={() => setCart([])} aria-label={sw ? 'Futa kikapu' : 'Clear cart'} style={{ padding: '14px 16px' }}><Icon name="trash" size={16} /></button>
            <button type="button" className="btn-primary tap" style={{ flex: 1, border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => setOpen(true)}>
              <span>{count} {sw ? 'bidhaa' : count === 1 ? 'item' : 'items'}</span>
              <span>{sw ? 'Lipisha' : 'Charge'} {fmt(rough)} →</span>
            </button>
          </div>
        </div>
      )}

      <Checkout open={open} onClose={() => setOpen(false)} cart={cart} setCart={setCart} byId={byId} quote={quote} sell={sell}
        customers={customers} shopName={activeBusiness?.name || ''} slug={activeBusiness?.slug || null}
        onDone={() => { setCart([]); setTimeout(() => scanRef.current?.focus(), 50); }} />
    </div>
  );
}

function Checkout({ open, onClose, cart, setCart, byId, quote, sell, customers, shopName, slug, onDone }: {
  open: boolean; onClose: () => void; cart: CartItem[]; setCart: (f: (xs: CartItem[]) => CartItem[]) => void; byId: Map<string, ShopProduct>;
  quote: ReturnType<typeof useShop>['quote']; sell: ReturnType<typeof useShop>['sell']; customers: ReturnType<typeof useShop>['customers'];
  shopName: string; slug: string | null; onDone: () => void;
}) {
  const { lang, fmt } = useSettings();
  const sw = lang === 'sw';
  const { flash } = useToast();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [promo, setPromo] = useState('');
  const [gift, setGift] = useState('');
  const [usePoints, setUsePoints] = useState(false);
  const [pay, setPay] = useState<Pay>('cash');
  const [given, setGiven] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [qt, setQt] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<(PosResult & { change: number; phone: string }) | null>(null);
  const [extras, setExtras] = useState(false);

  const digits = phone.replace(/[^0-9+]/g, '');
  const known = digits.length >= 9 ? customers.find((c) => c.phone === digits) : undefined;
  useEffect(() => { if (known && !name) setName(known.name); }, [known]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ask the database what this cart costs, a moment after the last change.
  useEffect(() => {
    if (!open || !cart.length) { setQt(null); return; }
    let live = true;
    const t = setTimeout(async () => {
      const r = await quote(cart, promo, gift, usePoints ? 1_000_000 : 0, digits.length >= 9 ? digits : null);
      if (!live) return;
      if ('error' in r) { flash(shopError(r.error, sw)); return; }
      setQt(r);
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [open, cart, promo, gift, usePoints, digits]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!open) { setDone(null); } }, [open]);

  const total = qt?.total ?? 0;
  const cashGiven = Number(given.replace(/[^0-9.]/g, '')) || 0;
  const change = pay === 'cash' && cashGiven > total ? cashGiven - total : 0;
  const blocking = (qt?.errors || []).filter((e) => ['OUT_OF_STOCK', 'UNAVAILABLE', 'PROMO_INVALID', 'GIFT_INVALID'].includes(e.error));
  const splitC = Math.min(total, Number(splitCash.replace(/[^0-9.]/g, '')) || 0);

  function qty(id: string, d: number) {
    const p = byId.get(id);
    setCart((xs) => xs.map((x) => {
      if (x.product_id !== id) return x;
      const n = x.qty + d;
      if (p?.track_stock && n > p.stock) { flash(sw ? `Stoo ni ${p.stock} tu` : `Only ${p.stock} in stock`); return x; }
      return { ...x, qty: n };
    }).filter((x) => x.qty > 0));
  }

  async function charge() {
    if (!qt || busy) return;
    if (blocking.length) { flash(shopError(blocking[0].error, sw)); return; }
    if (pay === 'cash' && given && cashGiven < total) { flash(sw ? 'Pesa iliyopokelewa haitoshi' : 'Cash given is less than the total'); return; }
    setBusy(true);
    const r = await sell({
      items: cart, promo_code: promo || null, gift_code: gift || null, points: usePoints ? qt.points_used : 0,
      customer_phone: digits.length >= 9 ? digits : null, customer_name: name.trim() || null,
      paid_cash: pay === 'cash' ? total : pay === 'split' ? splitC : 0,
      paid_mobile: pay === 'mobile' ? total : pay === 'split' ? total - splitC : 0,
      paid_card: pay === 'card' ? total : 0,
    });
    setBusy(false);
    if ('error' in r) { flash(shopError(r.error, sw)); return; }
    haptic(20);
    setDone({ ...r, change, phone: digits });
    onDone();
    setPhone(''); setName(''); setPromo(''); setGift(''); setUsePoints(false); setGiven(''); setSplitCash(''); setPay('cash'); setExtras(false);
  }

  if (done) {
    const order = { number: done.number, items: done.quote.lines, subtotal: done.quote.subtotal, discount: done.quote.discount, promo_code: done.quote.promo?.code || null, gift_amount: done.quote.gift?.applied || 0, points_value: done.quote.points_value, total: done.total, paid_cash: 0, paid_mobile: 0, paid_card: 0, customer_name: name || null, points_earned: done.points_earned, created_at: new Date().toISOString() };
    return (
      <Sheet open={open} onClose={onClose} title={sw ? `Imeuzwa · #${done.number}` : `Sold · #${done.number}`}>
        <div style={{ textAlign: 'center', padding: '6px 0 14px' }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: 'var(--okSoft)', color: 'var(--ok)', display: 'grid', placeItems: 'center', margin: '0 auto' }}><Icon name="check" size={26} /></div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 10 }}>{fmt(done.total)}</div>
          {done.change > 0 && <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ok)', marginTop: 4 }}>{sw ? 'Chenji' : 'Change'}: {fmt(done.change)}</div>}
          {done.points_earned > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink2)', marginTop: 6 }}>+{done.points_earned} {sw ? 'pointi' : 'points'}{done.customer_points != null ? ` · ${sw ? 'salio' : 'balance'} ${done.customer_points}` : ''}</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" className="btn-ghost tap" onClick={() => printReceipt({ ...order, paid_cash: 0 }, { shop: shopName, fmt, sw, change: done.change, pointsBalance: done.customer_points })}><Icon name="print" size={15} /> {sw ? 'Chapisha' : 'Print'}</button>
          <a className="btn-ghost tap" style={{ textDecoration: 'none', opacity: done.phone ? 1 : 0.5, pointerEvents: done.phone ? 'auto' : 'none' }} target="_blank" rel="noreferrer"
            href={waLink(done.phone, receiptText(order, { shop: shopName, fmt, sw, link: slug ? storeUrl(slug) : undefined }))}><Icon name="chat" size={15} /> WhatsApp</a>
        </div>
        <button type="button" className="btn-primary tap" style={{ width: '100%', marginTop: 10, border: 'none' }} onClick={onClose}>{sw ? 'Mauzo mapya' : 'New sale'}</button>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={sw ? 'Lipisha' : 'Checkout'}>
      <div className="card" style={{ padding: '2px 12px' }}>
        {cart.map((c, i) => {
          const p = byId.get(c.product_id);
          if (!p) return null;
          return (
            <div key={c.product_id} className="s-row" style={{ padding: '9px 0', borderTop: i ? '1px solid var(--line)' : undefined }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{fmt(Number(p.price))}</div>
              </div>
              <button type="button" className="mini-btn tap" aria-label="−" onClick={() => qty(c.product_id, -1)}><Icon name="minus" size={13} /></button>
              <b style={{ minWidth: 22, textAlign: 'center' }}>{c.qty}</b>
              <button type="button" className="mini-btn tap" aria-label="+" onClick={() => qty(c.product_id, 1)}><Icon name="plus" size={13} /></button>
              <div style={{ width: 84, textAlign: 'right', fontSize: 13, fontWeight: 800 }}>{fmt(Number(p.price) * c.qty)}</div>
            </div>
          );
        })}
      </div>

      <div className="section-label">{sw ? 'Mteja (hiari)' : 'Customer (optional)'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <input className="field" inputMode="tel" placeholder={sw ? 'Simu' : 'Phone'} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="field" placeholder={sw ? 'Jina' : 'Name'} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {known && (
        <div className="s-row" style={{ marginTop: 8, padding: '10px 12px', borderRadius: 14, background: 'var(--brandSoft)' }}>
          <Icon name="star" size={15} style={{ color: 'var(--brand)' }} />
          <div style={{ flex: 1, fontSize: 12.5, fontWeight: 700 }}>
            {known.name || (sw ? 'Mteja' : 'Customer')} · {known.orders} {sw ? 'oda' : 'orders'} · <b>{known.points}</b> {sw ? 'pointi' : 'points'}
          </div>
          {known.points > 0 && (
            <button type="button" className="chip tap" aria-pressed={usePoints} onClick={() => setUsePoints((v) => !v)}
              style={usePoints ? { background: 'var(--brand)', color: '#fff', border: 'none' } : undefined}>{usePoints ? (sw ? 'Inatumika' : 'Using') : (sw ? 'Tumia pointi' : 'Use points')}</button>
          )}
        </div>
      )}

      <button type="button" className="chip tap" style={{ marginTop: 12 }} onClick={() => setExtras((v) => !v)}>
        <Icon name="tag" size={12} /> {sw ? 'Msimbo wa ofa au kadi ya zawadi' : 'Promo code or gift card'}
      </button>
      {(extras || promo || gift) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <input className="field" placeholder={sw ? 'Msimbo wa ofa' : 'Promo code'} value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} autoCapitalize="characters" />
          <input className="field" placeholder={sw ? 'Kadi ya zawadi' : 'Gift card'} value={gift} onChange={(e) => setGift(e.target.value.toUpperCase())} autoCapitalize="characters" />
        </div>
      )}

      <div className="card" style={{ marginTop: 12, padding: 14 }}>
        {!qt ? <div className="skeleton" style={{ height: 60 }} /> : (
          <div style={{ display: 'grid', gap: 5, fontSize: 13, fontWeight: 700, color: 'var(--ink2)' }}>
            <Line l={sw ? 'Jumla ndogo' : 'Subtotal'} r={fmt(qt.subtotal)} />
            {qt.discount > 0 && <Line l={`${qt.promo?.code || qt.promo?.name || (sw ? 'Ofa' : 'Offer')}`} r={'−' + fmt(qt.discount)} ok />}
            {qt.points_value > 0 && <Line l={`${qt.points_used} ${sw ? 'pointi' : 'points'}`} r={'−' + fmt(qt.points_value)} ok />}
            {qt.gift && qt.gift.applied > 0 && <Line l={sw ? 'Kadi ya zawadi' : 'Gift card'} r={'−' + fmt(qt.gift.applied)} ok />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4, color: 'var(--ink)' }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{sw ? 'Jumla' : 'Total'}</span>
              <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>{fmt(total)}</span>
            </div>
            {blocking.map((e, i) => <div key={i} style={{ color: 'var(--bad)', fontSize: 12, fontWeight: 800 }}>{shopError(e.error, sw)}{e.name ? ` — ${e.name}` : ''}</div>)}
          </div>
        )}
      </div>

      {total > 0 && (
        <>
          <div className="s-seg" style={{ marginTop: 12 }}>
            {(['cash', 'mobile', 'card', 'split'] as Pay[]).map((m) => (
              <button key={m} type="button" aria-pressed={pay === m} onClick={() => setPay(m)}>
                {m === 'cash' ? (sw ? 'Taslimu' : 'Cash') : m === 'mobile' ? (sw ? 'Simu' : 'Mobile') : m === 'card' ? (sw ? 'Kadi' : 'Card') : (sw ? 'Changanya' : 'Split')}
              </button>
            ))}
          </div>
          {pay === 'cash' && (
            <div style={{ marginTop: 8 }}>
              <input className="field" inputMode="numeric" placeholder={sw ? 'Pesa iliyopokelewa (kwa chenji)' : 'Cash given (for change)'} value={given} onChange={(e) => setGiven(e.target.value)} />
              <div className="s-chipset" style={{ marginTop: 8 }}>
                {quickCash(total).map((v) => <button key={v} type="button" aria-pressed={cashGiven === v} onClick={() => setGiven(String(v))}>{fmt(v)}</button>)}
              </div>
              {change > 0 && <div style={{ marginTop: 8, fontSize: 15, fontWeight: 800, color: 'var(--ok)' }}>{sw ? 'Chenji' : 'Change due'}: {fmt(change)}</div>}
            </div>
          )}
          {pay === 'split' && (
            <div style={{ marginTop: 8 }}>
              <input className="field" inputMode="numeric" placeholder={sw ? 'Kiasi cha taslimu' : 'Cash part'} value={splitCash} onChange={(e) => setSplitCash(e.target.value)} />
              <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--ink2)' }}>{sw ? 'Simu' : 'Mobile'}: {fmt(Math.max(0, total - splitC))}</div>
            </div>
          )}
        </>
      )}

      <button type="button" className="btn-primary tap" disabled={!qt || busy || blocking.length > 0} style={{ width: '100%', marginTop: 14, border: 'none', opacity: !qt || busy || blocking.length ? 0.6 : 1 }} onClick={charge}>
        {busy ? (sw ? 'Inahifadhi…' : 'Saving…') : `${sw ? 'Imelipwa' : 'Paid'} · ${fmt(total)}`}
      </button>
    </Sheet>
  );
}

function Line({ l, r, ok }: { l: string; r: string; ok?: boolean }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', color: ok ? 'var(--ok)' : undefined }}><span>{l}</span><span>{r}</span></div>;
}

/** The notes people actually hand over: the exact amount, then the next round figures up. */
function quickCash(total: number) {
  const out = new Set<number>([total]);
  for (const step of [1000, 5000, 10000, 50000]) {
    const v = Math.ceil(total / step) * step;
    if (v > total) out.add(v);
    if (out.size >= 4) break;
  }
  return [...out].slice(0, 4);
}
