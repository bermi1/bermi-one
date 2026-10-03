// Sales analysis, built from what was actually counted.
//
// A verified closing is a measured fact about one night: for every product,
// what was on the shelf, what was delivered, and what was left. What sold is
// the difference, at the price and profit-per-unit frozen on that closing. Over
// weeks of closings that is a complete sales history per product — the raw
// material for rankings, trends, stock-out losses, forecasts and a purchase
// plan. Nothing here is estimated from a cost we were never given, and every
// figure an answer quotes can be traced back to specific closings.

import { linesOf, soldOfLine, currentQty } from '../lib/calc';
import type { Product, StockSession } from '../lib/types';

export interface SaleRow {
  date: string;
  productId: string;
  name: string;
  cat: string;
  unit: string;
  available: number;
  closing: number;
  sold: number;
  revenue: number;
  profit: number;
}

/** One row per product per verified closing. Uncounted lines are skipped, not treated as zero. */
export function salesHistory(sessions: StockSession[], products: Product[]): SaleRow[] {
  const rows: SaleRow[] = [];
  const verified = sessions.filter((s) => s.status === 'verified').sort((a, b) => a.session_date.localeCompare(b.session_date));
  for (const s of verified) {
    const counts = s.counts || {};
    for (const l of linesOf(s, products)) {
      const c = counts[l.id];
      if (c === undefined || c === null) continue;
      const sold = soldOfLine(l, counts);
      rows.push({
        date: s.session_date,
        productId: l.id,
        name: l.name,
        cat: (l.cat || 'General').trim() || 'General',
        unit: l.unit,
        available: Number(l.opening || 0) + Number(l.added || 0),
        closing: Number(c),
        sold,
        revenue: sold * Number(l.price || 0),
        profit: sold * Number(l.profit || 0),
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------- periods

export interface Period { from: string; to: string; days: number; label: { en: string; sw: string } }

const iso = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00Z').getTime() - new Date(a + 'T12:00:00Z').getTime()) / 86_400_000);
}

/** A window of `days` calendar days ending on `end` (inclusive). */
export function windowEnding(end: string, days: number, label: Period['label']): Period {
  return { from: addDays(end, -(days - 1)), to: end, days, label };
}

/** The period the question is about. Defaults to the last 30 days. */
export function periodFromQuestion(q: string, latest: string): Period {
  const s = q.toLowerCase();
  if (/\b(today|tonight)\b|\bleo\b/.test(s)) return windowEnding(latest, 1, { en: 'the latest closing', sw: 'kufunga kwa mwisho' });
  if (/\byesterday\b|\bjana\b/.test(s)) return windowEnding(addDays(latest, -1), 1, { en: 'yesterday', sw: 'jana' });
  const m = s.match(/(\d{1,3})\s*(day|siku)/) || s.match(/siku\s*(\d{1,3})/);
  if (m) { const n = Math.max(1, Math.min(365, Number(m[1]))); return windowEnding(latest, n, { en: `the last ${n} days`, sw: `siku ${n} zilizopita` }); }
  if (/(this|last|past)\s+week|\bweek(ly)?\b|wiki/.test(s)) return windowEnding(latest, 7, { en: 'the last 7 days', sw: 'siku 7 zilizopita' });
  if (/(quarter|3 months|three months|miezi mitatu|robo)/.test(s)) return windowEnding(latest, 90, { en: 'the last 90 days', sw: 'siku 90 zilizopita' });
  if (/(year|mwaka)/.test(s)) return windowEnding(latest, 365, { en: 'the last 12 months', sw: 'miezi 12 iliyopita' });
  return windowEnding(latest, 30, { en: 'the last 30 days', sw: 'siku 30 zilizopita' });
}

export const inPeriod = (rows: SaleRow[], p: Period) => rows.filter((r) => r.date >= p.from && r.date <= p.to);
export const closingDays = (rows: SaleRow[]) => new Set(rows.map((r) => r.date)).size;

// ---------------------------------------------------------------- statistics

function mean(xs: number[]): number { return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0; }
function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}
/** Least-squares slope of y over x. */
function slope(xs: number[], ys: number[]): number {
  if (xs.length < 3) return 0;
  const mx = mean(xs), my = mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? num / den : 0;
}
const pct = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : now > 0 ? Infinity : 0);

export interface ProductStat {
  productId: string;
  name: string;
  cat: string;
  unit: string;
  units: number;
  revenue: number;
  profit: number;
  /** Share of the period's revenue, 0–1. */
  share: number;
  margin: number;
  /** Units per closing day in the period. */
  perDay: number;
  /** Units per closing day in the second half of the period vs the first half, in %. */
  trendPct: number;
  /** Units per closing day, second half of the period — the demand to plan with. */
  recentPerDay: number;
  stdPerDay: number;
  daysSoldOut: number;
  lostUnits: number;
  lostRevenue: number;
  lostProfit: number;
  onHand: number;
  daysCover: number;
  price: number;
  profitPerUnit: number;
  daysWithSales: number;
  daysObserved: number;
  lastSold: string | null;
}

/** Everything the period says about each product, best sellers first. */
export function productStats(rows: SaleRow[], period: Period, products: Product[], counts: Record<string, number>): ProductStat[] {
  const win = inPeriod(rows, period);
  const nDays = Math.max(1, closingDays(win));
  const totalRevenue = win.reduce((s, r) => s + r.revenue, 0);
  const dates = Array.from(new Set(win.map((r) => r.date))).sort();
  const half = dates[Math.floor(dates.length / 2)] ?? period.to;
  const byId = new Map<string, SaleRow[]>();
  for (const r of win) { const a = byId.get(r.productId); if (a) a.push(r); else byId.set(r.productId, [r]); }

  const ids = new Set<string>([...byId.keys(), ...products.map((p) => p.id)]);
  const out: ProductStat[] = [];
  for (const id of ids) {
    const prod = products.find((p) => p.id === id);
    const rs = byId.get(id) || [];
    if (!prod && rs.length === 0) continue;
    const last = rs[rs.length - 1];
    const units = rs.reduce((s, r) => s + r.sold, 0);
    const revenue = rs.reduce((s, r) => s + r.revenue, 0);
    const profit = rs.reduce((s, r) => s + r.profit, 0);
    // Demand is only fully visible on nights the product never ran out: once the
    // shelf is empty, "sold" is capped by what was there, not by what people
    // wanted. So rates and trends are read from in-stock nights, and every
    // night that ended empty (including nights that started empty) is a night
    // of lost sales.
    const inStock = (r: SaleRow) => r.closing > 0;
    const soldOut = rs.filter((r) => !inStock(r));
    const normal = rs.filter(inStock);
    const rateOf = (xs: SaleRow[]) => (xs.length ? mean(xs.map((r) => r.sold)) : NaN);
    const normalRate = normal.length ? rateOf(normal) : mean(rs.map((r) => r.sold));
    const early = rs.filter((r) => r.date < half), late = rs.filter((r) => r.date >= half);
    const earlyRate = Number.isNaN(rateOf(early.filter(inStock))) ? rateOf(early) || 0 : rateOf(early.filter(inStock));
    const lateRate = Number.isNaN(rateOf(late.filter(inStock))) ? rateOf(late) || 0 : rateOf(late.filter(inStock));
    const lostUnits = soldOut.reduce((s, r) => s + Math.max(0, normalRate - r.sold), 0);
    const price = prod ? prod.price : last ? last.revenue / Math.max(1, last.sold) : 0;
    const ppu = prod ? prod.profit : last ? last.profit / Math.max(1, last.sold) : 0;
    const onHand = prod ? currentQty(prod, counts) : last ? last.closing : 0;
    const perDay = units / nDays;
    const planRate = Math.max(lateRate, normalRate * 0.5);
    out.push({
      productId: id,
      name: prod?.name || last?.name || '—',
      cat: (prod?.cat || last?.cat || 'General').trim() || 'General',
      unit: prod?.unit || last?.unit || '',
      units, revenue, profit,
      share: totalRevenue > 0 ? revenue / totalRevenue : 0,
      margin: revenue > 0 ? profit / revenue : prod && prod.price > 0 ? prod.profit / prod.price : 0,
      perDay,
      trendPct: earlyRate > 0 ? pct(lateRate, earlyRate) : lateRate > 0 ? Infinity : 0,
      recentPerDay: planRate,
      stdPerDay: std((normal.length >= 3 ? normal : rs).map((r) => r.sold)),
      daysSoldOut: soldOut.length,
      lostUnits: Math.round(lostUnits),
      lostRevenue: Math.round(lostUnits * price),
      lostProfit: Math.round(lostUnits * ppu),
      onHand,
      daysCover: planRate > 0 ? onHand / planRate : Infinity,
      price,
      profitPerUnit: ppu,
      daysWithSales: rs.filter((r) => r.sold > 0).length,
      daysObserved: rs.length,
      lastSold: [...rs].reverse().find((r) => r.sold > 0)?.date ?? null,
    });
  }
  return out.sort((a, b) => b.revenue - a.revenue || b.units - a.units);
}

// ---------------------------------------------------------------- the business as a whole

export interface DayTotal { date: string; revenue: number; profit: number; units: number }

export function dailyTotals(rows: SaleRow[]): DayTotal[] {
  const m = new Map<string, DayTotal>();
  for (const r of rows) {
    const d = m.get(r.date) || { date: r.date, revenue: 0, profit: 0, units: 0 };
    d.revenue += r.revenue; d.profit += r.profit; d.units += r.sold;
    m.set(r.date, d);
  }
  return Array.from(m.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export interface Trend {
  period: Period;
  revenue: number;
  profit: number;
  margin: number;
  closings: number;
  perDay: number;
  /** Same-length window just before this one. */
  prevRevenue: number;
  prevProfit: number;
  prevPerDay: number;
  changePct: number;
  /** Fitted daily-revenue slope, as % of the average day per week. */
  weeklyGrowthPct: number;
  bestDay: DayTotal | null;
  worstDay: DayTotal | null;
  weekdays: { day: number; avg: number; n: number }[];
  /** Products that moved revenue the most between the two windows. */
  drivers: { name: string; delta: number }[];
}

export function businessTrend(rows: SaleRow[], period: Period): Trend {
  const prev = windowEnding(addDays(period.from, -1), period.days, period.label);
  const now = inPeriod(rows, period), before = inPeriod(rows, prev);
  const days = dailyTotals(now), pdays = dailyTotals(before);
  const revenue = days.reduce((s, d) => s + d.revenue, 0), profit = days.reduce((s, d) => s + d.profit, 0);
  const prevRevenue = pdays.reduce((s, d) => s + d.revenue, 0), prevProfit = pdays.reduce((s, d) => s + d.profit, 0);
  const perDay = days.length ? revenue / days.length : 0;
  const prevPerDay = pdays.length ? prevRevenue / pdays.length : 0;
  const x = days.map((d) => daysBetween(period.from, d.date)), y = days.map((d) => d.revenue);
  const s = slope(x, y);
  const weekly = perDay > 0 ? (s * 7 / perDay) * 100 : 0;
  const wd = new Map<number, number[]>();
  for (const d of dailyTotals(rows.filter((r) => r.date >= addDays(period.to, -90) && r.date <= period.to))) {
    const k = new Date(d.date + 'T12:00:00Z').getUTCDay();
    (wd.get(k) || wd.set(k, []).get(k)!).push(d.revenue);
  }
  const byProd = (rs: SaleRow[]) => { const m = new Map<string, number>(); for (const r of rs) m.set(r.name, (m.get(r.name) || 0) + r.revenue); return m; };
  const a = byProd(now), b = byProd(before);
  const names = new Set([...a.keys(), ...b.keys()]);
  // compare at the same pace: per closing day, so a window with fewer closings isn't "down"
  const nNow = Math.max(1, days.length), nBefore = Math.max(1, pdays.length);
  const drivers = Array.from(names).map((n) => ({ name: n, delta: ((a.get(n) || 0) / nNow - (b.get(n) || 0) / nBefore) * nNow }))
    .sort((p, q) => Math.abs(q.delta) - Math.abs(p.delta)).slice(0, 4);
  return {
    period, revenue, profit, margin: revenue > 0 ? profit / revenue : 0, closings: days.length, perDay,
    prevRevenue, prevProfit, prevPerDay,
    changePct: pdays.length ? pct(perDay, prevPerDay) : NaN,
    weeklyGrowthPct: days.length >= 14 ? weekly : NaN,
    bestDay: days.length ? days.reduce((m, d) => (d.revenue > m.revenue ? d : m), days[0]) : null,
    worstDay: days.length ? days.reduce((m, d) => (d.revenue < m.revenue ? d : m), days[0]) : null,
    weekdays: Array.from(wd, ([day, xs]) => ({ day, avg: mean(xs), n: xs.length })).sort((p, q) => p.day - q.day),
    drivers,
  };
}

/** Next `n` days of sales: recent average per closing day, shaped by weekday. */
export function forecast(rows: SaleRow[], latest: string, n = 7): { date: string; revenue: number; profit: number }[] {
  const recent = dailyTotals(rows.filter((r) => r.date > addDays(latest, -28) && r.date <= latest));
  if (!recent.length) return [];
  const avgRev = mean(recent.map((d) => d.revenue)), avgProfit = mean(recent.map((d) => d.profit));
  const wd = new Map<number, number[]>();
  for (const d of dailyTotals(rows.filter((r) => r.date > addDays(latest, -91) && r.date <= latest))) {
    const k = new Date(d.date + 'T12:00:00Z').getUTCDay();
    (wd.get(k) || wd.set(k, []).get(k)!).push(d.revenue);
  }
  const all = mean(Array.from(wd.values()).flat());
  const out = [];
  for (let i = 1; i <= n; i++) {
    const date = addDays(latest, i);
    const k = new Date(date + 'T12:00:00Z').getUTCDay();
    const xs = wd.get(k) || [];
    // a weekday needs at least 2 observations before it is allowed to bend the line
    const factor = xs.length >= 2 && all > 0 ? mean(xs) / all : 1;
    out.push({ date, revenue: avgRev * factor, profit: avgProfit * factor });
  }
  return out;
}

// ---------------------------------------------------------------- what to buy

export interface OrderLine {
  stat: ProductStat;
  qty: number;
  /** Demand over the cover window plus safety stock. */
  target: number;
  safety: number;
  urgency: 'now' | 'soon' | 'ok';
  expectedRevenue: number;
  expectedProfit: number;
}

/**
 * How much of each product to buy to cover the next `coverDays` closings.
 * Demand is the recent selling rate (the second half of the window), with
 * safety stock sized from how much daily sales actually vary (≈90% service).
 * Products that keep selling out get their lost demand added back, because a
 * shelf that empties at 10 pm under-reports what people wanted.
 */
export function purchasePlan(stats: ProductStat[], coverDays = 7, leadDays = 1): OrderLine[] {
  const z = 1.28;
  const lines: OrderLine[] = [];
  for (const s of stats) {
    if (s.recentPerDay <= 0) continue;
    const horizon = coverDays + leadDays;
    const lostPerDay = s.daysObserved ? s.lostUnits / s.daysObserved : 0;
    const demand = (s.recentPerDay + lostPerDay) * horizon;
    const safety = z * s.stdPerDay * Math.sqrt(horizon);
    const target = Math.ceil(demand + safety);
    const qty = Math.max(0, target - Math.max(0, s.onHand));
    if (qty <= 0) continue;
    const urgency = s.daysCover <= leadDays + 1 ? 'now' : s.daysCover <= coverDays * 0.6 ? 'soon' : 'ok';
    lines.push({ stat: s, qty, target, safety: Math.round(safety), urgency, expectedRevenue: qty * s.price, expectedProfit: qty * s.profitPerUnit });
  }
  const rank = { now: 0, soon: 1, ok: 2 } as const;
  return lines.sort((a, b) => rank[a.urgency] - rank[b.urgency] || b.expectedProfit - a.expectedProfit);
}

// ---------------------------------------------------------------- categories

export interface CategoryStat { cat: string; revenue: number; profit: number; units: number; share: number; trendPct: number; products: number; soldOutDays: number }

export function categoryStats(stats: ProductStat[]): CategoryStat[] {
  const m = new Map<string, CategoryStat & { early: number; late: number }>();
  const total = stats.reduce((s, p) => s + p.revenue, 0);
  for (const p of stats) {
    const c = m.get(p.cat) || { cat: p.cat, revenue: 0, profit: 0, units: 0, share: 0, trendPct: 0, products: 0, soldOutDays: 0, early: 0, late: 0 };
    c.revenue += p.revenue; c.profit += p.profit; c.units += p.units; c.products += 1; c.soldOutDays += p.daysSoldOut;
    // weight each product's trend by its revenue
    if (Number.isFinite(p.trendPct)) { c.early += p.revenue; c.late += p.revenue * (1 + p.trendPct / 100); }
    m.set(p.cat, c);
  }
  return Array.from(m.values()).map(({ early, late, ...c }) => ({ ...c, share: total > 0 ? c.revenue / total : 0, trendPct: early > 0 ? pct(late, early) : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}
