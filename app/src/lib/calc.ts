import type { Product, StockSession } from './types';

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
 * Products bucketed by category, keeping each product's existing sort order
 * within its group and ordering groups by where they first appear. Bar stock
 * sheets are always read category by category, so this is the shape every
 * stock list, closing sheet and printout uses.
 */
export function groupByCategory(products: Product[]): { cat: string; items: Product[] }[] {
  const groups = new Map<string, Product[]>();
  for (const p of products) {
    const key = (p.cat || 'General').trim() || 'General';
    const bucket = groups.get(key);
    if (bucket) bucket.push(p);
    else groups.set(key, [p]);
  }
  return Array.from(groups, ([cat, items]) => ({ cat, items }));
}
