// Report aggregation. Verified closings are the source of truth for what a
// day actually was — the ledger is downstream of them — so every figure here
// is built from verified sessions plus the expenses and debts recorded
// against the same dates, then combined across whichever businesses are
// selected.

import type { Business, LedgerEntry, StockSession } from './types';

export interface DayRow {
  date: string;
  sales: number;
  profit: number;
  cash: number;
  mobile: number;
  banked: number;
  sessionExpenses: number;
  sessionPurchases: number;
  otherExpenses: number;
  staffDebts: number;
  losses: number;
  /** What is left unexplained once every recorded outflow is accounted for. */
  balance: number;
}

export interface ReportTotals {
  sales: number;
  profit: number;
  cash: number;
  mobile: number;
  banked: number;
  sessionExpenses: number;
  sessionPurchases: number;
  otherExpenses: number;
  staffDebts: number;
  losses: number;
  balance: number;
}

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
  sales: 0, profit: 0, cash: 0, mobile: 0, banked: 0,
  sessionExpenses: 0, sessionPurchases: 0, otherExpenses: 0, staffDebts: 0, losses: 0, balance: 0,
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

/** Sales/profit for a session, preferring the totals frozen when it was submitted. */
function sessionTotals(s: StockSession): { sales: number; profit: number } {
  return { sales: Number(s.total_calculated_sales || 0), profit: Number(s.total_calculated_profit || 0) };
}

export function buildReport(input: {
  businesses: Business[];
  sessions: StockSession[];
  ledger: LedgerEntry[];
  from: string;
  to: string;
}): ReportData {
  const { businesses, sessions, ledger, from, to } = input;
  const byDate = new Map<string, DayRow>();
  const lossTally = new Map<string, number>();
  const expenseTally = new Map<string, number>();

  const blank = (date: string): DayRow => ({
    date, sales: 0, profit: 0, cash: 0, mobile: 0, banked: 0,
    sessionExpenses: 0, sessionPurchases: 0, otherExpenses: 0, staffDebts: 0, losses: 0, balance: 0,
  });
  const row = (date: string): DayRow => {
    const hit = byDate.get(date);
    if (hit) return hit;
    const made = blank(date);
    byDate.set(date, made);
    return made;
  };

  // Only verified days count towards a report — a draft or a day still waiting
  // on the owner is not yet a fact about the business.
  for (const s of sessions) {
    if (s.status !== 'verified') continue;
    if (s.session_date < from || s.session_date > to) continue;
    const r = row(s.session_date);
    const { sales, profit } = sessionTotals(s);
    r.sales += sales;
    r.profit += profit;
    r.cash += Number(s.cash || 0);
    r.mobile += Number(s.mobile || 0);
    r.banked += Number(s.amount_to_bank || 0);
    for (const item of s.closing_items || []) {
      if (item.kind === 'expense') {
        r.sessionExpenses += item.amount;
        const key = item.note?.trim() || 'Expense';
        expenseTally.set(key, (expenseTally.get(key) || 0) + item.amount);
      } else if (item.kind === 'loss') {
        r.losses += item.amount;
        const key = item.note?.trim() || 'Loss';
        lossTally.set(key, (lossTally.get(key) || 0) + item.amount);
      } else {
        r.staffDebts += item.amount;
      }
    }
  }

  // Money recorded outside the closing flow, on the same days.
  for (const e of ledger) {
    const date = e.created_at.slice(0, 10);
    if (date < from || date > to) continue;
    if (e.kind === 'purchase') {
      row(date).sessionPurchases += Math.abs(e.amount);
    } else if (e.kind === 'expense') {
      const r = row(date);
      r.otherExpenses += Math.abs(e.amount);
      const key = e.label?.trim() || 'Expense';
      expenseTally.set(key, (expenseTally.get(key) || 0) + Math.abs(e.amount));
    } else if (e.kind === 'loss') {
      const r = row(date);
      r.losses += Math.abs(e.amount);
      const key = e.label?.trim() || 'Loss';
      lossTally.set(key, (lossTally.get(key) || 0) + Math.abs(e.amount));
    } else if (e.kind === 'debt') {
      row(date).staffDebts += Math.abs(e.amount);
    }
  }

  const days = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  for (const d of days) {
    /*
      Balance is what the day's sales did NOT turn into something accounted for.
      Amount banked is deliberately absent: it is cash that was already counted
      under `cash`, moved to the bank afterwards. Subtracting both charges the
      same shillings twice and shows a healthy day as short by exactly whatever
      was deposited. It stays in the report as its own column, because knowing
      how much reached the bank matters — it is just not a second outflow.
    */
    d.balance = d.sales - (d.cash + d.mobile + d.sessionExpenses + d.sessionPurchases + d.otherExpenses + d.staffDebts + d.losses);
  }

  const totals = days.reduce<ReportTotals>((acc, d) => ({
    sales: acc.sales + d.sales,
    profit: acc.profit + d.profit,
    cash: acc.cash + d.cash,
    mobile: acc.mobile + d.mobile,
    banked: acc.banked + d.banked,
    sessionExpenses: acc.sessionExpenses + d.sessionExpenses,
    sessionPurchases: acc.sessionPurchases + d.sessionPurchases,
    otherExpenses: acc.otherExpenses + d.otherExpenses,
    staffDebts: acc.staffDebts + d.staffDebts,
    losses: acc.losses + d.losses,
    balance: acc.balance + d.balance,
  }), { ...ZERO });

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
