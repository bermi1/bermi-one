import type { Product, SessionLine, StockSession } from './types';

/**
 * Stock can be counted in parts — half a bottle, 2.5 kg. Adding 2.5 and 0.1 in
 * floating point gives 2.6000000000000001, so every quantity sum is rounded
 * back to three places before it is shown or saved.
 */
export const roundQty = (n: number) => Math.round(n * 1000) / 1000;

/** What a quantity box keeps of what was typed: digits and one decimal point (a comma counts as one), three places at most. */
export function cleanQty(raw: string): string {
  const s = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const dot = s.indexOf('.');
  if (dot < 0) return s;
  return s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '').slice(0, 3);
}

/** Units sold for a product, given a closing count from the counts map (undefined = not yet counted). */
export function soldOf(p: Product, counts: Record<string, number>): number {
  const closing = counts[p.id];
  if (closing === undefined || closing === null) return 0;
  return Math.max(0, roundQty(p.opening + p.added - Number(closing)));
}

export function isCounted(counts: Record<string, number>): boolean {
  return Object.keys(counts).length > 0;
}

export function currentQty(p: Product, counts: Record<string, number>): number {
  return roundQty(p.opening + p.added - soldOf(p, counts));
}

export function expectedSales(products: Product[], counts: Record<string, number>): number {
  return products.reduce((s, p) => s + soldOf(p, counts) * p.price, 0);
}

/**
 * Gross profit straight from each product's profit-per-unit. Businesses give
 * us profit per bottle/unit directly in their stock sheet, so this is read,
 * never derived from a cost we don't actually have.
 */
export function profitOf(products: Product[], counts: Record<string, number>): number {
  return products.reduce((s, p) => s + soldOf(p, counts) * p.profit, 0);
}

/** What the stock on hand is worth at selling price. */
export function stockValueOf(products: Product[], counts: Record<string, number>): number {
  return products.reduce((s, p) => s + currentQty(p, counts) * p.price, 0);
}

/**
 * The per-product lines of a closing.
 *
 * A submitted closing carries its own snapshot, and that is what every screen
 * and every printout must read: the quantities and prices as they were on the
 * night. Closings recorded before snapshots existed have none, so those fall
 * back to the live stock — wrong once prices have moved, but the only figures
 * that exist for them.
 */
export function linesOf(session: Pick<StockSession, 'lines'> | null | undefined, products: Product[]): SessionLine[] {
  const frozen = session?.lines;
  if (frozen && frozen.length) return frozen;
  return products.map(snapshotLine);
}

export function snapshotLine(p: Product): SessionLine {
  return {
    id: p.id,
    name: p.name,
    cat: (p.cat || 'General').trim() || 'General',
    unit: p.unit,
    opening: Number(p.opening || 0),
    added: Number(p.added || 0),
    price: Number(p.price || 0),
    profit: Number(p.profit || 0),
  };
}

/** What came in for this line before anything was sold. */
export function availableOf(l: SessionLine): number {
  return roundQty(Number(l.opening || 0) + Number(l.added || 0));
}

/** Units sold on a snapshot line. Uncounted lines sold nothing, not everything. */
export function soldOfLine(l: SessionLine, counts: Record<string, number>): number {
  const closing = counts[l.id];
  if (closing === undefined || closing === null) return 0;
  return Math.max(0, roundQty(availableOf(l) - Number(closing)));
}

export interface SessionTotals {
  opening: number;
  added: number;
  available: number;
  closing: number;
  sold: number;
  sales: number;
  profit: number;
  /** What is left on the shelf, at selling price. */
  stockValue: number;
  counted: number;
}

export function sessionTotals(lines: SessionLine[], counts: Record<string, number>): SessionTotals {
  const t: SessionTotals = { opening: 0, added: 0, available: 0, closing: 0, sold: 0, sales: 0, profit: 0, stockValue: 0, counted: 0 };
  for (const l of lines) {
    const counted = counts[l.id] !== undefined && counts[l.id] !== null;
    const left = counted ? Number(counts[l.id]) : availableOf(l);
    const sold = soldOfLine(l, counts);
    t.opening += Number(l.opening || 0);
    t.added += Number(l.added || 0);
    t.available += availableOf(l);
    t.closing += left;
    t.sold += sold;
    t.sales += sold * l.price;
    t.profit += sold * l.profit;
    t.stockValue += left * l.price;
    if (counted) t.counted += 1;
  }
  for (const k of ['opening', 'added', 'available', 'closing', 'sold'] as const) t[k] = roundQty(t[k]);
  return t;
}

export function closingItemsTotal(session: Pick<StockSession, 'closing_items'>): number {
  return (session.closing_items || []).reduce((s, it) => s + Number(it.amount || 0), 0);
}

type ClosingMoney = Pick<StockSession, 'cash' | 'mobile' | 'bank_in' | 'closing_items'> & { amount_to_bank?: number | null };

/**
 * Everything the closing accounts for: cash, mobile, bank, amount to bank —
 * each entered as its own figure and treated the same way — plus what was
 * paid out that night (expenses, losses, staff debt).
 */
export function moneyReceived(session: ClosingMoney): number {
  return Number(session.cash || 0) + Number(session.mobile || 0) + Number(session.bank_in || 0) + Number(session.amount_to_bank || 0) + closingItemsTotal(session);
}

export function diffOf(products: Product[], counts: Record<string, number>, session: ClosingMoney): number {
  return expectedSales(products, counts) - moneyReceived(session);
}

/*
  Days are Tanzanian days. toISOString() is UTC, three hours behind, so a
  "today" built from it does not move on until 03:00 here — exactly when a bar
  is counting. Every date the closing flow uses comes from these helpers.
*/
const DAY_ZONE = 'Africa/Dar_es_Salaam';

/** The calendar day in East Africa, `offset` days from today, as YYYY-MM-DD. */
export function localDayIso(offset = 0, now: Date = new Date()): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: DAY_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return offset ? addDaysIso(today, offset) : today;
}

/** A YYYY-MM-DD date moved by whole days, with no time zone in the way. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return localDayIso(0);
}

/**
 * The trading day a closing belongs to when nothing says otherwise.
 *
 * A bar counts its stock after the night is over — in practice the next
 * morning — so the count taken now settles *yesterday's* trade. Dating the
 * session to the calendar day it is entered on would file every night under
 * the wrong date and shift every report by one day.
 */
export function businessDayIso(): string {
  return localDayIso(-1);
}

/**
 * The day the next closing is for: the day after the last verified one, since
 * that closing is its opening. Never later than today — a night not yet traded
 * cannot be counted — and yesterday when nothing has been verified yet.
 */
export function nextClosingDay(lastVerified: string | null | undefined, now: Date = new Date()): string {
  const today = localDayIso(0, now);
  if (!lastVerified) return localDayIso(-1, now);
  const next = addDaysIso(lastVerified, 1);
  return next > today ? today : next;
}

/**
 * Products bucketed by category, keeping each product's existing sort order
 * within its group and ordering groups by where they first appear. Bar stock
 * sheets are always read category by category, so this is the shape every
 * stock list, closing sheet and printout uses.
 */
export function groupByCategory<T extends { cat: string }>(products: T[]): { cat: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const p of products) {
    const key = (p.cat || 'General').trim() || 'General';
    const bucket = groups.get(key);
    if (bucket) bucket.push(p);
    else groups.set(key, [p]);
  }
  return Array.from(groups, ([cat, items]) => ({ cat, items }));
}
