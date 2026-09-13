import { currentQty } from '../lib/calc';
import type { Accounts, Lang, Product } from '../lib/types';
import type { ActionLogEntry } from './actions';

export type InsightTone = 'warn' | 'info' | 'good';

export interface Insight {
  id: string;
  tone: InsightTone;
  text: string;
}

const TONE_PRIORITY: Record<InsightTone, number> = { warn: 0, info: 1, good: 2 };

/**
 * Reads across the ontology (current stock, cash position, and the action
 * history) to surface what actually needs a decision — not a dashboard of
 * numbers, one or two plain sentences an SME owner can act on immediately.
 */
export function deriveInsights(opts: {
  products: Product[];
  counts: Record<string, number>;
  accounts: Accounts | null;
  actionLog: ActionLogEntry[];
  lang: Lang;
}): Insight[] {
  const { products, counts, accounts, actionLog, lang } = opts;
  const sw = lang === 'sw';
  const out: Insight[] = [];

  // Slow-moving overstock: sitting on 3+ weeks of a product that barely sells.
  let worstSlow: { p: Product; weeks: number } | null = null;
  for (const p of products) {
    if (p.wk <= 0) continue;
    const qty = currentQty(p, counts);
    const weeks = qty / p.wk;
    if (weeks >= 3 && (!worstSlow || weeks > worstSlow.weeks)) worstSlow = { p, weeks };
  }
  if (worstSlow) {
    const w = Math.floor(worstSlow.weeks);
    out.push({
      id: `slow-${worstSlow.p.id}`,
      tone: 'warn',
      text: sw
        ? `${worstSlow.p.name}: una hesabu ya wiki ${w}+ ya mauzo bila kuuzwa. Fikiria kusitisha oda mpya kwa sasa.`
        : `${worstSlow.p.name}: you're holding ${w}+ weeks of unsold stock. Worth pausing reorders on it for now.`,
    });
  }

  // Out of / critically low stock.
  const empty = products.filter((p) => currentQty(p, counts) <= 0);
  const low = products.filter((p) => { const q = currentQty(p, counts); return q > 0 && q < p.low; });
  if (empty.length) {
    out.push({
      id: 'empty',
      tone: 'warn',
      text: sw
        ? `${empty.map((p) => p.name).join(', ')} ${empty.length > 1 ? 'zimeisha' : 'imeisha'}. Agiza upya haraka.`
        : `${empty.map((p) => p.name).join(', ')} ${empty.length > 1 ? 'are' : 'is'} out of stock. Reorder soon.`,
    });
  } else if (low.length) {
    out.push({
      id: 'low',
      tone: 'info',
      text: sw
        ? `Bidhaa ${low.length} zimepungua chini ya kiwango cha kawaida.`
        : `${low.length} product${low.length > 1 ? 's are' : ' is'} running low on stock.`,
    });
  }

  // Repeated returned closings — a process signal, not just a one-off.
  const returns = actionLog.filter((a) => a.action_type === 'session.return').length;
  if (returns >= 2) {
    out.push({
      id: 'returns',
      tone: 'warn',
      text: sw
        ? 'Kufunga kumerudishwa kwa marekebisho zaidi ya mara moja hivi karibuni. Angalia jinsi hesabu ya bidhaa inavyofanyika.'
        : 'Closings have been sent back for correction more than once recently — worth checking how the stock count is being done.',
    });
  }

  // Cash sitting almost entirely in one place.
  if (accounts) {
    const total = accounts.cash + accounts.mobile + accounts.bank;
    if (total > 0) {
      const biggest = Math.max(accounts.cash, accounts.mobile, accounts.bank);
      const share = biggest / total;
      if (share >= 0.85 && accounts.cash === biggest && total > 0) {
        out.push({
          id: 'cash-concentration',
          tone: 'info',
          text: sw
            ? 'Fedha nyingi ziko mkononi (taslimu). Fikiria kuhamisha sehemu benki kwa usalama.'
            : 'Most of your money is sitting in cash on hand. Consider banking some of it for safety.',
        });
      }
    }
  }

  // Positive reinforcement: a clean streak of approvals with no variance reason.
  const recentApprovals = actionLog.filter((a) => a.action_type === 'session.approve');
  const recentReturns = actionLog.filter((a) => a.action_type === 'session.return');
  if (recentApprovals.length >= 3 && recentReturns.length === 0) {
    out.push({
      id: 'clean-streak',
      tone: 'good',
      text: sw
        ? `Siku ${recentApprovals.length} za kufunga zimekamilika bila tatizo. Kazi nzuri.`
        : `${recentApprovals.length} closings in a row have gone through clean. Nice work.`,
    });
  }

  return out.sort((a, b) => TONE_PRIORITY[a.tone] - TONE_PRIORITY[b.tone]);
}

export function topInsight(opts: Parameters<typeof deriveInsights>[0]): Insight | null {
  return deriveInsights(opts)[0] ?? null;
}
