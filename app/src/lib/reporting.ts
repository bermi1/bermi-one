// Report aggregation. A report is the verified closings and nothing else:
// sales and profit exactly as each closing froze them, the money it recorded
// (cash, mobile, bank, amount to bank) and what was paid out inside it
// (expenses, losses, staff debt). Cash-book entries made outside a closing are
// not part of it, and a day with no verified closing has no row at all — so
// there is nothing to carry over from a day that was never closed.

import type { Business, LedgerEntry, StockSession } from './types';

export interface DayRow {
  date: string;
  sales: number;
  profit: number;
  cash: number;
  mobile: number;
  /** Money received straight into the bank at the closing. */
  bankIn: number;
  /** "Amount to bank" entered at the closing. */
  banked: number;
  sessionExpenses: number;
  staffDebts: number;
  losses: number;
  /** Sales the closing's money does not cover: positive is short, negative is over. */
  balance: number;
}

export type ReportTotals = Omit<DayRow, 'date'>;

export interface NamedAmount {
  label: string;
  amount: number;
}

export interface ReportData {
  businesses: Business[];
  days: DayRow[];
  totals: ReportTotals;
  lossBreakdown: NamedAmount[];
  expenseBreakdown: NamedAmount[];
  from: string;
  to: string;
}

const ZERO: ReportTotals = {
  sales: 0, profit: 0, cash: 0, mobile: 0, bankIn: 0, banked: 0,
  sessionExpenses: 0, staffDebts: 0, losses: 0, balance: 0,
};

export type PresetId = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'custom';

export function presetRange(preset: PresetId): { from: string; to: string } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  switch (preset) {
    case 'today':
      return { from: iso(today), to: iso(today) };
    case 'yesterday': {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return { from: iso(d), to: iso(d) };
    }
    case 'last7': {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return { from: iso(d), to: iso(today) };
    }
    case 'last30': {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      return { from: iso(d), to: iso(today) };
    }
    case 'thisMonth': {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: iso(d), to: iso(today) };
    }
    default:
      return { from: iso(today), to: iso(today) };
  }
}

/** Money a closing recorded — every figure entered as its own line, treated the same way. */
export function collectedOf(t: Pick<ReportTotals, 'cash' | 'mobile' | 'bankIn' | 'banked'>): number {
  return t.cash + t.mobile + t.bankIn + t.banked;
}

export function buildReport(input: {
  businesses: Business[];
  sessions: StockSession[];
  /** Accepted for older callers; a report is built from closings only. */
  ledger?: LedgerEntry[];
  from: string;
  to: string;
}): ReportData {
  const { businesses, sessions, from, to } = input;
  const byDate = new Map<string, DayRow>();
  const lossTally = new Map<string, number>();
  const expenseTally = new Map<string, number>();

  const row = (date: string): DayRow => {
    let r = byDate.get(date);
    if (!r) { r = { date, ...ZERO }; byDate.set(date, r); }
    return r;
  };

  // Only verified days count — a draft or a day still waiting on the owner is
  // not yet a fact about the business. Each is filed under its own day.
  for (const s of sessions) {
    if (s.status !== 'verified') continue;
    if (s.session_date < from || s.session_date > to) continue;
    const r = row(s.session_date);
    r.sales += Number(s.total_calculated_sales || 0);
    r.profit += Number(s.total_calculated_profit || 0);
    r.cash += Number(s.cash || 0);
    r.mobile += Number(s.mobile || 0);
    r.bankIn += Number(s.bank_in || 0);
    r.banked += Number(s.amount_to_bank || 0);
    for (const item of s.closing_items || []) {
      const amount = Number(item.amount || 0);
      if (item.kind === 'expense') {
        r.sessionExpenses += amount;
        const key = item.note?.trim() || 'Expense';
        expenseTally.set(key, (expenseTally.get(key) || 0) + amount);
      } else if (item.kind === 'loss') {
        r.losses += amount;
        const key = item.note?.trim() || 'Loss';
        lossTally.set(key, (lossTally.get(key) || 0) + amount);
      } else {
        r.staffDebts += amount;
      }
    }
  }

  const days = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  // Short / over, exactly as the closing itself works it out.
  for (const d of days) d.balance = d.sales - (collectedOf(d) + d.sessionExpenses + d.losses + d.staffDebts);

  const totals = days.reduce<ReportTotals>((acc, d) => {
    const next = { ...acc };
    for (const k of Object.keys(ZERO) as (keyof ReportTotals)[]) next[k] = acc[k] + d[k];
    return next;
  }, { ...ZERO });

  const rank = (m: Map<string, number>): NamedAmount[] =>
    Array.from(m, ([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);

  return { businesses, days, totals, lossBreakdown: rank(lossTally), expenseBreakdown: rank(expenseTally), from, to };
}

export interface Highlights {
  bestDay: DayRow | null;
  avgDailyProfit: number;
  profitMargin: number;
}

export function highlightsOf(data: ReportData): Highlights {
  const { days, totals } = data;
  if (days.length === 0) return { bestDay: null, avgDailyProfit: 0, profitMargin: 0 };
  const bestDay = days.reduce((best, d) => (d.sales > best.sales ? d : best), days[0]);
  return {
    bestDay,
    avgDailyProfit: Math.round(totals.profit / days.length),
    profitMargin: totals.sales > 0 ? Math.round((totals.profit / totals.sales) * 100) : 0,
  };
}
