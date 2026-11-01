/*
  Reading several businesses as one. The owner picks businesses on the AI page;
  their verified closings are merged day by day so every answer (sales, profit,
  debts, what to order, compare) is the total, and each day keeps the split per
  business so answers can show it. Products are matched by name: "Kilimanjaro"
  in two bars is one product with both shelves added together.
*/
import type { Accounts, LedgerEntry, Product, SessionLine, StockSession } from '../lib/types';
import { linesOf } from '../lib/calc';

export interface DayPart { business: string; sales: number; profit: number; gap: number }

const key = (name: string) => `n:${name.trim().toLowerCase().replace(/\s+/g, ' ')}`;
const num = (v: unknown) => Number(v || 0);

/** One gap per closing, the same sum the closing screen uses. */
export function gapOf(s: StockSession): number {
  const items = (s.closing_items || []).reduce((t, i) => t + num(i.amount), 0);
  return num(s.cash) + num(s.mobile) + num(s.bank_in) + num(s.amount_to_bank) + items - num(s.total_calculated_sales);
}

export function combineProducts(byBiz: Record<string, Product[]>): Product[] {
  const out = new Map<string, Product>();
  for (const list of Object.values(byBiz)) for (const p of list) {
    const k = key(p.name);
    const m = out.get(k);
    if (!m) out.set(k, { ...p, id: k });
    else out.set(k, { ...m, opening: num(m.opening) + num(p.opening), added: num(m.added) + num(p.added), incoming: num(m.incoming) + num(p.incoming), low: num(m.low) + num(p.low) });
  }
  return [...out.values()];
}

/** Verified closings of several businesses → one closing per day, with the split kept in `parts`. */
export function combineSessions(sessions: StockSession[], byBiz: Record<string, Product[]>, names: Record<string, string>): (StockSession & { parts: DayPart[] })[] {
  const byDate = new Map<string, StockSession[]>();
  for (const s of sessions.filter((x) => x.status === 'verified')) byDate.set(s.session_date, [...(byDate.get(s.session_date) || []), s]);
  return [...byDate].map(([date, list]) => {
    const lines = new Map<string, SessionLine>();
    const counts: Record<string, number> = {};
    for (const s of list) {
      const c = s.counts || {};
      for (const l of linesOf(s, byBiz[s.business_id] || [])) {
        const k = key(l.name);
        const avail = num(l.opening) + num(l.added);
        // An uncounted line sold nothing that day: its closing is what was available.
        const closing = c[l.id] === undefined || c[l.id] === null ? avail : num(c[l.id]);
        const m = lines.get(k);
        lines.set(k, m ? { ...m, opening: num(m.opening) + num(l.opening), added: num(m.added) + num(l.added) } : { ...l, id: k });
        counts[k] = (counts[k] || 0) + closing;
      }
    }
    const sum = (f: (s: StockSession) => number) => list.reduce((t, s) => t + f(s), 0);
    const by = [...new Set(list.map((s) => s.submitted_by_name).filter(Boolean))].join(', ');
    return {
      ...list[0],
      id: `combined:${date}`,
      session_date: date,
      lines: [...lines.values()],
      counts,
      total_calculated_sales: sum((s) => num(s.total_calculated_sales)),
      total_calculated_profit: sum((s) => num(s.total_calculated_profit)),
      cash: sum((s) => num(s.cash)), mobile: sum((s) => num(s.mobile)), bank_in: sum((s) => num(s.bank_in)), amount_to_bank: sum((s) => num(s.amount_to_bank)),
      closing_items: list.flatMap((s) => s.closing_items || []),
      submitted_by_name: by || null,
      parts: list.map((s) => ({ business: names[s.business_id] || '—', sales: num(s.total_calculated_sales), profit: num(s.total_calculated_profit), gap: gapOf(s) })),
    } as StockSession & { parts: DayPart[] };
  });
}

export function combineAccounts(rows: Accounts[]): Accounts | null {
  if (!rows.length) return null;
  return rows.reduce((a, r) => ({ ...a, cash: num(a.cash) + num(r.cash), mobile: num(a.mobile) + num(r.mobile), bank: num(a.bank) + num(r.bank) }));
}

/** Stock movements, named by business when there are several. */
export function labelLedger(ledger: LedgerEntry[], names: Record<string, string>, several: boolean): LedgerEntry[] {
  const sorted = [...ledger].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return several ? sorted.map((l) => ({ ...l, label: `${names[l.business_id] || ''}: ${l.label}` })) : sorted;
}
