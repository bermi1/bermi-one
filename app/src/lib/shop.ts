/*
  The Shop module's shapes and the maths the screens share.

  Totals are never worked out here for money that changes hands: the database's
  shop_price_cart is the one source of truth for what a cart costs. What lives
  here is reading what already happened — sales by day, what to restock, who
  stopped coming.
*/

export interface ShopProduct {
  id: string;
  business_id: string;
  name: string;
  slug: string | null;
  description: string | null;
  category: string | null;
  price: number;
  compare_at_price: number | null;
  /** What the owner says one costs them. Typed in, never derived. */
  cost: number | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  low_stock: number;
  track_stock: boolean;
  images: string[];
  active: boolean;
  online: boolean;
  featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at?: string;
}

export interface OrderLine {
  product_id: string;
  name: string;
  category: string | null;
  price: number;
  qty: number;
  line_total: number;
  image?: string | null;
}

export type OrderStatus = 'pending_payment' | 'new' | 'confirmed' | 'packed' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'mobile' | 'card' | 'split' | 'payme' | 'till' | 'cod' | 'gift';

export interface ShopOrder {
  id: string;
  business_id: string;
  number: number;
  channel: 'pos' | 'online';
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  items: OrderLine[];
  subtotal: number;
  discount: number;
  promo_id: string | null;
  promo_code: string | null;
  gift_card_id: string | null;
  gift_amount: number;
  points_used: number;
  points_value: number;
  points_earned: number;
  delivery_fee: number;
  total: number;
  fulfilment: 'counter' | 'pickup' | 'delivery';
  delivery_area: string | null;
  delivery_address: string | null;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: 'unpaid' | 'paid' | 'refunded' | 'failed';
  paid_cash: number;
  paid_mobile: number;
  paid_card: number;
  token: string;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface ShopCustomer {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  points: number;
  total_spent: number;
  orders: number;
  last_order_at: string | null;
  sms_opt_out: boolean;
  tags: string[] | null;
  created_at: string;
}

export interface ShopPromotion {
  id: string;
  business_id: string;
  name: string;
  /** No code means an automatic offer: it applies itself when it is the best one. */
  code: string | null;
  kind: 'percent' | 'fixed' | 'free_delivery';
  value: number;
  min_spend: number;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  uses: number;
  per_customer: number | null;
  applies_to: 'all' | 'category' | 'products';
  category: string | null;
  product_ids: string[] | null;
  channel: 'both' | 'online' | 'pos';
  active: boolean;
  revenue: number;
  discount_given: number;
  created_at: string;
}

export interface ShopGiftCard {
  id: string;
  business_id: string;
  code: string;
  initial: number;
  balance: number;
  recipient_name: string | null;
  recipient_phone: string | null;
  note: string | null;
  sold: boolean;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export interface ShopCampaign {
  id: string;
  name: string;
  message: string;
  audience: Audience;
  promo_id: string | null;
  recipients: number;
  credits_used: number;
  status: string;
  created_at: string;
}

export interface ShopWallet {
  business_id: string;
  sms_credits: number;
  balance: number;
  collected: number;
  fees: number;
  paid_out: number;
}

export interface ShopPayout {
  id: string;
  amount: number;
  phone: string;
  status: 'requested' | 'paid' | 'rejected';
  reference: string | null;
  note: string | null;
  created_at: string;
  paid_at: string | null;
}

export type Audience = 'all' | 'recent' | 'lapsed' | 'top' | 'loyal';

/** What shop_price_cart answers. */
export interface Quote {
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  promo: { id: string; name: string; code: string | null; kind: string } | null;
  delivery_fee: number;
  points_used: number;
  points_value: number;
  gift: { id: string; applied: number; balance: number } | null;
  total: number;
  errors: { error: string; product_id?: string; available?: number; name?: string }[];
  customer?: { id: string; name: string; points: number; orders: number; total_spent: number } | null;
}

export interface CartItem { product_id: string; qty: number }

export const STATUS_LABEL: Record<OrderStatus, [string, string]> = {
  pending_payment: ['Awaiting payment', 'Inasubiri malipo'],
  new: ['New', 'Mpya'],
  confirmed: ['Confirmed', 'Imethibitishwa'],
  packed: ['Packed', 'Imefungwa'],
  ready: ['Ready for pickup', 'Iko tayari'],
  out_for_delivery: ['Out for delivery', 'Inaletwa'],
  completed: ['Completed', 'Imekamilika'],
  cancelled: ['Cancelled', 'Imeghairiwa'],
};

export const METHOD_LABEL: Record<PaymentMethod, [string, string]> = {
  cash: ['Cash', 'Taslimu'],
  mobile: ['Mobile money', 'Pesa ya simu'],
  card: ['Card', 'Kadi'],
  split: ['Split', 'Mchanganyiko'],
  payme: ['Paid online', 'Imelipwa mtandaoni'],
  till: ['Till number', 'Namba ya till'],
  cod: ['Cash on delivery', 'Lipa ukipokea'],
  gift: ['Gift card', 'Kadi ya zawadi'],
};

export const AUDIENCE_LABEL: Record<Audience, [string, string, string, string]> = {
  all: ['Everyone', 'Wote', 'Every customer with a phone number', 'Kila mteja mwenye namba ya simu'],
  recent: ['Recent', 'Wa karibuni', 'Bought in the last 30 days', 'Wamenunua ndani ya siku 30'],
  lapsed: ['Win back', 'Warudishe', 'Bought before, nothing in 60 days', 'Walinunua, kimya siku 60'],
  top: ['Top spenders', 'Wanaonunua zaidi', 'Your top 20% by spend', 'Asilimia 20 ya juu kwa matumizi'],
  loyal: ['Loyal', 'Waaminifu', '3 or more orders', 'Oda 3 au zaidi'],
};

/** Errors the database raises, said the way a shopkeeper would want to hear them. */
export const SHOP_ERRORS: Record<string, [string, string]> = {
  OUT_OF_STOCK: ['Not enough stock for one of the items.', 'Stoo haitoshi kwa bidhaa moja.'],
  UNAVAILABLE: ['An item is no longer for sale.', 'Bidhaa moja haiuzwi tena.'],
  PROMO_INVALID: ['That promo code does not work for this cart.', 'Msimbo huo wa ofa haufanyi kazi kwa oda hii.'],
  GIFT_INVALID: ['That gift card is not valid or is empty.', 'Kadi hiyo ya zawadi si sahihi au haina salio.'],
  PAYMENT_MISMATCH: ['The payment does not add up to the total.', 'Malipo hayalingani na jumla.'],
  EMPTY_CART: ['The cart is empty.', 'Kikapu kiko tupu.'],
  NOT_ALLOWED: ['This business is not active for selling.', 'Biashara hii haiko hai kwa mauzo.'],
  NOT_ENOUGH_CREDITS: ['Not enough SMS credits. Buy a pack first.', 'Salio la SMS halitoshi. Nunua kifurushi kwanza.'],
  NO_RECIPIENTS: ['Nobody in that audience has a phone number yet.', 'Hakuna mteja kwenye kundi hilo mwenye namba.'],
  MESSAGE_REQUIRED: ['Write a message first.', 'Andika ujumbe kwanza.'],
  INSUFFICIENT_BALANCE: ['That is more than your balance.', 'Kiasi hicho ni zaidi ya salio lako.'],
  MIN_PAYOUT: ['The smallest payout is 1,000.', 'Malipo ya chini ni 1,000.'],
  PHONE_REQUIRED: ['Enter a phone number.', 'Weka namba ya simu.'],
  NOT_PAID_YET: ['Mark it paid before completing it.', 'Weka imelipwa kabla ya kukamilisha.'],
  ORDER_CLOSED: ['That order is already closed.', 'Oda hiyo imeshafungwa.'],
  PAYME_CONFIRMS_ITSELF: ['Online payments confirm themselves.', 'Malipo ya mtandaoni yanajithibitisha yenyewe.'],
  NAME_REQUIRED: ['Enter your name.', 'Weka jina lako.'],
  ADDRESS_REQUIRED: ['Enter where to deliver.', 'Weka mahali pa kuleta.'],
  AREA_REQUIRED: ['Choose a delivery area.', 'Chagua eneo la kuletewa.'],
  TOO_MANY_REQUESTS: ['Too many orders just now. Try again shortly.', 'Oda nyingi sana sasa hivi. Jaribu tena baadaye.'],
  SHOP_NOT_FOUND: ['This shop could not be found.', 'Duka hili halikupatikana.'],
  CART_INVALID: ['Something in the cart changed. Check it and try again.', 'Kuna kilichobadilika kwenye kikapu. Angalia ujaribu tena.'],
};

export function shopError(msg: string, sw: boolean): string {
  const code = Object.keys(SHOP_ERRORS).find((k) => msg.includes(k) && k !== 'CART_INVALID') || (msg.includes('CART_INVALID') ? 'CART_INVALID' : null);
  return code ? SHOP_ERRORS[code][sw ? 1 : 0] : msg;
}

export function localDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isLow(p: ShopProduct) {
  return p.track_stock && p.stock <= p.low_stock;
}

/** Orders that count as money in: paid and not cancelled. */
export function paidOrders(orders: ShopOrder[]) {
  return orders.filter((o) => o.payment_status === 'paid' && o.status !== 'cancelled');
}

/** Revenue an order brought in, including what a gift card covered (that money came in when the card was sold). */
export function orderValue(o: ShopOrder) {
  return Number(o.total) + Number(o.gift_amount || 0);
}

export function salesByDay(orders: ShopOrder[], days: number) {
  const out: { day: string; pos: number; online: number; count: number }[] = [];
  const idx = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    idx.set(localDay(d), out.length);
    out.push({ day: localDay(d), pos: 0, online: 0, count: 0 });
  }
  for (const o of paidOrders(orders)) {
    const i = idx.get(localDay(new Date(o.paid_at || o.created_at)));
    if (i === undefined) continue;
    out[i][o.channel] += orderValue(o);
    out[i].count++;
  }
  return out;
}

export interface ProductPerf { product_id: string; name: string; qty: number; revenue: number }

export function productPerformance(orders: ShopOrder[]): ProductPerf[] {
  const m = new Map<string, ProductPerf>();
  for (const o of paidOrders(orders)) {
    for (const l of o.items || []) {
      const cur = m.get(l.product_id) || { product_id: l.product_id, name: l.name, qty: 0, revenue: 0 };
      cur.qty += Number(l.qty);
      cur.revenue += Number(l.line_total);
      m.set(l.product_id, cur);
    }
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue);
}

/**
 * What to reorder: daily sales over the window against stock on hand. Anything
 * with under `coverDays` of stock left at its current pace, most urgent first.
 */
export function restockList(products: ShopProduct[], orders: ShopOrder[], windowDays = 30, coverDays = 7) {
  const perf = new Map(productPerformance(orders).map((p) => [p.product_id, p]));
  return products
    .filter((p) => p.active && p.track_stock)
    .map((p) => {
      const sold = perf.get(p.id)?.qty || 0;
      const perDay = sold / windowDays;
      const daysLeft = perDay > 0 ? p.stock / perDay : p.stock <= p.low_stock ? 0 : Infinity;
      const suggest = Math.max(0, Math.ceil(perDay * 21 - p.stock));
      return { product: p, perDay, daysLeft, suggest };
    })
    .filter((x) => x.daysLeft < coverDays || x.product.stock <= x.product.low_stock)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Stock that sits: in stock, nothing sold in the window. Candidates for an offer. */
export function slowMovers(products: ShopProduct[], orders: ShopOrder[]) {
  const sold = new Set(productPerformance(orders).map((p) => p.product_id));
  return products.filter((p) => p.active && p.stock > 0 && !sold.has(p.id) && new Date(p.created_at).getTime() < Date.now() - 14 * 86_400_000);
}

/** Stock value at selling price, and at cost where the owner has given one. */
export function stockValue(products: ShopProduct[]) {
  let retail = 0; let cost = 0; let costKnown = 0;
  for (const p of products) {
    if (!p.active || !p.track_stock || p.stock <= 0) continue;
    retail += p.stock * Number(p.price);
    if (p.cost != null) { cost += p.stock * Number(p.cost); costKnown++; }
  }
  return { retail, cost, costKnown };
}

/** Share of customers with more than one order. */
export function repeatRate(customers: ShopCustomer[]) {
  const buyers = customers.filter((c) => c.orders > 0);
  if (!buyers.length) return 0;
  return buyers.filter((c) => c.orders > 1).length / buyers.length;
}

export function lapsedCustomers(customers: ShopCustomer[], days = 60) {
  const cut = Date.now() - days * 86_400_000;
  return customers.filter((c) => c.orders > 0 && c.last_order_at && new Date(c.last_order_at).getTime() < cut);
}

export function promoActive(p: ShopPromotion) {
  const now = Date.now();
  return p.active && (!p.starts_at || new Date(p.starts_at).getTime() <= now) && (!p.ends_at || new Date(p.ends_at).getTime() >= now) && (p.max_uses == null || p.uses < p.max_uses);
}

export function promoText(p: Pick<ShopPromotion, 'kind' | 'value' | 'min_spend'>, fmt: (n: number) => string, sw: boolean) {
  const what = p.kind === 'percent' ? `${p.value}% ${sw ? 'punguzo' : 'off'}` : p.kind === 'fixed' ? `${fmt(p.value)} ${sw ? 'punguzo' : 'off'}` : (sw ? 'Usafirishaji bure' : 'Free delivery');
  return p.min_spend > 0 ? `${what} · ${sw ? 'ukinunua' : 'over'} ${fmt(p.min_spend)}` : what;
}

/** An SMS is 153 characters per part once joined; the opt-out line rides on every one. */
export function smsParts(message: string) {
  return Math.max(1, Math.ceil((message.length + ' ~ Reply STOP'.length) / 153));
}

export function storeUrl(slug: string | null | undefined, path = '') {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://bermione.vercel.app';
  return `${origin}/s/${slug || ''}${path}`;
}

export function waLink(phone: string | null | undefined, text: string) {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  const intl = digits.startsWith('0') ? '255' + digits.slice(1) : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

export function slugify(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}
