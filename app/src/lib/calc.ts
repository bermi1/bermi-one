import type { Product, SessionLine, StockSession } from './types';

/** Units sold for a product, given a closing count from the counts map (undefined = not yet counted). */
export function soldOf(p: Product, counts: Record<string, number>): number {
  const closing = counts[p.id];
  if (closing === undefined || closing === null) return 0;
  return Math.max(0, p.opening + p.added - Number(closing));
}

export function isCounted(counts: Record<string, number>): boolean {
  return Object.keys(counts).length > 0;
}

export function currentQty(p: Product, counts: Record<string, number>): number {
  return p.opening + p.added - soldOf(p, counts);
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
  return Number(l.opening || 0) + Number(l.added || 0);
}

/** Units sold on a snapshot line. Uncounted lines sold nothing, not everything. */
export function soldOfLine(l: SessionLine, counts: Record<string, number>): number {
  const closing = counts[l.id];
  if (closing === undefined || closing === null) return 0;
  return Math.max(0, availableOf(l) - Number(closing));
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
  return t;
}

export function closingItemsTotal(session: Pick<StockSession, 'closing_items'>): number {
  return (session.closing_items || []).reduce((s, it) => s + Number(it.amount || 0), 0);
}

export function moneyReceived(session: Pick<StockSession, 'cash' | 'mobile' | 'bank_in' | 'closing_items'>): number {
  return Number(session.cash || 0) + Number(session.mobile || 0) + Number(session.bank_in || 0) + closingItemsTotal(session);
}

export function diffOf(products: Product[], counts: Record<string, number>, session: Pick<StockSession, 'cash' | 'mobile' | 'bank_in' | 'closing_items'>): number {
  return expectedSales(products, counts) - moneyReceived(session);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The trading day a closing belongs to.
 *
 * A bar counts its stock after the night is over — in practice the next
 * morning — so the count taken now settles *yesterday's* trade. Dating the
 * session to the calendar day it is entered on would file every night under
 * the wrong date and shift every report by one day.
 */
export function businessDayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
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
