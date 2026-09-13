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

export function cogsOf(products: Product[], counts: Record<string, number>): number {
  return products.reduce((s, p) => s + soldOf(p, counts) * p.cost, 0);
}

export function stockValueOf(products: Product[], counts: Record<string, number>): number {
  return products.reduce((s, p) => s + currentQty(p, counts) * p.cost, 0);
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
