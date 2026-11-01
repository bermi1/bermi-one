/*
  Bermi's local brain: answers questions about a bar from its own records, on
  the phone, with no AI service and no internet needed.

  1. Understand: the question is normalised (case, accents, punctuation),
     Swahili and English words are mapped onto one set of concepts, typos are
     corrected against the business's own vocabulary (product names, people,
     concepts), and the dates, product, person and metric are pulled out.
  2. Retrieve: every verified closing, product, debt, expense and stock
     movement becomes a small "fact" in a search index (BM25). Questions the
     rules do not recognise are still answered from the best-matching facts.
  3. Answer: recognised questions go to a handler that computes the figures;
     the older analyst handles rankings, trends, forecasts and buying plans.
  4. Learn: when the owner says an answer missed and picks what they meant,
     that phrase is remembered for the business, so the next time it is
     understood straight away.
*/
import type { Accounts, LedgerEntry, Product, StockSession } from '../lib/types';
import type { Lang } from '../lib/i18n';
import type { SaleRow } from './analytics';
import type { DayPart } from './combine';
import { analyse, fullAnalysis, type AiAnswer, type AiBlock, type AnalystCtx } from './analyst';

// ------------------------------------------------------------------ language

/** Words in either language → one concept. Multi-word phrases first. */
const PHRASES: [RegExp, string][] = [
  [/\bkwa nini\b/g, ' WHY '],
  [/\bhow much\b/g, ' HOWMUCH '],
  [/\bhow many\b/g, ' HOWMUCH '],
  [/\brunning (low|out)\b/g, ' LOW '],
  [/\bnot (selling|moving)\b/g, ' WORST '],
  [/\bdead stock\b/g, ' WORST '],
  [/\bbest sellers?\b/g, ' BEST SALES '],
  [/\bon hand\b/g, ' STOCK '],
  [/\bnext week\b|\bwiki ijayo\b/g, ' FORECAST '],
  [/\bfull analysis\b|\buchambuzi kamili\b/g, ' FULL '],
  [/\bweek before\b|\bwiki iliyopita\b|\blast week\b|\bprevious week\b/g, ' LASTWEEK '],
  [/\bthis week\b|\bwiki hii\b/g, ' THISWEEK '],
  [/\blast month\b|\bmwezi uliopita\b|\bprevious month\b/g, ' LASTMONTH '],
  [/\bthis month\b|\bmwezi huu\b/g, ' THISMONTH '],
  [/\bday before yesterday\b/g, ' JUZI '],
  [/\bamount to bank\b|\bkupeleka bank\b/g, ' MONEY '],
];

const WORDS: Record<string, string> = {};
const add = (concept: string, words: string) => words.split(/\s+/).forEach((w) => { WORDS[w] = concept; });
add('SALES', 'sales sale sold sell sells selling revenue mauzo mapato uza kuuza inauza inauzwa zimeuzwa imeuzwa ziliuzwa ziliuza zinauzwa takings');
add('PROFIT', 'profit profits faida margin earn earned earnings gain');
add('ORDER', 'order orders buy buying purchase restock nunua ninunue kununua nunue oda agiza niagize niongeze');
add('SHORT', 'short shortage pungufu upungufu missing gap kosa');
add('OVER', 'over ziada extra surplus');
add('DEBT', 'debt debts owe owes owed owing deni madeni anadaiwa wanadaiwa amedaiwa mdaiwa wadaiwa');
add('EXPENSE', 'expense expenses spend spent spending matumizi gharama');
add('LOSS', 'loss losses broken breakage damaged hasara kuvunjika imevunjika');
add('MONEY', 'money cash pesa fedha hela mobile mpesa bank benki balance held');
add('STOCK', 'stock stoo shelf left remaining remain imebaki zimebaki zilizobaki iliyobaki ipo zipo');
add('LOW', 'low lowest finishing inaisha zinaisha kuisha zimepungua imepungua');
add('BEST', 'best top most highest popular bora zaidi maarufu kubwa');
add('WORST', 'worst least slow slowest lowest polepole haiuzwi hazi dhaifu');
add('COMPARE', 'compare comparison versus vs linganisha ukilinganisha than');
add('TREND', 'trend trending growth growing doing mwenendo inaendaje ukuaji');
add('FORECAST', 'forecast predict prediction expect tabiri makadirio');
add('WHY', 'why kwanini sababu reason');
add('WHO', 'who nani');
add('PRICE', 'price prices bei');
add('TRANSFER', 'transfer transfers transferred hamisha uhamisho imehamishwa');
add('SUMMARY', 'summary report ripoti muhtasari habari');
add('TODAY', 'today tonight leo');
add('YESTERDAY', 'yesterday jana');
add('JUZI', 'juzi');
add('WEEK', 'week weekly wiki');
add('MONTH', 'month monthly mwezi');
add('DAY', 'day days siku');
add('CATEGORY', 'category categories aina kundi');
add('ADVICE', 'advice advise recommend suggest ushauri nifanye pendekeza improve');
add('BUSIEST', 'busiest busy');

const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  jumapili: 0, jumatatu: 1, jumanne: 2, jumatano: 3, alhamisi: 4, ijumaa: 5, jumamosi: 6,
};
const MONTHS: Record<string, number> = {
  jan: 1, january: 1, januari: 1, feb: 2, february: 2, februari: 2, mar: 3, march: 3, machi: 3, apr: 4, april: 4, aprili: 4,
  may: 5, mei: 5, jun: 6, june: 6, juni: 6, jul: 7, july: 7, julai: 7, aug: 8, august: 8, agosti: 8, sep: 9, sept: 9, september: 9, septemba: 9,
  oct: 10, october: 10, oktoba: 10, nov: 11, november: 11, novemba: 11, dec: 12, december: 12, desemba: 12,
};
const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'to', 'in', 'on', 'for', 'and', 'my', 'me', 'i', 'we', 'it', 'what', 'which', 'how',
  'ni', 'ya', 'za', 'wa', 'la', 'cha', 'vya', 'kwa', 'na', 'je', 'gani', 'nini', 'hii', 'hiyo', 'yangu', 'zangu', 'wangu', 'nina', 'tuna', 'kuna', 'did', 'do', 'does', 'show', 'give', 'tell', 'nipe', 'nionyeshe', 'naomba']);

export function normalise(text: string): string {
  return ` ${text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9/\-\s]/g, ' ').replace(/\s+/g, ' ')} `;
}

/** Damerau-Levenshtein distance, capped: only small typos matter here. */
function editDistance(a: string, b: string, cap = 3): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
const tolerance = (w: string) => (w.length >= 8 ? 2 : w.length >= 5 ? 1 : 0);
/** Ordinary words that look like typos of a keyword but are not ("last" is not "least"). */
const PLAIN = new Set(('last next this that with have from much many more less than then when where there here they them your about after before still only also just very good well bad doing going place honest honestly ' +
  'today week weeks month months year days kesho hali sasa leo bado tena pia sana vizuri ilikuwa ilikua imekuwa kiasi ngapi wapi lini vipi mimi wewe yeye sisi wao huyu hawa hapa pale kila tu hadi mpaka tangu baada kabla').split(' '));

/** The closest known word, if the typo is small enough to be sure. */
function correct(word: string, vocab: string[]): string | null {
  const tol = tolerance(word);
  if (!tol) return null;
  let best: string | null = null, bestD = tol + 1;
  for (const v of vocab) {
    if (v[0] !== word[0] && tol < 2) continue;
    const dist = editDistance(word, v, tol);
    if (dist < bestD) { best = v; bestD = dist; }
  }
  return best;
}

// ------------------------------------------------------------------ data

export interface BrainData {
  businessId: string;
  businessName: string;
  sessions: StockSession[];
  rows: SaleRow[];
  products: Product[];
  counts: Record<string, number>;
  ledger: LedgerEntry[];
  accounts: Accounts | null;
  fmt: (n: number) => string;
  /** Tanzanian calendar day, YYYY-MM-DD. */
  today: string;
}

interface Day {
  date: string; sales: number; profit: number; cash: number; mobile: number; bank: number; toBank: number;
  expenses: number; losses: number; debts: number; gap: number; by: string | null;
  items: { kind: string; amount: number; note: string }[];
  /** Several businesses read together: each one's share of the day. */
  parts: DayPart[] | null;
}

function daysOf(sessions: StockSession[]): Day[] {
  return sessions.filter((s) => s.status === 'verified').map((s) => {
    const items = (s.closing_items || []).map((i) => ({ kind: i.kind, amount: Number(i.amount || 0), note: (i.note || '').trim() }));
    const sum = (k: string) => items.filter((i) => i.kind === k).reduce((t, i) => t + i.amount, 0);
    const sales = Number(s.total_calculated_sales || 0);
    const cash = Number(s.cash || 0), mobile = Number(s.mobile || 0), bank = Number(s.bank_in || 0), toBank = Number(s.amount_to_bank || 0);
    const expenses = sum('expense'), losses = sum('loss'), debts = sum('debt');
    return {
      date: s.session_date, sales, profit: Number(s.total_calculated_profit || 0), cash, mobile, bank, toBank, expenses, losses, debts,
      gap: cash + mobile + bank + toBank + expenses + losses + debts - sales, by: s.submitted_by_name, items,
      parts: (s as StockSession & { parts?: DayPart[] }).parts || null,
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

// ------------------------------------------------------------------ retrieval (BM25)

interface Doc { id: string; kind: string; date?: string; text: { en: string; sw: string }; terms: string[] }

function terms(text: string): string[] {
  return normalise(text).trim().split(' ').filter((w) => w && !STOP.has(w)).map((w) => WORDS[w] || w);
}

class Index {
  private df = new Map<string, number>();
  private avg = 1;
  docs: Doc[];
  constructor(docs: Doc[]) {
    this.docs = docs;
    for (const d of docs) for (const t of new Set(d.terms)) this.df.set(t, (this.df.get(t) || 0) + 1);
    this.avg = docs.reduce((s, d) => s + d.terms.length, 0) / Math.max(1, docs.length);
  }
  search(q: string[], k = 4): Doc[] {
    const N = this.docs.length, k1 = 1.4, b = 0.75;
    const scored = this.docs.map((d) => {
      let s = 0;
      for (const t of q) {
        const f = d.terms.filter((x) => x === t).length;
        if (!f) continue;
        const idf = Math.log(1 + (N - (this.df.get(t) || 0) + 0.5) / ((this.df.get(t) || 0) + 0.5));
        s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.terms.length / this.avg));
      }
      return { d, s };
    }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || (b.d.date || '').localeCompare(a.d.date || ''));
    return scored.slice(0, k).map((x) => x.d);
  }
}

function buildDocs(data: BrainData, days: Day[]): Doc[] {
  const { fmt } = data;
  const docs: Doc[] = [];
  const push = (id: string, kind: string, en: string, sw: string, extra = '', date?: string) =>
    docs.push({ id, kind, date, text: { en, sw }, terms: terms(`${en} ${sw} ${extra}`) });

  for (const d of days) {
    const g = d.gap === 0 ? 'balanced' : d.gap < 0 ? `short ${fmt(-d.gap)}` : `over ${fmt(d.gap)}`;
    const gs = d.gap === 0 ? 'imelingana' : d.gap < 0 ? `pungufu ${fmt(-d.gap)}` : `ziada ${fmt(d.gap)}`;
    push(`day:${d.date}`, 'day',
      `${d.date}: sales ${fmt(d.sales)}, profit ${fmt(d.profit)}, cash ${fmt(d.cash)}, mobile ${fmt(d.mobile)}, bank ${fmt(d.bank + d.toBank)}, expenses ${fmt(d.expenses)}, ${g}${d.by ? `, counted by ${d.by}` : ''}.`,
      `${d.date}: mauzo ${fmt(d.sales)}, faida ${fmt(d.profit)}, cash ${fmt(d.cash)}, mobile ${fmt(d.mobile)}, bank ${fmt(d.bank + d.toBank)}, matumizi ${fmt(d.expenses)}, ${gs}${d.by ? `, imehesabiwa na ${d.by}` : ''}.`,
      'SALES PROFIT MONEY SUMMARY DAY', d.date);
    for (const i of d.items) {
      const k = i.kind === 'debt' ? 'DEBT' : i.kind === 'loss' ? 'LOSS' : 'EXPENSE';
      const en = i.kind === 'debt' ? `${i.note || 'Someone'} owes ${fmt(i.amount)} (closing ${d.date})` : `${i.kind === 'loss' ? 'Loss' : 'Expense'} ${fmt(i.amount)}${i.note ? ` — ${i.note}` : ''} (closing ${d.date})`;
      const sw = i.kind === 'debt' ? `${i.note || 'Mtu'} anadaiwa ${fmt(i.amount)} (closing ${d.date})` : `${i.kind === 'loss' ? 'Hasara' : 'Matumizi'} ${fmt(i.amount)}${i.note ? ` — ${i.note}` : ''} (closing ${d.date})`;
      push(`item:${d.date}:${i.kind}:${i.note}:${i.amount}`, i.kind, en, sw, k, d.date);
    }
  }
  for (const p of data.products) {
    const shelf = Math.round((p.opening + p.added) * 100) / 100;
    push(`product:${p.id}`, 'product',
      `${p.name} (${p.cat}): ${shelf} ${p.unit} on the shelf, price ${fmt(p.price)}, profit ${fmt(p.profit)} per ${p.unit}${shelf <= p.low ? ' — below its low level' : ''}.`,
      `${p.name} (${p.cat}): ${shelf} ${p.unit} zipo, bei ${fmt(p.price)}, faida ${fmt(p.profit)} kwa ${p.unit}${shelf <= p.low ? ' — chini ya kiwango' : ''}.`,
      'STOCK PRICE PROFIT');
  }
  for (const l of data.ledger.filter((e) => e.kind === 'stock').slice(0, 60)) {
    push(`move:${l.id}`, 'move', `${l.created_at.slice(0, 10)}: ${l.label}`, `${l.created_at.slice(0, 10)}: ${l.label}`, 'STOCK TRANSFER', l.created_at.slice(0, 10));
  }
  return docs;
}

// ------------------------------------------------------------------ understanding

export type Intent =
  | 'order' | 'why_gap' | 'debt' | 'expense' | 'loss' | 'money' | 'compare' | 'best' | 'profit_rank' | 'worst' | 'low'
  | 'product' | 'trend' | 'forecast' | 'day' | 'moves' | 'full' | 'busiest' | 'category' | 'advice' | 'search';

export const INTENT_LABELS: Record<Exclude<Intent, 'search'>, { en: string; sw: string }> = {
  day: { en: 'A day’s closing', sw: 'Closing ya siku' },
  order: { en: 'What to order', sw: 'Ninunue nini' },
  why_gap: { en: 'Why short / over', sw: 'Kwa nini pungufu / ziada' },
  best: { en: 'Best sellers', sw: 'Zinazouza zaidi' },
  profit_rank: { en: 'Most profit', sw: 'Faida kubwa' },
  worst: { en: 'Not selling', sw: 'Haziuzi' },
  low: { en: 'Low stock', sw: 'Stock iliyopungua' },
  product: { en: 'One product', sw: 'Bidhaa moja' },
  compare: { en: 'Compare periods', sw: 'Linganisha vipindi' },
  trend: { en: 'Trend', sw: 'Mwenendo' },
  forecast: { en: 'Forecast', sw: 'Makadirio' },
  debt: { en: 'Who owes', sw: 'Nani anadaiwa' },
  expense: { en: 'Expenses', sw: 'Matumizi' },
  loss: { en: 'Losses', sw: 'Hasara' },
  money: { en: 'Money held', sw: 'Pesa zilizopo' },
  moves: { en: 'Stock movements', sw: 'Mizunguko ya stock' },
  busiest: { en: 'Busiest day', sw: 'Siku yenye kazi zaidi' },
  category: { en: 'By category', sw: 'Kwa aina' },
  advice: { en: 'Advice', sw: 'Ushauri' },
  full: { en: 'Full analysis', sw: 'Uchambuzi kamili' },
};

export interface Parsed {
  concepts: Set<string>;
  words: string[];
  product: Product | null;
  person: string | null;
  /** A single day the question is about, when it names one. */
  date: string | null;
  /** A range, for "this week", "last 10 days", "this month". */
  range: { from: string; to: string; label: { en: string; sw: string } } | null;
  rangeB: { from: string; to: string; label: { en: string; sw: string } } | null;
  intent: Intent;
  learned: boolean;
}

const addDaysIso = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekStart = (iso: string) => { const d = new Date(`${iso}T12:00:00Z`); const wd = (d.getUTCDay() + 6) % 7; return addDaysIso(iso, -wd); };

function people(days: Day[]): string[] {
  return [...new Set(days.flatMap((d) => d.items.filter((i) => i.kind === 'debt' && i.note).map((i) => i.note)))];
}

export function parse(question: string, data: BrainData, memory: BrainMemory): Parsed {
  const days = daysOf(data.sessions);
  let text = normalise(question);
  for (const [re, c] of PHRASES) text = text.replace(re, c);
  const raw = text.trim().split(' ').filter(Boolean);

  // Vocabulary the typo-corrector may snap to: concepts' words, product and people names.
  const productWords = data.products.flatMap((p) => normalise(p.name).trim().split(' ')).filter((w) => w.length >= 3);
  const names = people(days);
  const nameWords = names.flatMap((n) => normalise(n).trim().split(' ')).filter((w) => w.length >= 3);
  const vocab = [...Object.keys(WORDS), ...Object.keys(WEEKDAYS), ...productWords, ...nameWords];

  const concepts = new Set<string>();
  const words: string[] = [];
  for (const w0 of raw) {
    if (/^[A-Z]+$/.test(w0)) { concepts.add(w0); continue; }
    if (STOP.has(w0)) continue;
    let w = w0;
    if (!WORDS[w] && !PLAIN.has(w) && !(w in MONTHS) && !(w in WEEKDAYS) && !productWords.includes(w) && !nameWords.includes(w) && !/\d/.test(w)) w = correct(w, vocab) || w;
    if (WORDS[w]) concepts.add(WORDS[w]);
    words.push(w);
  }
  const joined = ` ${words.join(' ')} `;

  // Product: whole name first, then the best share of its words.
  let product: Product | null = null, best = 0;
  for (const p of data.products) {
    const pw = normalise(p.name).trim().split(' ').filter((w) => w.length >= 3);
    if (!pw.length) continue;
    if (joined.includes(` ${pw.join(' ')} `)) { if (pw.length + 1 > best) { product = p; best = pw.length + 1; } continue; }
    const hit = pw.filter((w) => words.includes(w)).length / pw.length;
    if (hit >= 0.5 && hit > best) { product = p; best = hit; }
  }

  // Person (for debts): a name written in a closing.
  let person: string | null = null;
  for (const n of names) {
    const nw = normalise(n).trim().split(' ').filter((w) => w.length >= 3);
    if (nw.some((w) => words.includes(w))) { person = n; break; }
  }

  // Dates.
  const latest = days[0]?.date || data.today;
  let date: string | null = null;
  let range: Parsed['range'] = null;
  let rangeB: Parsed['rangeB'] = null;
  if (concepts.has('TODAY')) date = days.some((d) => d.date === data.today) ? data.today : latest;
  if (concepts.has('YESTERDAY')) date = addDaysIso(data.today, -1);
  if (concepts.has('JUZI')) date = addDaysIso(data.today, -2);
  for (const w of words) {
    if (w in WEEKDAYS) {
      for (let i = 0; i < 14; i++) { const d = addDaysIso(data.today, -i); if (new Date(`${d}T12:00:00Z`).getUTCDay() === WEEKDAYS[w]) { date = d; break; } }
    }
  }
  const iso = question.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/);
  const dm = question.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/);
  const named = words.map((w, i) => (MONTHS[w] && /^\d{1,2}$/.test(words[i - 1] || '') ? `${words[i - 1]}:${MONTHS[w]}` : MONTHS[w] && /^\d{1,2}$/.test(words[i + 1] || '') ? `${words[i + 1]}:${MONTHS[w]}` : '')).find(Boolean);
  const year = data.today.slice(0, 4);
  const pad = (n: number | string) => String(n).padStart(2, '0');
  if (iso) date = iso[0];
  else if (named) { const [dd, mm] = named.split(':'); date = `${year}-${pad(mm)}-${pad(dd)}`; }
  else if (dm && Number(dm[2]) <= 12) date = `${dm[3] ? (dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : year}-${pad(dm[2])}-${pad(dm[1])}`;

  const thisWeek = { from: weekStart(data.today), to: data.today, label: { en: 'this week', sw: 'wiki hii' } };
  const lastWeek = { from: addDaysIso(weekStart(data.today), -7), to: addDaysIso(weekStart(data.today), -1), label: { en: 'last week', sw: 'wiki iliyopita' } };
  const thisMonth = { from: `${data.today.slice(0, 8)}01`, to: data.today, label: { en: 'this month', sw: 'mwezi huu' } };
  const lmEnd = addDaysIso(`${data.today.slice(0, 8)}01`, -1);
  const lastMonth = { from: `${lmEnd.slice(0, 8)}01`, to: lmEnd, label: { en: 'last month', sw: 'mwezi uliopita' } };
  const nDays = question.toLowerCase().match(/(\d{1,3})\s*(days|day|siku)|siku\s*(\d{1,3})/);
  if (concepts.has('THISWEEK')) range = thisWeek;
  if (concepts.has('LASTWEEK')) { if (range) rangeB = lastWeek; else range = lastWeek; }
  if (concepts.has('THISMONTH')) range = thisMonth;
  if (concepts.has('LASTMONTH')) { if (range) rangeB = lastMonth; else range = lastMonth; }
  if (nDays && !date) { const n = Math.max(1, Math.min(120, Number(nDays[1] || nDays[3]))); range = { from: addDaysIso(latest, -(n - 1)), to: latest, label: { en: `the last ${n} days`, sw: `siku ${n} zilizopita` } }; }
  if (concepts.has('COMPARE') && !rangeB) {
    if (concepts.has('MONTH')) { range = thisMonth; rangeB = lastMonth; } else { range = range || thisWeek; rangeB = range === lastWeek ? { from: addDaysIso(lastWeek.from, -7), to: addDaysIso(lastWeek.from, -1), label: { en: 'the week before', sw: 'wiki iliyotangulia' } } : lastWeek; }
  }

  // What is being asked: a learned phrase wins, then the rules.
  const key = words.join(' ');
  const learnedIntent = memory.phrases[key] || matchLearned(words, memory);
  const has = (c: string) => concepts.has(c);
  let intent: Intent;
  if (learnedIntent) intent = learnedIntent;
  else if (has('FULL')) intent = 'full';
  else if (has('ORDER')) intent = 'order';
  else if (has('SHORT') || has('OVER') || (has('WHY') && (has('MONEY') || date))) intent = 'why_gap';
  else if (has('DEBT') || (has('WHO') && has('MONEY'))) intent = 'debt';
  else if (has('TRANSFER')) intent = 'moves';
  else if (has('EXPENSE')) intent = 'expense';
  else if (has('LOSS')) intent = 'loss';
  else if (has('COMPARE') || rangeB) intent = 'compare';
  else if (has('FORECAST')) intent = 'forecast';
  else if (has('BUSIEST') || (has('BEST') && has('DAY') && !has('SALES') && !product)) intent = 'busiest';
  else if (has('CATEGORY')) intent = 'category';
  else if (has('SUMMARY') && (date || range)) intent = 'day';
  else if (has('WORST')) intent = 'worst';
  else if (has('BEST') && has('PROFIT')) intent = 'profit_rank';
  else if (has('BEST')) intent = 'best';
  else if (has('LOW') && !product) intent = 'low';
  else if (product) intent = 'product';
  else if (has('TREND')) intent = 'trend';
  else if (has('ADVICE')) intent = 'advice';
  else if (has('MONEY') && !has('SALES') && !date) intent = 'money';
  else if (date || has('SUMMARY') || has('SALES') || has('PROFIT')) intent = date || range ? 'day' : 'trend';
  else if (has('STOCK')) intent = 'low';
  else intent = 'search';

  return { concepts, words, product, person, date, range, rangeB, intent, learned: !!learnedIntent };
}

// ------------------------------------------------------------------ learning

export interface BrainMemory { phrases: Record<string, Intent>; asked: Record<string, number> }

const memKey = (biz: string) => `bermi:brain:${biz}`;
export function loadMemory(businessId: string): BrainMemory {
  try { const m = JSON.parse(localStorage.getItem(memKey(businessId)) || ''); if (m && m.phrases) return { phrases: m.phrases, asked: m.asked || {} }; } catch { /* first time, or storage off */ }
  return { phrases: {}, asked: {} };
}
function saveMemory(businessId: string, m: BrainMemory) {
  try { localStorage.setItem(memKey(businessId), JSON.stringify(m)); } catch { /* private mode: it just won't remember */ }
}
/** A close rephrasing of something already taught counts too. */
function matchLearned(words: string[], memory: BrainMemory): Intent | null {
  const a = new Set(words);
  let best: Intent | null = null, score = 0;
  for (const [phrase, intent] of Object.entries(memory.phrases)) {
    const b = new Set(phrase.split(' '));
    const inter = [...a].filter((w) => b.has(w)).length;
    const j = inter / (a.size + b.size - inter || 1);
    if (j >= 0.6 && j > score) { best = intent; score = j; }
  }
  return best;
}
/** The owner said what a question meant: remember it for this business. */
export function teach(businessId: string, question: string, intent: Intent, data: BrainData) {
  const m = loadMemory(businessId);
  const words = parse(question, data, { phrases: {}, asked: {} }).words;
  if (!words.length) return;
  m.phrases[words.join(' ')] = intent;
  saveMemory(businessId, m);
}
function noteAsked(businessId: string, intent: Intent) {
  const m = loadMemory(businessId);
  m.asked[intent] = (m.asked[intent] || 0) + 1;
  saveMemory(businessId, m);
}

// ------------------------------------------------------------------ answering

const txt = (text: string): AiBlock => ({ kind: 'text', text });

/** "By business" bars, when the answer covers more than one business. */
function splitBlock(ds: Day[], fmt: (n: number) => string, sw: boolean): AiBlock[] {
  const m = new Map<string, { sales: number; gap: number }>();
  for (const d of ds) for (const p of d.parts || []) {
    const e = m.get(p.business) || { sales: 0, gap: 0 };
    e.sales += p.sales; e.gap += p.gap; m.set(p.business, e);
  }
  if (m.size < 2) return [];
  const gapTxt = (g: number) => (g === 0 ? (sw ? 'imelingana' : 'balanced') : g < 0 ? `${sw ? 'pungufu' : 'short'} ${fmt(-g)}` : `${sw ? 'ziada' : 'over'} ${fmt(g)}`);
  return [{ kind: 'bars', title: sw ? 'Kwa biashara' : 'By business', rows: [...m].sort((a, b) => b[1].sales - a[1].sales).map(([name, e]) => ({
    label: name, value: e.sales, display: fmt(e.sales), note: gapTxt(e.gap), tone: e.gap < 0 ? 'bad' as const : 'neutral' as const })) }];
}

function analystAsk(q: string, data: BrainData, lang: Lang, product: Product | null = null): AiAnswer | null {
  const ctx: AnalystCtx = { rows: data.rows, products: data.products, counts: data.counts, lang, fmt: data.fmt, businessName: data.businessName };
  return q === 'full' ? fullAnalysis(ctx) : analyse(q, ctx, product);
}
function rangeWords(p: Parsed): string {
  if (p.range) { const m = p.range.label.en.match(/last (\d+) days/); return m ? `last ${m[1]} days` : p.range.label.en.includes('month') ? 'last 30 days' : 'this week'; }
  if (p.date) return 'yesterday';
  return '';
}

export interface BrainAnswer { answer: AiAnswer; intent: Intent; learned: boolean }

export function answer(question: string, data: BrainData, lang: Lang): BrainAnswer {
  const sw = lang === 'sw';
  const memory = loadMemory(data.businessId);
  const p = parse(question, data, memory);
  const out = respond(p, question, data, lang);
  noteAsked(data.businessId, p.intent);
  return { answer: out ?? search(p, data, sw), intent: p.intent, learned: p.learned };
}

/** Answer as a particular intent: used when the owner corrects the brain. */
export function answerAs(intent: Intent, question: string, data: BrainData, lang: Lang): AiAnswer {
  const p = { ...parse(question, data, { phrases: {}, asked: {} }), intent };
  return respond(p, question, data, lang) ?? search(p, data, lang === 'sw');
}

function respond(p: Parsed, _question: string, data: BrainData, lang: Lang): AiAnswer | null {
  const sw = lang === 'sw';
  const { fmt } = data;
  const days = daysOf(data.sessions);
  const T = (en: string, s: string) => (sw ? s : en);
  const noDays = (): AiAnswer => ({ blocks: [txt(T('There are no verified closings yet, so there is nothing to read from. Verify a closing and ask again.', 'Bado hakuna closing iliyo verified. Verify closing kwanza, kisha uliza tena.'))] });

  switch (p.intent) {
    case 'full': return analystAsk('full', data, lang);
    case 'order': return analystAsk('what should I buy', data, lang);
    case 'best': return analystAsk(`best sellers ${rangeWords(p)}`, data, lang);
    case 'profit_rank': return analystAsk(`most profitable ${rangeWords(p)}`, data, lang);
    case 'worst': return analystAsk(`slow not selling ${rangeWords(p)}`, data, lang);
    case 'trend': return analystAsk(`trend ${rangeWords(p)}`, data, lang);
    case 'forecast': return analystAsk('forecast next week', data, lang);
    case 'busiest': return analystAsk('which day is busiest', data, lang);
    case 'category': return analystAsk(`category ${rangeWords(p)}`, data, lang);
    case 'advice': return analystAsk('what should i add advice', data, lang);
    case 'product': {
      if (!p.product) return null;
      const pr = p.product;
      const shelf = Math.round((pr.opening + pr.added) * 100) / 100;
      const sold = data.rows.filter((r) => r.productId === pr.id).slice(-14);
      const perDay = sold.length ? sold.reduce((s, r) => s + r.sold, 0) / sold.length : 0;
      const cover = perDay > 0 ? shelf / perDay : Infinity;
      const blocks: AiBlock[] = [
        { kind: 'kpis', items: [
          { label: T('On the shelf', 'Zipo'), value: `${shelf} ${pr.unit}`, tone: shelf <= pr.low ? 'bad' : 'neutral' },
          { label: T('Sells per day', 'Inauzwa kwa siku'), value: `${Math.round(perDay * 10) / 10} ${pr.unit}` },
          { label: T('Price', 'Bei'), value: fmt(pr.price) },
          { label: T('Profit each', 'Faida kila moja'), value: fmt(pr.profit) },
        ] },
        txt(perDay > 0
          ? T(`That is about ${Math.floor(cover)} day${Math.floor(cover) === 1 ? '' : 's'} of stock.${cover < 3 ? ' Order more soon.' : ''}`, `Hiyo ni stock ya siku ${Math.floor(cover)} hivi.${cover < 3 ? ' Agiza zaidi karibuni.' : ''}`)
          : T('No sales of it in the recent verified closings.', 'Haijauzwa kwenye closing za karibuni zilizo verified.')),
      ];
      const deep = analystAsk(`how is ${pr.name} selling ${rangeWords(p)}`, data, lang, pr);
      return { blocks: deep ? [...blocks, ...deep.blocks.filter((b) => b.kind !== 'kpis')] : blocks };
    }
    case 'low': {
      const low = data.products.map((x) => ({ x, shelf: Math.round((x.opening + x.added) * 100) / 100 })).filter(({ x, shelf }) => shelf <= x.low).sort((a, b) => a.shelf - b.shelf);
      if (!low.length) return { blocks: [txt(T('Nothing is below its low level right now.', 'Hakuna bidhaa iliyo chini ya kiwango sasa hivi.'))] };
      return { blocks: [txt(T(`${low.length} product${low.length === 1 ? ' is' : 's are'} at or below the low level:`, `Bidhaa ${low.length} ziko chini ya kiwango:`)),
        { kind: 'list', items: low.slice(0, 10).map(({ x, shelf }) => ({ title: x.name, detail: T(`${shelf} ${x.unit} left · low level ${x.low}`, `Zimebaki ${shelf} ${x.unit} · kiwango ${x.low}`), tone: shelf <= 0 ? 'bad' as const : 'warn' as const })) }] };
    }
    case 'day': {
      if (!days.length) return noDays();
      const pick = p.date ? days.find((d) => d.date === p.date) : null;
      if (p.date && !pick) return { blocks: [txt(T(`There is no verified closing for ${p.date}. The latest is ${days[0].date}.`, `Hakuna closing iliyo verified ya ${p.date}. Ya mwisho ni ${days[0].date}.`))] };
      if (!pick && p.range) return periodSummary(days.filter((d) => d.date >= p.range!.from && d.date <= p.range!.to), sw ? p.range.label.sw : p.range.label.en, data, sw);
      return daySummary(pick || days[0], data, sw);
    }
    case 'why_gap': {
      if (!days.length) return noDays();
      const d = p.date ? days.find((x) => x.date === p.date) : days.find((x) => x.gap !== 0) || days[0];
      if (!d) return { blocks: [txt(T(`There is no verified closing for ${p.date}.`, `Hakuna closing iliyo verified ya ${p.date}.`))] };
      return whyGap(d, days, data, sw);
    }
    case 'compare': {
      if (!days.length) return noDays();
      const a = p.range!, b = p.rangeB!;
      return compare(days.filter((d) => d.date >= a.from && d.date <= a.to), days.filter((d) => d.date >= b.from && d.date <= b.to), sw ? a.label.sw : a.label.en, sw ? b.label.sw : b.label.en, data, sw);
    }
    case 'debt': {
      const list = new Map<string, { total: number; dates: string[] }>();
      for (const d of days) for (const i of d.items.filter((x) => x.kind === 'debt')) {
        const who = i.note || T('Unnamed', 'Bila jina');
        const e = list.get(who) || { total: 0, dates: [] };
        e.total += i.amount; e.dates.push(d.date); list.set(who, e);
      }
      const rows = [...list].filter(([who]) => !p.person || who === p.person).sort((a, b) => b[1].total - a[1].total);
      if (!rows.length) return { blocks: [txt(T('No staff debt recorded in the verified closings.', 'Hakuna deni la mfanyakazi kwenye closing zilizo verified.'))] };
      const total = rows.reduce((s, [, e]) => s + e.total, 0);
      return { blocks: [txt(T(`Staff debt recorded: ${fmt(total)}.`, `Deni la wafanyakazi lililoandikwa: ${fmt(total)}.`)),
        { kind: 'bars', rows: rows.slice(0, 10).map(([who, e]) => ({ label: who, value: e.total, display: fmt(e.total), note: T(`${e.dates.length} time${e.dates.length === 1 ? '' : 's'}, last ${e.dates[0]}`, `mara ${e.dates.length}, mwisho ${e.dates[0]}`), tone: 'warn' as const })) }] };
    }
    case 'expense':
    case 'loss': {
      const kind = p.intent === 'loss' ? 'loss' : 'expense';
      const span = p.range || { from: addDaysIso(data.today, -30), to: data.today, label: { en: 'the last 30 days', sw: 'siku 30 zilizopita' } };
      const items = days.filter((d) => d.date >= span.from && d.date <= span.to).flatMap((d) => d.items.filter((i) => i.kind === kind).map((i) => ({ ...i, date: d.date })));
      const total = items.reduce((s, i) => s + i.amount, 0);
      if (!items.length) return { blocks: [txt(T(`No ${kind === 'loss' ? 'losses' : 'expenses'} recorded in ${span.label.en}.`, `Hakuna ${kind === 'loss' ? 'hasara' : 'matumizi'} ${span.label.sw}.`))] };
      return { blocks: [txt(T(`${kind === 'loss' ? 'Losses' : 'Expenses'} in ${span.label.en}: ${fmt(total)}.`, `${kind === 'loss' ? 'Hasara' : 'Matumizi'} ${span.label.sw}: ${fmt(total)}.`)),
        { kind: 'list', items: items.sort((a, b) => b.amount - a.amount).slice(0, 8).map((i) => ({ title: `${fmt(i.amount)}${i.note ? ` · ${i.note}` : ''}`, detail: i.date, tone: 'neutral' as const })) }] };
    }
    case 'money': {
      const a = data.accounts;
      if (!a) return null;
      return { blocks: [{ kind: 'kpis', items: [
        { label: 'Cash', value: fmt(a.cash) }, { label: 'Mobile', value: fmt(a.mobile) }, { label: 'Bank', value: fmt(a.bank) },
        { label: T('Total', 'Jumla'), value: fmt(a.cash + a.mobile + a.bank) },
      ] }, txt(T('Money held, from the verified closings less what was paid out.', 'Pesa zilizopo, kutoka closing zilizo verified ukiondoa zilizolipwa.'))] };
    }
    case 'moves': {
      const moves = data.ledger.filter((e) => e.kind === 'stock' && (!p.product || e.label.toLowerCase().includes(p.product.name.toLowerCase()))).slice(0, 10);
      if (!moves.length) return { blocks: [txt(T('No stock movements recorded recently.', 'Hakuna mizunguko ya stock iliyoandikwa karibuni.'))] };
      return { blocks: [{ kind: 'list', title: T('Recent stock movements', 'Mizunguko ya karibuni'), items: moves.map((m) => ({ title: m.label, detail: `${m.created_at.slice(0, 10)}${m.who_name ? ` · ${m.who_name}` : ''}`, tone: 'neutral' as const })) }] };
    }
    case 'search': return null;
  }
}

function daySummary(d: Day, data: BrainData, sw: boolean): AiAnswer {
  const { fmt } = data;
  const T = (en: string, s: string) => (sw ? s : en);
  const sold = data.rows.filter((r) => r.date === d.date).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const gapTxt = d.gap === 0 ? T('Balanced', 'Imelingana') : d.gap < 0 ? T(`Short ${fmt(-d.gap)}`, `Pungufu ${fmt(-d.gap)}`) : T(`Over ${fmt(d.gap)}`, `Ziada ${fmt(d.gap)}`);
  return { blocks: [
    txt(T(`Closing of ${d.date}${d.by ? `, counted by ${d.by}` : ''}.`, `Closing ya ${d.date}${d.by ? `, imehesabiwa na ${d.by}` : ''}.`)),
    { kind: 'kpis', items: [
      { label: T('Sales', 'Mauzo'), value: fmt(d.sales) }, { label: T('Profit', 'Faida'), value: fmt(d.profit) },
      { label: T('Collected', 'Zilizokusanywa'), value: fmt(d.cash + d.mobile + d.bank + d.toBank) },
      { label: T('Result', 'Matokeo'), value: gapTxt, tone: d.gap < 0 ? 'bad' : d.gap > 0 ? 'warn' : 'good' },
    ] },
    ...splitBlock([d], fmt, sw),
    ...(sold.length ? [{ kind: 'bars' as const, title: T('Top sellers that day', 'Zilizouza zaidi siku hiyo'), rows: sold.map((r) => ({ label: r.name, value: r.revenue, display: `${r.sold} ${r.unit} · ${fmt(r.revenue)}` })) }] : []),
  ] };
}

function periodSummary(ds: Day[], label: string, data: BrainData, sw: boolean): AiAnswer {
  const { fmt } = data;
  const T = (en: string, s: string) => (sw ? s : en);
  if (!ds.length) return { blocks: [txt(T(`No verified closings in ${label}.`, `Hakuna closing iliyo verified ${label}.`))] };
  const sum = (f: (d: Day) => number) => ds.reduce((s, d) => s + f(d), 0);
  const gap = sum((d) => d.gap);
  const best = [...ds].sort((a, b) => b.sales - a.sales)[0];
  return { blocks: [
    txt(T(`${label}: ${ds.length} verified closing${ds.length === 1 ? '' : 's'}.`, `${label}: closing ${ds.length} zilizo verified.`)),
    { kind: 'kpis', items: [
      { label: T('Sales', 'Mauzo'), value: fmt(sum((d) => d.sales)) }, { label: T('Profit', 'Faida'), value: fmt(sum((d) => d.profit)) },
      { label: T('Expenses', 'Matumizi'), value: fmt(sum((d) => d.expenses)) },
      { label: T('Short / over', 'Pungufu / ziada'), value: gap === 0 ? T('Balanced', 'Imelingana') : `${gap < 0 ? '−' : '+'}${fmt(Math.abs(gap))}`, tone: gap < 0 ? 'bad' : 'neutral' },
    ] },
    ...splitBlock(ds, fmt, sw),
    txt(T(`Best day: ${best.date} with ${fmt(best.sales)}.`, `Siku bora: ${best.date} kwa ${fmt(best.sales)}.`)),
  ] };
}

function whyGap(d: Day, days: Day[], data: BrainData, sw: boolean): AiAnswer {
  const { fmt } = data;
  const T = (en: string, s: string) => (sw ? s : en);
  const collected = d.cash + d.mobile + d.bank + d.toBank;
  const recorded = d.expenses + d.losses + d.debts;
  if (d.gap === 0) return { blocks: [txt(T(`${d.date} balanced: sales ${fmt(d.sales)} = money collected ${fmt(collected)} + expenses, losses and debts ${fmt(recorded)}.`, `${d.date} imelingana: mauzo ${fmt(d.sales)} = pesa zilizokusanywa ${fmt(collected)} + matumizi, hasara na madeni ${fmt(recorded)}.`))] };
  const others = days.filter((x) => x.date !== d.date).slice(0, 14);
  const avgGap = others.length ? others.reduce((s, x) => s + Math.abs(x.gap), 0) / others.length : 0;
  const top = data.rows.filter((r) => r.date === d.date).sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  const short = d.gap < 0;
  const list = [
    { title: T('Expected from stock', 'Inayotakiwa kutoka stock'), detail: fmt(d.sales), tone: 'neutral' as const },
    { title: T('Money collected', 'Pesa zilizokusanywa'), detail: `${fmt(collected)} (cash ${fmt(d.cash)}, mobile ${fmt(d.mobile)}, bank ${fmt(d.bank + d.toBank)})`, tone: 'neutral' as const },
    { title: T('Expenses, losses, debts', 'Matumizi, hasara, madeni'), detail: fmt(recorded), tone: 'neutral' as const },
    { title: short ? T('Missing', 'Zinazokosekana') : T('Extra', 'Ziada'), detail: fmt(Math.abs(d.gap)), tone: short ? 'bad' as const : 'warn' as const },
  ];
  const tips: string[] = short
    ? [T('Check the counts of the biggest sellers that night — a miscount of one crate shows up here.', 'Hakiki hesabu za bidhaa zilizouza zaidi usiku huo — kosa la kreti moja linaonekana hapa.'),
       T('Check for a mobile-money or bank payment not entered, or an expense paid in cash but not recorded.', 'Angalia malipo ya mobile au bank ambayo hayakuandikwa, au matumizi yaliyolipwa kwa cash bila kuandikwa.')]
    : [T('Over usually means a count too high or a price changed — check the counts and prices of the top sellers.', 'Ziada mara nyingi ni hesabu kubwa kupita kiasi au bei iliyobadilika — hakiki hesabu na bei za zinazouza zaidi.')];
  if (avgGap > 0) tips.push(Math.abs(d.gap) > avgGap * 2
    ? T(`This is well above the usual gap (about ${fmt(avgGap)}).`, `Hii ni kubwa kuliko kawaida (kawaida ni ${fmt(avgGap)} hivi).`)
    : T(`It is within the usual range (about ${fmt(avgGap)}).`, `Iko ndani ya kawaida (${fmt(avgGap)} hivi).`));
  if (d.by) tips.push(T(`Counted by ${d.by}.`, `Imehesabiwa na ${d.by}.`));
  if (top.length) tips.push(T(`Top sellers that night: ${top.map((r) => `${r.name} (${r.sold})`).join(', ')}.`, `Zilizouza zaidi usiku huo: ${top.map((r) => `${r.name} (${r.sold})`).join(', ')}.`));
  return { blocks: [txt(T(`${d.date} was ${short ? 'short' : 'over'} by ${fmt(Math.abs(d.gap))}.`, `${d.date} ilikuwa ${short ? 'pungufu' : 'na ziada'} ya ${fmt(Math.abs(d.gap))}.`)), { kind: 'list', items: list }, ...splitBlock([d], fmt, sw), txt(tips.map((t) => `• ${t}`).join('\n'))] };
}

function compare(a: Day[], b: Day[], la: string, lb: string, data: BrainData, sw: boolean): AiAnswer {
  const { fmt } = data;
  const T = (en: string, s: string) => (sw ? s : en);
  const sum = (ds: Day[], f: (d: Day) => number) => ds.reduce((s, d) => s + f(d), 0);
  const delta = (x: number, y: number) => (y > 0 ? `${x >= y ? '+' : '−'}${Math.abs(Math.round(((x - y) / y) * 100))}%` : undefined);
  const sa = sum(a, (d) => d.sales), sb = sum(b, (d) => d.sales), pa = sum(a, (d) => d.profit), pb = sum(b, (d) => d.profit);
  if (!a.length && !b.length) return { blocks: [txt(T('No verified closings in either period.', 'Hakuna closing iliyo verified katika vipindi vyote viwili.'))] };
  // Products that moved the most between the two periods.
  const units = (from: string, to: string) => {
    const m = new Map<string, number>();
    for (const r of data.rows.filter((x) => x.date >= from && x.date <= to)) m.set(r.name, (m.get(r.name) || 0) + r.sold);
    return m;
  };
  const ua = a.length ? units(a[a.length - 1].date, a[0].date) : new Map(), ub = b.length ? units(b[b.length - 1].date, b[0].date) : new Map();
  const movers = [...new Set([...ua.keys(), ...ub.keys()])].map((n) => ({ n, d: (ua.get(n) || 0) - (ub.get(n) || 0) })).filter((x) => x.d !== 0).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 4);
  return { blocks: [
    txt(T(`${la} vs ${lb}`, `${la} dhidi ya ${lb}`)),
    { kind: 'kpis', items: [
      { label: T(`Sales ${la}`, `Mauzo ${la}`), value: fmt(sa), delta: delta(sa, sb), tone: sa >= sb ? 'good' : 'bad' },
      { label: T(`Sales ${lb}`, `Mauzo ${lb}`), value: fmt(sb) },
      { label: T(`Profit ${la}`, `Faida ${la}`), value: fmt(pa), delta: delta(pa, pb), tone: pa >= pb ? 'good' : 'bad' },
      { label: T('Closings', 'Closing'), value: `${a.length} / ${b.length}` },
    ] },
    ...splitBlock(a, fmt, sw),
    ...(movers.length ? [{ kind: 'list' as const, title: T('Biggest changes', 'Mabadiliko makubwa'), items: movers.map((m) => ({ title: m.n, detail: `${m.d > 0 ? '+' : ''}${Math.round(m.d * 10) / 10} ${T('units', 'vipande')}`, tone: m.d > 0 ? 'good' as const : 'bad' as const })) }] : []),
  ] };
}

/** Nothing matched a rule: answer from the facts that match the question best. */
function search(p: Parsed, data: BrainData, sw: boolean): AiAnswer {
  const days = daysOf(data.sessions);
  const index = new Index(buildDocs(data, days));
  const q = [...p.words.filter((w) => !STOP.has(w)).map((w) => WORDS[w] || w), ...p.concepts];
  const hits = index.search(q, 4);
  const T = (en: string, s: string) => (sw ? s : en);
  if (!hits.length) {
    return { blocks: [txt(T('I could not find that in your records. Try asking about sales, profit, stock, a product, a day, who owes, or what to order.', 'Sijapata hilo kwenye rekodi zako. Jaribu kuuliza kuhusu mauzo, faida, stock, bidhaa, siku fulani, nani anadaiwa, au ninunue nini.'))] };
  }
  return { blocks: [txt(T('Here is what your records say:', 'Hiki ndicho rekodi zako zinasema:')), { kind: 'list', items: hits.map((h) => ({ title: sw ? h.text.sw : h.text.en, detail: '', tone: 'neutral' as const })) }] };
}
