// Bermi AI's answer engine — deterministic and fully grounded in the
// business's own data (products, ledger, action log), not an external LLM.
// Every number it states must be traceable to something actually recorded;
// it never invents a trend it can't compute from real rows. This is the
// "RAG" half of the assistant: retrieve the relevant slice of the ontology,
// then phrase it — no generation of unverified facts.

import { currentQty, diffOf, soldOf } from '../lib/calc';
import type { Accounts, Business, LedgerEntry, Lang, Product, StockSession } from '../lib/types';
import type { ActionLogEntry } from './actions';
import { deriveInsights } from './insights';

export interface BusinessSummary {
  business: Business;
  revenue: number;
  opex: number;
  losses: number;
  debt: number;
  net: number;
}

export interface AssistantData {
  products: Product[];
  session: StockSession | null;
  accounts: Accounts | null;
  ledger: LedgerEntry[];
  actionLog: ActionLogEntry[];
  businesses: Business[];
  activeBusinessName: string;
  portfolio: BusinessSummary[] | null;
  lang: Lang;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function inWindow(ledger: LedgerEntry[], fromDaysAgo: number, toDaysAgo: number): LedgerEntry[] {
  const from = daysAgo(fromDaysAgo);
  const to = daysAgo(toDaysAgo);
  return ledger.filter((e) => e.created_at >= from && e.created_at < to);
}

function revenueOf(entries: LedgerEntry[]): number {
  return entries.filter((e) => e.kind === 'sale' || e.kind === 'payment').reduce((s, e) => s + e.amount, 0);
}
function opexOf(entries: LedgerEntry[]): number {
  return entries.filter((e) => e.kind === 'expense').reduce((s, e) => s + Math.abs(e.amount), 0);
}
function lossesOf(entries: LedgerEntry[]): number {
  return entries.filter((e) => e.kind === 'loss').reduce((s, e) => s + Math.abs(e.amount), 0);
}
function debtOf(entries: LedgerEntry[]): number {
  return entries.filter((e) => e.kind === 'debt').reduce((s, e) => s + Math.abs(e.amount), 0);
}

const STOPWORDS = new Set([
  'how', 'much', 'many', 'is', 'are', 'the', 'a', 'an', 'of', 'what', 'do', 'i', 'have', 'my', 'me',
  'price', 'cost', 'stock', 'left', 'for', 'and', 'in', 'on', 'to', 'we', 'has', 'got',
  'ni', 'nini', 'bei', 'ya', 'gani', 'bado', 'kiasi', 'gani', 'yangu', 'tuna', 'nina', 'kwa', 'na',
]);

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/**
 * Best-effort product lookup from free text — matches on the product name
 * appearing (whole or by its distinct words) in the question. Returns null
 * rather than guessing when nothing lines up.
 */
export function findProduct(products: Product[], question: string): Product | null {
  const q = question.toLowerCase();
  // Exact/substring match on the full product name first — most reliable.
  const direct = products
    .filter((p) => p.name.length >= 3 && q.includes(p.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (direct) return direct;

  // Otherwise score by shared distinct words (handles partial names, missing
  // punctuation/parentheses, minor typos in word order).
  const qWords = new Set(normalizeWords(q));
  if (qWords.size === 0) return null;
  let best: { p: Product; score: number } | null = null;
  for (const p of products) {
    const pWords = normalizeWords(p.name);
    if (pWords.length === 0) continue;
    const overlap = pWords.filter((w) => qWords.has(w)).length;
    if (overlap === 0) continue;
    const score = overlap / pWords.length;
    if (score >= 0.5 && (!best || score > best.score)) best = { p, score };
  }
  return best?.p ?? null;
}

export function answerQuestion(data: AssistantData, question: string, fmt: (n: number) => string): string {
  const { products, session, accounts, ledger, actionLog, businesses, portfolio, lang } = data;
  const sw = lang === 'sw';
  const q = question.toLowerCase();
  const counts = session?.counts || {};

  // --- Portfolio-wide (only meaningful with more than one business) ---
  if (businesses.length > 1 && portfolio && /(all|every|portfolio|zote|jumla ya biashara)/.test(q) && /(business|biashara)/.test(q)) {
    const totalRevenue = portfolio.reduce((s, b) => s + b.revenue, 0);
    const totalNet = portfolio.reduce((s, b) => s + b.net, 0);
    const totalDebt = portfolio.reduce((s, b) => s + b.debt, 0);
    const best = [...portfolio].sort((a, b) => b.net - a.net)[0];
    const lines = portfolio.map((b) => `• ${b.business.name}: ${fmt(b.revenue)} ${sw ? 'mapato' : 'revenue'}, ${fmt(b.net)} ${sw ? 'faida' : 'net'}`);
    const lead = sw ? `Biashara zako zote (siku 7 zilizopita):` : `All your businesses (last 7 days):`;
    const tail = best
      ? sw
        ? `\n\n${best.business.name} inaongoza kwa faida.`
        : `\n\n${best.business.name} is leading on profit.`
      : '';
    const debtLine = totalDebt > 0 ? `\n${sw ? 'Jumla ya deni la wafanyakazi' : 'Total staff debt owed'}: ${fmt(totalDebt)}` : '';
    return `${lead}\n\n${lines.join('\n')}\n\n${sw ? 'Jumla' : 'Total'}: ${fmt(totalRevenue)} ${sw ? 'mapato' : 'revenue'} · ${fmt(totalNet)} ${sw ? 'faida halisi' : 'net profit'}${debtLine}${tail}`;
  }

  // --- Named-product lookup — most specific, checked early ---
  const named = findProduct(products, question);
  const asksAboutProduct = /(price|bei|stock|hisa|kiasi|gharama|cost|left|margin)/.test(q) || named !== null;
  if (named && asksAboutProduct) {
    const qty = currentQty(named, counts);
    const margin = named.price > 0 ? Math.round((named.profit / named.price) * 100) : 0;
    const low = qty < named.low;
    const lowNote = low ? (sw ? ` ⚠️ Chini ya kiwango cha chini (${named.low}).` : ` ⚠️ Below your reorder level (${named.low}).`) : '';
    return sw
      ? `${named.name}\nBei: ${fmt(named.price)} · Faida kwa ${named.unit}: ${fmt(named.profit)} (${margin}%)\nKilichopo: ${qty} ${named.unit}${lowNote}`
      : `${named.name}\nPrice: ${fmt(named.price)} · Profit per ${named.unit}: ${fmt(named.profit)} (${margin}%)\nIn stock: ${qty} ${named.unit}${lowNote}`;
  }

  // --- Category breakdown ---
  const cats = Array.from(new Set(products.map((p) => p.cat)));
  const namedCat = cats.find((c) => q.includes(c.toLowerCase()));
  if (namedCat && /(categor|aina|group)/.test(q + ' ' + namedCat)) {
    const inCat = products.filter((p) => p.cat === namedCat);
    const units = inCat.reduce((s, p) => s + soldOf(p, counts), 0);
    const revenue = inCat.reduce((s, p) => s + soldOf(p, counts) * p.price, 0);
    const stockUnits = inCat.reduce((s, p) => s + currentQty(p, counts), 0);
    return sw
      ? `${namedCat} — leo\nZimeuzwa: ${units} · Mapato: ${fmt(revenue)}\nZilizobaki hisani: ${stockUnits}`
      : `${namedCat} — today\nSold: ${units} · Revenue: ${fmt(revenue)}\nStill in stock: ${stockUnits}`;
  }

  // --- Top seller / slow mover today ---
  if (/(best.?sell|top.?product|bidhaa.*(zaidi|inayouzwa)|slow.?mov|haitakiw)/.test(q)) {
    const ranked = products.map((p) => ({ p, units: soldOf(p, counts) })).sort((a, b) => b.units - a.units);
    const wantsSlow = /slow|haitakiw/.test(q);
    const list = wantsSlow ? ranked.filter((r) => r.units === 0 && currentQty(r.p, counts) > 0).slice(0, 5) : ranked.filter((r) => r.units > 0).slice(0, 5);
    if (list.length === 0) {
      return sw ? 'Hakuna mauzo ya kutosha leo kujibu hilo bado.' : "Not enough of today's sales recorded yet to answer that.";
    }
    const lines = list.map((r) => `• ${r.p.name}${wantsSlow ? '' : ` — ${r.units} ${r.p.unit}`}`);
    const title = wantsSlow ? (sw ? 'Bidhaa hazijauzwa leo' : "Not selling today") : (sw ? 'Bidhaa bora leo' : 'Best sellers today');
    return `${title}:\n${lines.join('\n')}`;
  }

  // --- Losses / staff debt this week ---
  if (/(loss|hasara|breakage|kuvunjika)/.test(q)) {
    const week = inWindow(ledger, 7, 0);
    const l = lossesOf(week);
    return l > 0
      ? (sw ? `Hasara wiki hii: ${fmt(l)}` : `Losses this week: ${fmt(l)}`)
      : (sw ? 'Hakuna hasara iliyorekodiwa wiki hii.' : 'No losses recorded this week.');
  }
  if (/(debt|deni)/.test(q)) {
    const week = inWindow(ledger, 7, 0);
    const d = debtOf(week);
    return d > 0
      ? (sw ? `Deni la wafanyakazi wiki hii: ${fmt(d)}` : `Staff debt recorded this week: ${fmt(d)}`)
      : (sw ? 'Hakuna deni la mfanyakazi wiki hii.' : 'No staff debt recorded this week.');
  }

  // --- Best/worst day recently ---
  if (/(best day|worst day|siku bora|siku mbaya)/.test(q)) {
    const month = inWindow(ledger, 30, 0).filter((e) => e.kind === 'sale' || e.kind === 'payment');
    if (month.length === 0) return sw ? 'Bado hakuna mauzo ya kutosha kujibu hilo.' : "There isn't enough sales history yet to answer that.";
    const byDay = new Map<string, number>();
    for (const e of month) {
      const key = e.created_at.slice(0, 10);
      byDay.set(key, (byDay.get(key) || 0) + e.amount);
    }
    const sorted = Array.from(byDay.entries()).sort((a, b) => b[1] - a[1]);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    return sw
      ? `Siku bora zaidi (siku 30 zilizopita): ${best[0]} — ${fmt(best[1])}\nSiku dhaifu zaidi: ${worst[0]} — ${fmt(worst[1])}`
      : `Best day (last 30 days): ${best[0]} — ${fmt(best[1])}\nWeakest day: ${worst[0]} — ${fmt(worst[1])}`;
  }

  // --- Stock overview ---
  if (/(stock|bidhaa)/.test(q)) {
    const low = products.filter((p) => currentQty(p, counts) < p.low).map((p) => p.name);
    return (sw ? 'Bidhaa zilizopungua: ' : 'Below reorder: ') + (low.join(', ') || (sw ? 'Hakuna — hesabu ziko sawa.' : 'None — everything is at a healthy level.'));
  }

  // --- Cash position ---
  if (/(cash|fedha)/.test(q)) {
    const pos = (accounts?.cash || 0) + (accounts?.mobile || 0) + (accounts?.bank || 0);
    return (sw ? 'Fedha zilizopo: ' : 'Cash position: ') + fmt(pos)
      + `\n${sw ? 'Taslimu' : 'Cash'} ${fmt(accounts?.cash || 0)}\n${sw ? 'Simu' : 'Mobile'} ${fmt(accounts?.mobile || 0)}\n${sw ? 'Benki' : 'Bank'} ${fmt(accounts?.bank || 0)}`;
  }

  // --- Today's reconciliation difference ---
  if (/(diff|tofauti)/.test(q)) {
    if (!session) return sw ? "Hujaanza kufunga leo bado." : "You haven't started today's closing yet.";
    const diff = diffOf(products, counts, session);
    return (sw ? "Tofauti ya leo: " : "Today's difference: ") + fmt(Math.abs(diff));
  }

  // --- Week-over-week profit / revenue comparison ---
  if (/(profit|faida|revenue|mapato|week|wiki)/.test(q)) {
    const thisWeek = inWindow(ledger, 7, 0);
    const lastWeek = inWindow(ledger, 14, 7);
    const revThis = revenueOf(thisWeek);
    const revLast = revenueOf(lastWeek);
    const opexThis = opexOf(thisWeek);
    const lossThis = lossesOf(thisWeek);
    const cogsThis = Math.round(revThis * 0.6);
    const netThis = revThis - cogsThis - opexThis - lossThis;
    let trend = '';
    if (revLast > 0) {
      const pct = Math.round(((revThis - revLast) / revLast) * 100);
      trend = pct >= 0
        ? (sw ? `\n\nMapato yameongezeka ${pct}% kuliko wiki iliyopita.` : `\n\nRevenue is up ${pct}% versus last week.`)
        : (sw ? `\n\nMapato yamepungua ${Math.abs(pct)}% kuliko wiki iliyopita.` : `\n\nRevenue is down ${Math.abs(pct)}% versus last week.`);
    }
    return (sw
      ? `Wiki hii\n\nMapato: ${fmt(revThis)}\nGharama za bidhaa: ${fmt(cogsThis)}\nMatumizi: ${fmt(opexThis)}\nFaida halisi: ${fmt(netThis)}`
      : `This week\n\nRevenue: ${fmt(revThis)}\nCost of goods: ${fmt(cogsThis)}\nOperating expenses: ${fmt(opexThis)}\nNet profit: ${fmt(netThis)}`) + trend;
  }

  // --- Recent history ---
  if (/(happen|recent|history|kimetokea|karibuni)/.test(q)) {
    if (!actionLog.length) return sw ? 'Hakuna kilichorekodiwa bado.' : 'Nothing recorded yet.';
    return actionLog.slice(0, 6).map((a) => `• ${a.summary}`).join('\n');
  }

  // --- Advice / focus (existing insight engine) ---
  if (/(should|advice|focus|nifanye|ushauri)/.test(q)) {
    const insights = deriveInsights({ products, counts, accounts, actionLog, lang });
    if (!insights.length) return sw ? 'Kila kitu kinaonekana kuwa sawa kwa sasa.' : 'Everything looks steady right now — nothing urgent needs your attention.';
    return insights.slice(0, 3).map((i) => `• ${i.text}`).join('\n\n');
  }


  return defaultSummary(data, fmt);
}

export function defaultSummary(data: AssistantData, fmt: (n: number) => string): string {
  const { products, session, accounts, ledger, actionLog, lang, activeBusinessName } = data;
  const sw = lang === 'sw';
  const thisWeek = inWindow(ledger, 7, 0);
  const revThis = revenueOf(thisWeek);
  const opexThis = opexOf(thisWeek);
  const cogsThis = Math.round(revThis * 0.6);
  const netThis = revThis - cogsThis - opexThis;
  const insights = deriveInsights({ products, counts: session?.counts || {}, accounts, actionLog, lang });
  const top = insights[0];
  const base = sw
    ? `${activeBusinessName}\n\nMapato ya wiki: ${fmt(revThis)}\nFaida halisi: ${fmt(netThis)}`
    : `${activeBusinessName}\n\nThis week's revenue: ${fmt(revThis)}\nNet profit: ${fmt(netThis)}`;
  const noted = top ? `\n\n${sw ? 'Nimegundua' : 'I noticed'}: ${top.text}` : '';
  const hint = sw
    ? '\n\nUliza kuhusu bidhaa fulani, aina, fedha, tofauti, faida, hasara, deni, au nifanye nini.'
    : '\n\nAsk about a specific product, category, cash, difference, profit, losses, staff debt, or what to focus on.';
  return base + noted + hint;
}
