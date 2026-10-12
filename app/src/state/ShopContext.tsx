import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { invokeFunction } from '../lib/functions';
import { useData } from './DataContext';
import { logAction } from '../ontology/actions';
import { slugify, type Audience, type CartItem, type OrderStatus, type Quote, type ShopCampaign, type ShopCustomer, type ShopGiftCard, type ShopOrder, type ShopPayout, type ShopProduct, type ShopPromotion, type ShopWallet } from '../lib/shop';
import type { ShopSettings } from '../lib/types';

/*
  The shop's working set.

  Bounded like the barbershop's, so a shop with years of orders opens as fast as
  a new one: the whole catalogue (capped at 2,000), the 500 most recent
  customers, 35 days of orders, every promotion, the open gift cards. Longer
  report ranges are fetched on demand. Online orders arrive while the shop is
  open, so orders refresh every 30 seconds when the app is in front.
*/

export interface PosSale {
  items: CartItem[];
  promo_code?: string | null;
  gift_code?: string | null;
  points?: number;
  customer_phone?: string | null;
  customer_name?: string | null;
  paid_cash: number;
  paid_mobile: number;
  paid_card: number;
  note?: string | null;
}

export interface PosResult { order_id: string; number: number; total: number; points_earned: number; customer_points: number | null; quote: Quote }

interface ShopCtx {
  isShop: boolean;
  loaded: boolean;
  products: ShopProduct[];
  customers: ShopCustomer[];
  orders: ShopOrder[];
  promotions: ShopPromotion[];
  giftCards: ShopGiftCard[];
  campaigns: ShopCampaign[];
  wallet: ShopWallet | null;
  payouts: ShopPayout[];
  settings: ShopSettings;
  reload: () => Promise<void>;
  refreshOrders: () => Promise<void>;
  saveProduct: (p: Partial<ShopProduct> & { name: string }, openingStock?: number) => Promise<{ id: string } | { error: string }>;
  adjustStock: (productId: string, delta: number, reason: 'restock' | 'adjust' | 'return' | 'opening', note?: string) => Promise<string | null>;
  uploadImage: (file: File) => Promise<string | { error: string }>;
  quote: (items: CartItem[], promo?: string | null, gift?: string | null, points?: number, phone?: string | null) => Promise<Quote | { error: string }>;
  sell: (s: PosSale) => Promise<PosResult | { error: string }>;
  setOrderStatus: (id: string, status: OrderStatus, markPaid?: boolean) => Promise<string | null>;
  savePromotion: (p: Partial<ShopPromotion> & { name: string }) => Promise<string | null>;
  issueGiftCard: (amount: number, sold: boolean, account: string, name?: string, phone?: string, expiresDays?: number) => Promise<{ code: string } | { error: string }>;
  campaignPreview: (audience: Audience, message: string) => Promise<{ recipients: number; parts: number; credits: number; balance: number } | { error: string }>;
  sendCampaign: (name: string, message: string, audience: Audience, promoId: string | null) => Promise<{ recipients: number; credits_left: number } | { error: string }>;
  buySms: (pack: string, phone: string) => Promise<{ reference: string; amount: number } | { error: string }>;
  smsStatus: (reference: string) => Promise<string>;
  requestPayout: (amount: number, phone: string) => Promise<string | null>;
  saveSettings: (patch: Partial<ShopSettings>) => Promise<void>;
  ensureSlug: () => Promise<string | null>;
  saveCustomer: (c: Partial<ShopCustomer> & { name: string }) => Promise<string | null>;
  fetchOrders: (fromIso: string, toIso: string) => Promise<ShopOrder[]>;
  stockMoves: (productId: string) => Promise<{ id: string; delta: number; reason: string; note: string | null; by_name: string | null; stock_after: number | null; created_at: string }[]>;
}

const Ctx = createContext<ShopCtx | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const { activeBusiness, role, activeStaff, profile, refreshMoney, updateBusiness } = useData();
  const isShop = activeBusiness?.type === 'retail';
  const bizId = isShop ? activeBusiness!.id : null;
  const actor = role === 'staff' && activeStaff ? activeStaff.name : (profile?.full_name || undefined);
  const settings = useMemo<ShopSettings>(() => activeBusiness?.settings?.shop || {}, [activeBusiness?.settings?.shop]);

  const [loaded, setLoaded] = useState(false);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [customers, setCustomers] = useState<ShopCustomer[]>([]);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [promotions, setPromotions] = useState<ShopPromotion[]>([]);
  const [giftCards, setGiftCards] = useState<ShopGiftCard[]>([]);
  const [campaigns, setCampaigns] = useState<ShopCampaign[]>([]);
  const [wallet, setWallet] = useState<ShopWallet | null>(null);
  const [payouts, setPayouts] = useState<ShopPayout[]>([]);

  const since = () => new Date(Date.now() - 35 * 86_400_000).toISOString();

  const reload = useCallback(async () => {
    if (!bizId) return;
    const [pr, cu, or, pm, gc, cp, wa, po] = await Promise.all([
      supabase.from('shop_products').select('*').eq('business_id', bizId).order('sort_order').order('name').limit(2000),
      supabase.from('shop_customers').select('*').eq('business_id', bizId).order('last_order_at', { ascending: false, nullsFirst: false }).limit(500),
      supabase.from('shop_orders').select('*').eq('business_id', bizId).gte('created_at', since()).order('created_at', { ascending: false }).limit(1500),
      supabase.from('shop_promotions').select('*').eq('business_id', bizId).order('created_at', { ascending: false }).limit(200),
      supabase.from('shop_gift_cards').select('*').eq('business_id', bizId).order('created_at', { ascending: false }).limit(500),
      supabase.from('shop_campaigns').select('*').eq('business_id', bizId).order('created_at', { ascending: false }).limit(50),
      supabase.from('shop_wallets').select('*').eq('business_id', bizId).maybeSingle(),
      supabase.from('shop_payouts').select('*').eq('business_id', bizId).order('created_at', { ascending: false }).limit(50),
    ]);
    setProducts((pr.data || []) as ShopProduct[]);
    setCustomers((cu.data || []) as ShopCustomer[]);
    setOrders((or.data || []) as ShopOrder[]);
    setPromotions((pm.data || []) as ShopPromotion[]);
    setGiftCards((gc.data || []) as ShopGiftCard[]);
    setCampaigns((cp.data || []) as ShopCampaign[]);
    setWallet((wa.data as ShopWallet | null) ?? null);
    setPayouts((po.data || []) as ShopPayout[]);
    setLoaded(true);
  }, [bizId]);

  useEffect(() => {
    setLoaded(false);
    setProducts([]); setCustomers([]); setOrders([]); setPromotions([]); setGiftCards([]); setCampaigns([]); setWallet(null); setPayouts([]);
    if (bizId) void reload();
  }, [bizId, reload]);

  const refreshOrders = useCallback(async () => {
    if (!bizId) return;
    const [or, wa, pr] = await Promise.all([
      supabase.from('shop_orders').select('*').eq('business_id', bizId).gte('created_at', since()).order('created_at', { ascending: false }).limit(1500),
      supabase.from('shop_wallets').select('*').eq('business_id', bizId).maybeSingle(),
      supabase.from('shop_products').select('*').eq('business_id', bizId).order('sort_order').order('name').limit(2000),
    ]);
    if (or.data) setOrders(or.data as ShopOrder[]);
    if (wa.data) setWallet(wa.data as ShopWallet);
    if (pr.data) setProducts(pr.data as ShopProduct[]);
  }, [bizId]);

  // Online orders land while the shop is open.
  useEffect(() => {
    if (!bizId) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') void refreshOrders(); }, 30_000);
    return () => clearInterval(t);
  }, [bizId, refreshOrders]);

  const ensureSlug = useCallback(async () => {
    if (!bizId) return null;
    if (activeBusiness?.slug) return activeBusiness.slug;
    const { data } = await supabase.rpc('ensure_business_slug', { p_business: bizId });
    return (data as string) || null;
  }, [bizId, activeBusiness?.slug]);

  const saveProduct = useCallback<ShopCtx['saveProduct']>(async (p, openingStock) => {
    if (!bizId) return { error: 'No business' };
    const row = {
      name: p.name.trim().slice(0, 120),
      description: p.description?.trim() || null,
      category: p.category?.trim() || null,
      price: Math.max(0, Number(p.price) || 0),
      compare_at_price: p.compare_at_price ? Math.max(0, Number(p.compare_at_price)) : null,
      cost: p.cost === null || p.cost === undefined || (p.cost as unknown) === '' ? null : Math.max(0, Number(p.cost)),
      sku: p.sku?.trim() || null,
      barcode: p.barcode?.trim() || null,
      low_stock: Math.max(0, Number(p.low_stock ?? 3)),
      track_stock: p.track_stock ?? true,
      images: p.images || [],
      active: p.active ?? true,
      online: p.online ?? true,
      featured: p.featured ?? false,
      updated_at: new Date().toISOString(),
    };
    let saved: ShopProduct;
    if (p.id) {
      const { data, error } = await supabase.from('shop_products').update(row).eq('id', p.id).select().single();
      if (error) return { error: error.message };
      saved = data as ShopProduct;
      setProducts((xs) => xs.map((x) => (x.id === p.id ? saved : x)));
    } else {
      const { data, error } = await supabase.from('shop_products').insert({ ...row, business_id: bizId, stock: 0, slug: slugify(row.name), sort_order: products.length + 1 }).select().single();
      if (error) return { error: error.message };
      saved = data as ShopProduct;
      setProducts((xs) => [...xs, saved]);
      if (openingStock && openingStock > 0) {
        const { data: after } = await supabase.rpc('shop_adjust_stock', { p_product: saved.id, p_delta: openingStock, p_reason: 'opening', p_note: null, p_by: actor || null });
        setProducts((xs) => xs.map((x) => (x.id === saved.id ? { ...x, stock: Number(after ?? openingStock) } : x)));
      }
    }
    void logAction({ businessId: bizId, actionType: 'product.save', objectId: saved.id, summary: `${p.id ? 'Updated' : 'Added'} ${row.name} at ${row.price}`, payload: { price: row.price, online: row.online }, actorName: actor });
    return { id: saved.id };
  }, [bizId, products.length, actor]);

  const adjustStock = useCallback<ShopCtx['adjustStock']>(async (productId, delta, reason, note) => {
    const { data, error } = await supabase.rpc('shop_adjust_stock', { p_product: productId, p_delta: delta, p_reason: reason, p_note: note || null, p_by: actor || null });
    if (error) return error.message;
    setProducts((xs) => xs.map((x) => (x.id === productId ? { ...x, stock: Number(data) } : x)));
    if (bizId) void logAction({ businessId: bizId, actionType: 'stock.adjust', objectId: productId, summary: `${reason} ${delta > 0 ? '+' : ''}${delta}`, payload: { delta, reason }, actorName: actor });
    return null;
  }, [actor, bizId]);

  const uploadImage = useCallback<ShopCtx['uploadImage']>(async (file) => {
    if (!bizId) return { error: 'No business' };
    const blob = await shrinkImage(file, 1200);
    const path = `${bizId}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from('shop-media').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
    if (error) return { error: error.message };
    return supabase.storage.from('shop-media').getPublicUrl(path).data.publicUrl as string;
  }, [bizId]);

  const quote = useCallback<ShopCtx['quote']>(async (items, promo, gift, points, phone) => {
    if (!bizId) return { error: 'No business' };
    const { data, error } = await supabase.rpc('shop_quote_owner', {
      p_biz: bizId, p_items: items, p_promo_code: promo?.trim() || null, p_gift_code: gift?.trim() || null, p_points: points || 0, p_phone: phone?.trim() || null,
    });
    if (error) return { error: error.message };
    return data as Quote;
  }, [bizId]);

  const sell = useCallback<ShopCtx['sell']>(async (s) => {
    if (!bizId) return { error: 'No business' };
    const { data, error } = await supabase.rpc('shop_pos_sale', { p: { ...s, business_id: bizId, recorded_by: actor || '' } });
    if (error) return { error: error.message };
    const out = data as PosResult;
    void refreshOrders();
    void refreshMoney();
    if (s.customer_phone) {
      const { data: c } = await supabase.from('shop_customers').select('*').eq('business_id', bizId).eq('phone', s.customer_phone.replace(/[^0-9+]/g, '')).maybeSingle();
      if (c) setCustomers((xs) => [c as ShopCustomer, ...xs.filter((x) => x.id !== (c as ShopCustomer).id)]);
    }
    if (s.gift_code) {
      const { data: g } = await supabase.from('shop_gift_cards').select('*').eq('business_id', bizId).ilike('code', s.gift_code.trim()).maybeSingle();
      if (g) setGiftCards((xs) => xs.map((x) => (x.id === (g as ShopGiftCard).id ? (g as ShopGiftCard) : x)));
    }
    void logAction({ businessId: bizId, actionType: 'sale.pos', objectId: out.order_id, summary: `Sale #${out.number} — ${out.total}`, payload: { total: out.total }, actorName: actor });
    return out;
  }, [bizId, actor, refreshOrders, refreshMoney]);

  const setOrderStatus = useCallback<ShopCtx['setOrderStatus']>(async (id, status, markPaid) => {
    const { error } = await supabase.rpc('shop_set_order_status', { p_order: id, p_status: status, p_mark_paid: !!markPaid, p_by: actor || null });
    if (error) return error.message;
    await refreshOrders();
    if (markPaid || status === 'cancelled') void refreshMoney();
    if (bizId) void logAction({ businessId: bizId, actionType: 'order.status', objectId: id, summary: `Order ${status}${markPaid ? ', paid' : ''}`, payload: { status, markPaid: !!markPaid }, actorName: actor });
    return null;
  }, [actor, bizId, refreshOrders, refreshMoney]);

  const savePromotion = useCallback<ShopCtx['savePromotion']>(async (p) => {
    if (!bizId) return 'No business';
    const row = {
      name: p.name.trim().slice(0, 80),
      code: p.code?.trim() ? p.code.trim().toUpperCase().replace(/\s+/g, '') : null,
      kind: p.kind || 'percent',
      value: Math.max(0, Number(p.value) || 0),
      min_spend: Math.max(0, Number(p.min_spend) || 0),
      starts_at: p.starts_at || null,
      ends_at: p.ends_at || null,
      max_uses: p.max_uses ? Number(p.max_uses) : null,
      per_customer: p.per_customer ? Number(p.per_customer) : null,
      applies_to: p.applies_to || 'all',
      category: p.applies_to === 'category' ? p.category || null : null,
      product_ids: p.applies_to === 'products' ? p.product_ids || [] : null,
      channel: p.channel || 'both',
      active: p.active ?? true,
    };
    if (row.kind === 'percent') row.value = Math.min(row.value, 100);
    const res = p.id
      ? await supabase.from('shop_promotions').update(row).eq('id', p.id).select().single()
      : await supabase.from('shop_promotions').insert({ ...row, business_id: bizId }).select().single();
    if (res.error) return /duplicate|unique/i.test(res.error.message) ? 'That code is already in use.' : res.error.message;
    const saved = res.data as ShopPromotion;
    setPromotions((xs) => (p.id ? xs.map((x) => (x.id === p.id ? saved : x)) : [saved, ...xs]));
    void logAction({ businessId: bizId, actionType: 'promo.save', objectId: saved.id, summary: `${p.id ? 'Updated' : 'Created'} ${row.code || 'offer'} ${row.name}`, payload: { kind: row.kind, value: row.value }, actorName: actor });
    return null;
  }, [bizId, actor]);

  const issueGiftCard = useCallback<ShopCtx['issueGiftCard']>(async (amount, sold, account, name, phone, expiresDays) => {
    if (!bizId) return { error: 'No business' };
    const { data, error } = await supabase.rpc('shop_issue_gift_card', {
      p_biz: bizId, p_amount: amount, p_sold: sold, p_account: account, p_recipient_name: name || null, p_recipient_phone: phone || null, p_expires_days: expiresDays ?? 365, p_by: actor || null,
    });
    if (error) return { error: error.message };
    const out = data as { id: string; code: string };
    const { data: g } = await supabase.from('shop_gift_cards').select('*').eq('id', out.id).single();
    if (g) setGiftCards((xs) => [g as ShopGiftCard, ...xs]);
    if (sold) void refreshMoney();
    void logAction({ businessId: bizId, actionType: 'gift.issue', objectId: out.id, summary: `${sold ? 'Sold' : 'Gave'} gift card ${out.code} — ${amount}`, payload: { amount, sold }, actorName: actor });
    return { code: out.code };
  }, [bizId, actor, refreshMoney]);

  const campaignPreview = useCallback<ShopCtx['campaignPreview']>(async (audience, message) => {
    if (!bizId) return { error: 'No business' };
    const { data, error } = await supabase.rpc('shop_campaign_preview', { p_biz: bizId, p_audience: audience, p_message: message });
    if (error) return { error: error.message };
    return data as { recipients: number; parts: number; credits: number; balance: number };
  }, [bizId]);

  const sendCampaign = useCallback<ShopCtx['sendCampaign']>(async (name, message, audience, promoId) => {
    if (!bizId) return { error: 'No business' };
    const { data, error } = await supabase.rpc('shop_send_campaign', { p_biz: bizId, p_name: name, p_message: message, p_audience: audience, p_promo: promoId, p_by: actor || null });
    if (error) return { error: error.message };
    const out = data as { campaign_id: string; recipients: number; credits_used: number; credits_left: number };
    const [cp, wa] = await Promise.all([
      supabase.from('shop_campaigns').select('*').eq('business_id', bizId).order('created_at', { ascending: false }).limit(50),
      supabase.from('shop_wallets').select('*').eq('business_id', bizId).maybeSingle(),
    ]);
    if (cp.data) setCampaigns(cp.data as ShopCampaign[]);
    if (wa.data) setWallet(wa.data as ShopWallet);
    void logAction({ businessId: bizId, actionType: 'campaign.send', objectId: out.campaign_id, summary: `Campaign "${name}" to ${out.recipients}`, payload: { audience, credits: out.credits_used }, actorName: actor });
    return out;
  }, [bizId, actor]);

  const buySms = useCallback<ShopCtx['buySms']>(async (pack, phone) => {
    if (!bizId) return { error: 'No business' };
    try {
      return await invokeFunction<{ reference: string; amount: number }>('shop-pay', { action: 'sms', business_id: bizId, pack, phone });
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [bizId]);

  const smsStatus = useCallback<ShopCtx['smsStatus']>(async (reference) => {
    try {
      const out = await invokeFunction<{ status: string }>('shop-pay', { action: 'status', reference });
      if (out.status === 'COMPLETED' && bizId) {
        const { data } = await supabase.from('shop_wallets').select('*').eq('business_id', bizId).maybeSingle();
        if (data) setWallet(data as ShopWallet);
      }
      return out.status;
    } catch {
      return 'PENDING';
    }
  }, [bizId]);

  const requestPayout = useCallback<ShopCtx['requestPayout']>(async (amount, phone) => {
    if (!bizId) return 'No business';
    const { error } = await supabase.rpc('shop_request_payout', { p_biz: bizId, p_amount: amount, p_phone: phone });
    if (error) return error.message;
    const [wa, po] = await Promise.all([
      supabase.from('shop_wallets').select('*').eq('business_id', bizId).maybeSingle(),
      supabase.from('shop_payouts').select('*').eq('business_id', bizId).order('created_at', { ascending: false }).limit(50),
    ]);
    if (wa.data) setWallet(wa.data as ShopWallet);
    if (po.data) setPayouts(po.data as ShopPayout[]);
    void logAction({ businessId: bizId, actionType: 'payout.request', objectId: bizId, summary: `Requested payout ${amount}`, payload: { amount }, actorName: actor });
    return null;
  }, [bizId, actor]);

  const saveSettings = useCallback<ShopCtx['saveSettings']>(async (patch) => {
    const current = activeBusiness?.settings || {};
    await updateBusiness({ settings: { ...current, shop: { ...(current.shop || {}), ...patch } } });
  }, [activeBusiness?.settings, updateBusiness]);

  const saveCustomer = useCallback<ShopCtx['saveCustomer']>(async (c) => {
    if (!bizId) return 'No business';
    const row = { name: c.name.trim(), phone: c.phone ? c.phone.replace(/[^0-9+]/g, '') || null : null, email: c.email?.trim() || null, points: Math.max(0, Math.round(Number(c.points ?? 0))), sms_opt_out: !!c.sms_opt_out, tags: c.tags || [] };
    const res = c.id
      ? await supabase.from('shop_customers').update(row).eq('id', c.id).select().single()
      : await supabase.from('shop_customers').insert({ ...row, business_id: bizId }).select().single();
    if (res.error) return /duplicate|unique/i.test(res.error.message) ? 'A customer with that phone already exists.' : res.error.message;
    const saved = res.data as ShopCustomer;
    setCustomers((xs) => (c.id ? xs.map((x) => (x.id === c.id ? saved : x)) : [saved, ...xs]));
    return null;
  }, [bizId]);

  const fetchOrders = useCallback<ShopCtx['fetchOrders']>(async (fromIso, toIso) => {
    if (!bizId) return [];
    const { data } = await supabase.from('shop_orders').select('*').eq('business_id', bizId).gte('created_at', fromIso).lte('created_at', toIso).order('created_at', { ascending: false }).limit(10000);
    return (data || []) as ShopOrder[];
  }, [bizId]);

  const stockMoves = useCallback<ShopCtx['stockMoves']>(async (productId) => {
    const { data } = await supabase.from('shop_stock_moves').select('id, delta, reason, note, by_name, stock_after, created_at').eq('product_id', productId).order('created_at', { ascending: false }).limit(100);
    return (data || []) as Awaited<ReturnType<ShopCtx['stockMoves']>>;
  }, []);

  const value = useMemo<ShopCtx>(() => ({
    isShop, loaded, products, customers, orders, promotions, giftCards, campaigns, wallet, payouts, settings,
    reload, refreshOrders, saveProduct, adjustStock, uploadImage, quote, sell, setOrderStatus, savePromotion, issueGiftCard,
    campaignPreview, sendCampaign, buySms, smsStatus, requestPayout, saveSettings, ensureSlug, saveCustomer, fetchOrders, stockMoves,
  }), [isShop, loaded, products, customers, orders, promotions, giftCards, campaigns, wallet, payouts, settings,
    reload, refreshOrders, saveProduct, adjustStock, uploadImage, quote, sell, setOrderStatus, savePromotion, issueGiftCard,
    campaignPreview, sendCampaign, buySms, smsStatus, requestPayout, saveSettings, ensureSlug, saveCustomer, fetchOrders, stockMoves]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShop() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useShop outside ShopProvider');
  return v;
}

/**
 * Phone photos are 4 MB; a product card needs 1200 px. Shrinking on the device
 * before upload saves the shop's data bundle and every customer's.
 */
async function shrinkImage(file: File, max: number): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.84));
  } catch {
    return file;
  }
}
