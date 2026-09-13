import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { todayIso } from '../lib/calc';
import { logAction, fetchRecentActions, type ActionLogEntry } from '../ontology/actions';
import {
  type Accounts,
  type Business,
  type EntryKind,
  type LedgerEntry,
  type Lang,
  type Product,
  type Profile,
  type Role,
  type StockSession,
  type Theme,
} from '../lib/types';

interface NewEntryLine {
  kind: EntryKind;
  label: string;
  amount: number;
  account: 'cash' | 'mobile' | 'bank';
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
  addProduct: (input: { name: string; cat: string; unit: string; cost: number; price: number; low: number }) => Promise<void>;
  addProductsBulk: (rows: { name: string; cat: string; unit: string; cost: number; price: number; opening: number; low: number }[]) => Promise<void>;

  setClosingCount: (productId: string, qty: number | null) => Promise<void>;
  setSessionMoney: (field: 'cash' | 'mobile' | 'bank_in' | 'expenses_paid', value: number) => Promise<void>;
  submitSession: (reason: string | null, note: string) => Promise<void>;
  approveSession: () => Promise<void>;
  returnSession: () => Promise<void>;

  addLedgerLines: (lines: NewEntryLine[]) => Promise<void>;
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
    const [{ data: prods }, { data: acc }, { data: led }, { data: sess }, log] = await Promise.all([
      supabase.from('products').select('*').eq('business_id', businessId).order('sort_order'),
      supabase.from('accounts').select('*').eq('business_id', businessId).maybeSingle(),
      supabase.from('ledger_entries').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(100),
      supabase.from('stock_sessions').select('*').eq('business_id', businessId).eq('session_date', todayIso()).maybeSingle(),
      fetchRecentActions(businessId),
    ]);
    setProducts(prods || []);
    setAccounts(acc || { business_id: businessId, cash: 0, mobile: 0, bank: 0 });
    setLedger(led || []);
    setSession(sess || null);
    setActionLog(log);
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
    async ({ name, cat, unit, cost, price, low }) => {
      if (!activeBusiness) return;
      const { data: p } = await supabase
        .from('products')
        .insert({ business_id: activeBusiness.id, name, cat, unit, cost, price, low, icon: 'box', opening: 0, added: 0, wk: 0, sort_order: products.length })
        .select()
        .single();
      if (p) setProducts((ps) => [...ps, p as Product]);
      await record({ businessId: activeBusiness.id, actionType: 'stock.addProduct', objectId: p?.id, summary: `Added new product ${name}`, payload: { name, cat, cost, price }, actorName: profile?.full_name });
    },
    [activeBusiness, products.length, record, profile],
  );

  const addProductsBulk = useCallback<DataCtx['addProductsBulk']>(
    async (rows) => {
      if (!activeBusiness || rows.length === 0) return;
      const startIx = products.length;
      const toInsert = rows.map((r, i) => ({
        business_id: activeBusiness.id, name: r.name, cat: r.cat, unit: r.unit, cost: r.cost, price: r.price,
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
      .insert({ business_id: activeBusiness.id, session_date: todayIso(), status: 'open', counts: {} })
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
    async (field: 'cash' | 'mobile' | 'bank_in' | 'expenses_paid', value: number) => {
      const s = (await ensureSession()) || session;
      if (!s) return;
      setSession({ ...s, [field]: value });
      await supabase.from('stock_sessions').update({ [field]: value }).eq('id', s.id);
    },
    [ensureSession, session],
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

    const lines: NewEntryLine[] = [];
    if (session.cash > 0) lines.push({ kind: 'sale', label: 'Closing sales — cash', amount: session.cash, account: 'cash' });
    if (session.mobile > 0) lines.push({ kind: 'sale', label: 'Closing sales — mobile', amount: session.mobile, account: 'mobile' });
    if (session.bank_in > 0) lines.push({ kind: 'sale', label: 'Closing sales — bank', amount: session.bank_in, account: 'bank' });
    if (session.expenses_paid > 0) lines.push({ kind: 'expense', label: 'Closing expenses paid', amount: -session.expenses_paid, account: 'cash' });
    if (lines.length) await addLedgerLines(lines);

    await record({ businessId: activeBusiness.id, actionType: 'session.approve', objectId: session.id, summary: "Approved and locked today's closing", actorName: profile?.full_name });
  }, [session, profile, addLedgerLines, activeBusiness, record]);

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
    setClosingCount,
    setSessionMoney,
    submitSession,
    approveSession,
    returnSession,
    addLedgerLines,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
