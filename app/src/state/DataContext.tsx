import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { todayIso } from '../lib/calc';
import { logAction, fetchRecentActions, type ActionLogEntry } from '../ontology/actions';
import {
  type Accounts,
  type Business,
  type ClosingItem,
  type ClosingItemKind,
  type EntryKind,
  type LedgerEntry,
  type Lang,
  type Product,
  type Profile,
  type Role,
  type StaffMember,
  type StockSession,
  type Theme,
} from '../lib/types';

interface NewEntryLine {
  kind: EntryKind;
  label: string;
  amount: number;
  account: 'cash' | 'mobile' | 'bank';
}

export interface BusinessSummary {
  business: Business;
  revenue: number;
  opex: number;
  losses: number;
  debt: number;
  net: number;
}

interface DataCtx {
  ready: boolean;
  profile: Profile | null;
  businesses: Business[];
  activeBusiness: Business | null;
  products: Product[];
  accounts: Accounts | null;
  ledger: LedgerEntry[];
  session: StockSession | null;
  actionLog: ActionLogEntry[];
  staffMembers: StaffMember[];

  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  setRole: (r: Role) => void;
  displayName: string;

  completeOnboarding: (input: { name: string; type: string; city: string; countryCode: string; answers: Record<string, boolean | null> }) => Promise<void>;
  addBusiness: (input: { name: string; type: string; city: string; countryCode: string }) => Promise<void>;
  updateBusiness: (patch: Partial<Pick<Business, 'name' | 'city' | 'type' | 'country_code' | 'answers'>>) => Promise<void>;
  switchBusiness: (id: string) => Promise<void>;

  updateProductPrice: (productId: string, price: number) => Promise<void>;
  reorderProducts: (orderedIds: string[]) => Promise<void>;
  addStock: (productId: string, qty: number) => Promise<void>;
  addProduct: (input: { name: string; cat: string; unit: string; price: number; profit: number; low: number }) => Promise<void>;
  addProductsBulk: (rows: { name: string; cat: string; unit: string; cost: number; price: number; profit: number; opening: number; low: number }[]) => Promise<void>;
  updateProductFields: (productId: string, patch: Partial<Pick<Product, 'name' | 'cat' | 'unit' | 'price' | 'profit' | 'low' | 'opening'>>) => Promise<void>;

  setClosingCount: (productId: string, qty: number | null) => Promise<void>;
  setSessionMoney: (field: 'cash' | 'mobile' | 'bank_in', value: number) => Promise<void>;
  addClosingItem: (kind: ClosingItemKind, amount: number, note: string) => Promise<void>;
  removeClosingItem: (id: string) => Promise<void>;
  submitSession: (reason: string | null, note: string) => Promise<void>;
  approveSession: () => Promise<void>;
  returnSession: () => Promise<void>;

  addLedgerLines: (lines: NewEntryLine[]) => Promise<void>;
  fetchPortfolioSummary: (days: number) => Promise<BusinessSummary[]>;

  addStaffMember: (input: { name: string; phone: string; title: string }) => Promise<void>;
  removeStaffMember: (id: string) => Promise<void>;
}

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { session: authSession } = useAuth();
  const uid = authSession?.user?.id ?? null;

  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Accounts | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [session, setSession] = useState<StockSession | null>(null);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);

  const activeBusiness = useMemo(
    () => businesses.find((b) => b.id === profile?.active_business_id) || businesses[0] || null,
    [businesses, profile],
  );

  const record = useCallback(
    async (args: Parameters<typeof logAction>[0]) => {
      const entry = await logAction(args);
      if (entry) setActionLog((l) => [entry, ...l].slice(0, 60));
    },
    [],
  );

  const loadBusinessData = useCallback(async (businessId: string) => {
    const [{ data: prods }, { data: acc }, { data: led }, { data: sess }, log, { data: staff }] = await Promise.all([
      supabase.from('products').select('*').eq('business_id', businessId).order('sort_order'),
      supabase.from('accounts').select('*').eq('business_id', businessId).maybeSingle(),
      supabase.from('ledger_entries').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(100),
      supabase.from('stock_sessions').select('*').eq('business_id', businessId).eq('session_date', todayIso()).maybeSingle(),
      fetchRecentActions(businessId),
      supabase.from('staff_members').select('*').eq('business_id', businessId).order('sort_order'),
    ]);
    setProducts(prods || []);
    setAccounts(acc || { business_id: businessId, cash: 0, mobile: 0, bank: 0 });
    setLedger(led || []);
    setSession(sess || null);
    setActionLog(log);
    setStaffMembers(staff || []);
  }, []);

  useEffect(() => {
    if (!uid) {
      setReady(true);
      setProfile(null);
      setBusinesses([]);
      setProducts([]);
      setAccounts(null);
      setLedger([]);
      setSession(null);
      setActionLog([]);
      setStaffMembers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setReady(false);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      const { data: biz } = await supabase.from('businesses').select('*').eq('owner_id', uid).order('sort_order');
      if (cancelled) return;
      setProfile(prof as Profile);
      setBusinesses(biz || []);
      const active = (biz || []).find((b) => b.id === (prof as Profile | null)?.active_business_id) || (biz || [])[0];
      if (active) await loadBusinessData(active.id);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, loadBusinessData]);

  const patchProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!uid) return;
      setProfile((p) => (p ? { ...p, ...patch } : p));
      await supabase.from('profiles').update(patch).eq('id', uid);
    },
    [uid],
  );

  const setLang = useCallback((l: Lang) => void patchProfile({ lang: l }), [patchProfile]);
  const setTheme = useCallback((t: Theme) => void patchProfile({ theme: t }), [patchProfile]);
  const setRole = useCallback((r: Role) => void patchProfile({ role: r }), [patchProfile]);

  const completeOnboarding = useCallback<DataCtx['completeOnboarding']>(
    async ({ name, type, city, countryCode, answers }) => {
      if (!uid) return;
      const { data: biz } = await supabase
        .from('businesses')
        .insert({ owner_id: uid, name, type, city, country_code: countryCode, answers, sort_order: businesses.length })
        .select()
        .single();
      if (!biz) return;
      await supabase.from('accounts').insert({ business_id: biz.id, cash: 0, mobile: 0, bank: 0 });
      await patchProfile({ onboarded: true, active_business_id: biz.id });
      setBusinesses((bs) => [...bs, biz as Business]);
      await loadBusinessData(biz.id);
      await record({ businessId: biz.id, actionType: 'business.create', objectId: biz.id, summary: `Opened ${name} (${type})`, payload: { name, type, city }, actorName: profile?.full_name });
    },
    [uid, businesses.length, patchProfile, loadBusinessData, record, profile],
  );

  const addBusiness = useCallback<DataCtx['addBusiness']>(
    async ({ name, type, city, countryCode }) => {
      if (!uid) return;
      const { data: biz } = await supabase
        .from('businesses')
        .insert({ owner_id: uid, name, type, city, country_code: countryCode, answers: {}, sort_order: businesses.length })
        .select()
        .single();
      if (!biz) return;
      await supabase.from('accounts').insert({ business_id: biz.id, cash: 0, mobile: 0, bank: 0 });
      setBusinesses((bs) => [...bs, biz as Business]);
      await patchProfile({ active_business_id: biz.id });
      await loadBusinessData(biz.id);
      await record({ businessId: biz.id, actionType: 'business.create', objectId: biz.id, summary: `Added ${name} to the portfolio`, payload: { name, type, city }, actorName: profile?.full_name });
    },
    [uid, businesses.length, patchProfile, loadBusinessData, record, profile],
  );

  const updateBusiness = useCallback(
    async (patch: Partial<Pick<Business, 'name' | 'city' | 'type' | 'country_code' | 'answers'>>) => {
      if (!activeBusiness) return;
      setBusinesses((bs) => bs.map((b) => (b.id === activeBusiness.id ? { ...b, ...patch } : b)));
      await supabase.from('businesses').update(patch).eq('id', activeBusiness.id);
      await record({ businessId: activeBusiness.id, actionType: 'business.update', objectId: activeBusiness.id, summary: `Updated business profile`, payload: patch, actorName: profile?.full_name });
    },
    [activeBusiness, record, profile],
  );

  const switchBusiness = useCallback(
    async (id: string) => {
      await patchProfile({ active_business_id: id });
      await loadBusinessData(id);
    },
    [patchProfile, loadBusinessData],
  );

  const updateProductPrice = useCallback(
    async (productId: string, price: number) => {
      const prior = products.find((p) => p.id === productId);
      setProducts((ps) => ps.map((p) => (p.id === productId ? { ...p, price } : p)));
      await supabase.from('products').update({ price }).eq('id', productId);
      if (activeBusiness && prior) {
        await record({
          businessId: activeBusiness.id, actionType: 'stock.updatePrice', objectId: productId,
          summary: `Changed ${prior.name} price from ${prior.price} to ${price}`, payload: { from: prior.price, to: price }, actorName: profile?.full_name,
        });
      }
    },
    [products, activeBusiness, record, profile],
  );

  const reorderProducts = useCallback(
    async (orderedIds: string[]) => {
      setProducts((ps) => {
        const byId = new Map(ps.map((p) => [p.id, p]));
        return orderedIds.map((id, i) => ({ ...(byId.get(id) as Product), sort_order: i }));
      });
      await Promise.all(orderedIds.map((id, i) => supabase.from('products').update({ sort_order: i }).eq('id', id)));
      if (activeBusiness) {
        await record({ businessId: activeBusiness.id, actionType: 'stock.reorder', summary: 'Reordered the product list', actorName: profile?.full_name });
      }
    },
    [activeBusiness, record, profile],
  );

  const addStock = useCallback(
    async (productId: string, qty: number) => {
      if (!activeBusiness || qty <= 0) return;
      const p = products.find((x) => x.id === productId);
      if (!p) return;
      const newAdded = p.added + qty;
      setProducts((ps) => ps.map((x) => (x.id === productId ? { ...x, added: newAdded } : x)));
      await supabase.from('products').update({ added: newAdded }).eq('id', productId);
      const { data: entry } = await supabase
        .from('ledger_entries')
        .insert({ business_id: activeBusiness.id, kind: 'stock', label: `Stock added — ${qty} × ${p.name}`, amount: 0, account: 'cash', who_name: profile?.full_name })
        .select()
        .single();
      if (entry) setLedger((l) => [entry as LedgerEntry, ...l]);
      await record({ businessId: activeBusiness.id, actionType: 'stock.add', objectId: productId, summary: `Added ${qty} × ${p.name} to stock`, payload: { qty, product: p.name }, actorName: profile?.full_name });
    },
    [activeBusiness, products, profile, record],
  );

  const addProduct = useCallback<DataCtx['addProduct']>(
    async ({ name, cat, unit, price, profit, low }) => {
      if (!activeBusiness) return;
      const { data: p } = await supabase
        .from('products')
        .insert({ business_id: activeBusiness.id, name, cat, unit, price, profit, low, cost: 0, icon: 'box', opening: 0, added: 0, wk: 0, sort_order: products.length })
        .select()
        .single();
      if (p) setProducts((ps) => [...ps, p as Product]);
      await record({ businessId: activeBusiness.id, actionType: 'stock.addProduct', objectId: p?.id, summary: `Added new product ${name}`, payload: { name, cat, price, profit }, actorName: profile?.full_name });
    },
    [activeBusiness, products.length, record, profile],
  );

  const updateProductFields = useCallback<DataCtx['updateProductFields']>(
    async (productId, patch) => {
      const prior = products.find((p) => p.id === productId);
      if (!prior || !activeBusiness) return;
      setProducts((ps) => ps.map((p) => (p.id === productId ? { ...p, ...patch } : p)));
      await supabase.from('products').update(patch).eq('id', productId);
      await record({
        businessId: activeBusiness.id, actionType: 'stock.updateProduct', objectId: productId,
        summary: `Updated ${prior.name}`, payload: patch, actorName: profile?.full_name,
      });
    },
    [products, activeBusiness, record, profile],
  );

  const addProductsBulk = useCallback<DataCtx['addProductsBulk']>(
    async (rows) => {
      if (!activeBusiness || rows.length === 0) return;
      const startIx = products.length;
      const toInsert = rows.map((r, i) => ({
        business_id: activeBusiness.id, name: r.name, cat: r.cat, unit: r.unit, cost: r.cost, price: r.price, profit: r.profit,
        low: r.low, icon: 'box', opening: r.opening, added: 0, wk: 0, sort_order: startIx + i,
      }));
      const { data } = await supabase.from('products').insert(toInsert).select();
      if (data) setProducts((ps) => [...ps, ...(data as Product[])]);
      await record({
        businessId: activeBusiness.id, actionType: 'stock.bulkImport',
        summary: `Imported ${rows.length} product${rows.length === 1 ? '' : 's'} from a file`,
        payload: { count: rows.length }, actorName: profile?.full_name,
      });
    },
    [activeBusiness, products.length, record, profile],
  );

  const ensureSession = useCallback(async (): Promise<StockSession | null> => {
    if (session) return session;
    if (!activeBusiness) return null;
    const { data } = await supabase
      .from('stock_sessions')
      .insert({ business_id: activeBusiness.id, session_date: todayIso(), status: 'open', counts: {}, closing_items: [] })
      .select()
      .single();
    if (data) setSession(data as StockSession);
    return data as StockSession | null;
  }, [session, activeBusiness]);

  const setClosingCount = useCallback(
    async (productId: string, qty: number | null) => {
      const s = (await ensureSession()) || session;
      if (!s) return;
      const counts = { ...s.counts };
      if (qty === null) delete counts[productId];
      else counts[productId] = qty;
      setSession({ ...s, counts });
      await supabase.from('stock_sessions').update({ counts }).eq('id', s.id);
    },
    [ensureSession, session],
  );

  const setSessionMoney = useCallback(
    async (field: 'cash' | 'mobile' | 'bank_in', value: number) => {
      const s = (await ensureSession()) || session;
      if (!s) return;
      setSession({ ...s, [field]: value });
      await supabase.from('stock_sessions').update({ [field]: value }).eq('id', s.id);
    },
    [ensureSession, session],
  );

  const addClosingItem = useCallback(
    async (kind: ClosingItemKind, amount: number, note: string) => {
      if (amount <= 0) return;
      const s = (await ensureSession()) || session;
      if (!s) return;
      const item: ClosingItem = { id: crypto.randomUUID(), kind, amount, note };
      const closing_items = [...(s.closing_items || []), item];
      setSession({ ...s, closing_items });
      await supabase.from('stock_sessions').update({ closing_items }).eq('id', s.id);
    },
    [ensureSession, session],
  );

  const removeClosingItem = useCallback(
    async (id: string) => {
      if (!session) return;
      const closing_items = (session.closing_items || []).filter((it) => it.id !== id);
      setSession({ ...session, closing_items });
      await supabase.from('stock_sessions').update({ closing_items }).eq('id', session.id);
    },
    [session],
  );

  const addLedgerLines = useCallback(
    async (lines: NewEntryLine[]) => {
      if (!activeBusiness || lines.length === 0) return;
      const rows = lines.map((l) => ({ business_id: activeBusiness.id, kind: l.kind, label: l.label, amount: l.amount, account: l.account, who_name: profile?.full_name }));
      const { data } = await supabase.from('ledger_entries').insert(rows).select();
      if (data) setLedger((l) => [...(data as LedgerEntry[]), ...l]);

      const delta = { cash: 0, mobile: 0, bank: 0 };
      for (const l of lines) delta[l.account] += l.amount;
      if (accounts) {
        const next = { ...accounts, cash: accounts.cash + delta.cash, mobile: accounts.mobile + delta.mobile, bank: accounts.bank + delta.bank };
        setAccounts(next);
        await supabase.from('accounts').update({ cash: next.cash, mobile: next.mobile, bank: next.bank }).eq('business_id', activeBusiness.id);
      }

      const total = lines.reduce((s, l) => s + Math.abs(l.amount), 0);
      const kinds = Array.from(new Set(lines.map((l) => l.kind))).join(', ');
      await record({
        businessId: activeBusiness.id, actionType: 'ledger.recordLines',
        summary: `Recorded ${lines.length} ${kinds} ${lines.length === 1 ? 'entry' : 'entries'} totaling ${total}`,
        payload: { lines }, actorName: profile?.full_name,
      });
    },
    [activeBusiness, profile, accounts, record],
  );

  const submitSession = useCallback(
    async (reason: string | null, note: string) => {
      const s = (await ensureSession()) || session;
      if (!s) return;
      const patch = { status: 'submitted' as const, reason, note, submitted_by_name: profile?.full_name || 'Staff', submitted_at: new Date().toISOString() };
      setSession({ ...s, ...patch });
      await supabase.from('stock_sessions').update(patch).eq('id', s.id);
      if (activeBusiness) {
        await record({
          businessId: activeBusiness.id, actionType: 'session.submit', objectId: s.id,
          summary: reason ? `Submitted today's closing for review (reason: ${reason})` : "Submitted today's closing for review",
          payload: { reason, note }, actorName: profile?.full_name,
        });
      }
    },
    [ensureSession, session, profile, activeBusiness, record],
  );

  const approveSession = useCallback(async () => {
    if (!session || !activeBusiness) return;
    const patch = { status: 'approved' as const, approved_by_name: profile?.full_name || 'Owner', approved_at: new Date().toISOString() };
    setSession({ ...session, ...patch });
    await supabase.from('stock_sessions').update(patch).eq('id', session.id);

    const closingItemLabel: Record<ClosingItemKind, string> = { expense: 'Expense', loss: 'Loss / breakage', debt: 'Staff debt' };
    const lines: NewEntryLine[] = [];
    if (session.cash > 0) lines.push({ kind: 'sale', label: 'Closing sales — cash', amount: session.cash, account: 'cash' });
    if (session.mobile > 0) lines.push({ kind: 'sale', label: 'Closing sales — mobile', amount: session.mobile, account: 'mobile' });
    if (session.bank_in > 0) lines.push({ kind: 'sale', label: 'Closing sales — bank', amount: session.bank_in, account: 'bank' });
    for (const item of session.closing_items || []) {
      if (item.amount <= 0) continue;
      lines.push({ kind: item.kind, label: item.note || closingItemLabel[item.kind], amount: -item.amount, account: 'cash' });
    }
    if (lines.length) await addLedgerLines(lines);

    await record({ businessId: activeBusiness.id, actionType: 'session.approve', objectId: session.id, summary: "Approved and locked today's closing", actorName: profile?.full_name });
  }, [session, profile, addLedgerLines, activeBusiness, record]);

  const fetchPortfolioSummary = useCallback<DataCtx['fetchPortfolioSummary']>(
    async (days) => {
      if (businesses.length === 0) return [];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const ids = businesses.map((b) => b.id);
      const { data } = await supabase
        .from('ledger_entries')
        .select('business_id, kind, amount')
        .in('business_id', ids)
        .gte('created_at', cutoff.toISOString());
      const rows = (data || []) as { business_id: string; kind: EntryKind; amount: number }[];
      return businesses.map((business) => {
        const own = rows.filter((r) => r.business_id === business.id);
        const revenue = own.filter((r) => r.kind === 'sale' || r.kind === 'payment').reduce((s, r) => s + r.amount, 0);
        const opex = own.filter((r) => r.kind === 'expense').reduce((s, r) => s + Math.abs(r.amount), 0);
        const losses = own.filter((r) => r.kind === 'loss').reduce((s, r) => s + Math.abs(r.amount), 0);
        const debt = own.filter((r) => r.kind === 'debt').reduce((s, r) => s + Math.abs(r.amount), 0);
        const cogs = Math.round(revenue * 0.6);
        const net = revenue - cogs - opex - losses;
        return { business, revenue, opex, losses, debt, net };
      });
    },
    [businesses],
  );

  const addStaffMember = useCallback<DataCtx['addStaffMember']>(
    async ({ name, phone, title }) => {
      if (!activeBusiness || !name.trim()) return;
      const { data: member } = await supabase
        .from('staff_members')
        .insert({ business_id: activeBusiness.id, name: name.trim(), phone: phone.trim() || null, title: title.trim() || null, sort_order: staffMembers.length })
        .select()
        .single();
      if (member) setStaffMembers((ms) => [...ms, member as StaffMember]);
      await record({
        businessId: activeBusiness.id, actionType: 'staff.add', objectId: member?.id,
        summary: `Added ${name.trim()} to the team`, payload: { name, phone, title }, actorName: profile?.full_name,
      });
    },
    [activeBusiness, staffMembers.length, record, profile],
  );

  const removeStaffMember = useCallback<DataCtx['removeStaffMember']>(
    async (id) => {
      if (!activeBusiness) return;
      const member = staffMembers.find((m) => m.id === id);
      setStaffMembers((ms) => ms.filter((m) => m.id !== id));
      await supabase.from('staff_members').delete().eq('id', id);
      await record({
        businessId: activeBusiness.id, actionType: 'staff.remove', objectId: id,
        summary: member ? `Removed ${member.name} from the team` : 'Removed a staff member', actorName: profile?.full_name,
      });
    },
    [activeBusiness, staffMembers, record, profile],
  );

  const returnSession = useCallback(async () => {
    if (!session || !activeBusiness) return;
    const patch = { status: 'open' as const };
    setSession({ ...session, ...patch });
    await supabase.from('stock_sessions').update(patch).eq('id', session.id);
    await record({ businessId: activeBusiness.id, actionType: 'session.return', objectId: session.id, summary: "Returned today's closing for correction", actorName: profile?.full_name });
  }, [session, activeBusiness, record, profile]);

  const displayName = profile?.full_name || authSession?.user?.email?.split('@')[0] || 'there';

  const value: DataCtx = {
    ready,
    profile,
    businesses,
    activeBusiness,
    products,
    accounts,
    ledger,
    session,
    actionLog,
    staffMembers,
    setLang,
    setTheme,
    setRole,
    displayName,
    completeOnboarding,
    addBusiness,
    updateBusiness,
    switchBusiness,
    updateProductPrice,
    reorderProducts,
    addStock,
    addProduct,
    addProductsBulk,
    updateProductFields,
    setClosingCount,
    setSessionMoney,
    addClosingItem,
    removeClosingItem,
    submitSession,
    approveSession,
    returnSession,
    addLedgerLines,
    fetchPortfolioSummary,
    addStaffMember,
    removeStaffMember,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
