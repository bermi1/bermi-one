// Bermi AI's analyst: questions about sales, trends and buying, answered with
// numbers from the verified closings (analytics.ts) and the reason behind
// every recommendation. Deterministic, like the rest of the assistant: it
// never states a figure it cannot compute, and when there are too few
// closings to say something reliably it says so instead of guessing.

import type { Lang, Product } from '../lib/types';
import {
  addDays, businessTrend, categoryStats, closingDays, forecast, inPeriod, periodFromQuestion,
  productStats, purchasePlan, windowEnding, type Period, type ProductStat, type SaleRow,
} from './analytics';

export type Tone = 'good' | 'bad' | 'warn' | 'neutral';
export type AiBlock =
  | { kind: 'text'; text: string }
  | { kind: 'kpis'; items: { label: string; value: string; delta?: string; tone?: Tone }[] }
  | { kind: 'bars'; title?: string; rows: { label: string; value: number; display: string; note?: string; tone?: Tone }[] }
  | { kind: 'list'; title?: string; items: { title: string; detail: string; tone?: Tone }[] };
export interface AiAnswer { blocks: AiBlock[] }

export interface AnalystCtx {
  rows: SaleRow[];
  products: Product[];
  counts: Record<string, number>;
  lang: Lang;
  fmt: (n: number) => string;
  businessName: string;
}

const MIN_CLOSINGS = 3;

// ---------------------------------------------------------------- wording helpers
const n0 = (n: number) => Math.round(n).toLocaleString('en-US');
const n1 = (n: number) => (Math.abs(n) >= 10 ? n0(n) : (Math.round(n * 10) / 10).toLocaleString('en-US'));
const signed = (p: number) => (!Number.isFinite(p) ? 'new' : `${p >= 0 ? '+' : '−'}${Math.abs(Math.round(p))}%`);
const toneOf = (p: number): Tone => (!Number.isFinite(p) ? 'good' : p >= 5 ? 'good' : p <= -5 ? 'bad' : 'neutral');
const WD = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], sw: ['Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi'] };
const dayLabel = (date: string, lang: Lang) => `${WD[lang][new Date(date + 'T12:00:00Z').getUTCDay()]} ${Number(date.slice(8, 10))}/${Number(date.slice(5, 7))}`;

function latestDate(rows: SaleRow[]): string {
  return rows.length ? rows[rows.length - 1].date : new Date().toISOString().slice(0, 10);
}

function tooThin(ctx: AnalystCtx): AiAnswer | null {
  const n = closingDays(ctx.rows);
  if (n >= MIN_CLOSINGS) return null;
  const sw = ctx.lang === 'sw';
  return {
    blocks: [{
      kind: 'text',
      text: sw
        ? `Nina siku ${n} tu za kufunga zilizothibitishwa. Uchambuzi wa mauzo, mwenendo na mapendekezo ya kununua unahitaji angalau siku ${MIN_CLOSINGS} — na unakuwa sahihi zaidi baada ya wiki mbili. Endelea kufunga kila siku na kuthibitisha, nami nitaanza kuchambua.`
        : `I only have ${n} verified closing${n === 1 ? '' : 's'} so far. Sales rankings, trends and buying advice need at least ${MIN_CLOSINGS}, and they get properly reliable after about two weeks. Keep closing and verifying each day and I'll start analysing.`,
    }],
  };
}

/** One sentence of evidence for a product: share, momentum, sell-outs, cover. */
function evidence(s: ProductStat, ctx: AnalystCtx): string {
  const sw = ctx.lang === 'sw';
  const bits: string[] = [];
  if (s.share >= 0.05) bits.push(sw ? `${Math.round(s.share * 100)}% ya mapato` : `${Math.round(s.share * 100)}% of revenue`);
  if (Number.isFinite(s.trendPct) && Math.abs(s.trendPct) >= 10) bits.push(sw ? `${s.trendPct > 0 ? 'imepanda' : 'imeshuka'} ${Math.abs(Math.round(s.trendPct))}% karibuni` : `${s.trendPct > 0 ? 'up' : 'down'} ${Math.abs(Math.round(s.trendPct))}% lately`);
  if (s.daysSoldOut > 0) bits.push(sw ? `iliisha usiku ${s.daysSoldOut}` : `sold out on ${s.daysSoldOut} night${s.daysSoldOut > 1 ? 's' : ''}`);
  if (Number.isFinite(s.daysCover) && s.daysCover < 3) bits.push(sw ? `zimebaki ${n0(s.onHand)} (~siku ${n1(s.daysCover)})` : `${n0(s.onHand)} left (~${n1(s.daysCover)} days)`);
  return bits.join(' · ');
}

// ---------------------------------------------------------------- answers

function topSellers(ctx: AnalystCtx, period: Period, by: 'units' | 'revenue' | 'profit'): AiAnswer {
  const sw = ctx.lang === 'sw';
  const stats = productStats(ctx.rows, period, ctx.products, ctx.counts).filter((s) => s.units > 0);
  if (!stats.length) return { blocks: [{ kind: 'text', text: sw ? `Hakuna mauzo yaliyorekodiwa kwa ${period.label.sw}.` : `No sales recorded for ${period.label.en}.` }] };
  const ranked = [...stats].sort((a, b) => b[by] - a[by]);
  const top = ranked[0];
  const total = stats.reduce((s, x) => s + x[by], 0);
  const days = closingDays(inPeriod(ctx.rows, period));
  const metric = { units: sw ? 'vipimo' : 'units', revenue: sw ? 'mapato' : 'revenue', profit: sw ? 'faida' : 'profit' }[by];
  const rows = ranked.slice(0, 8).map((s) => ({
    label: s.name,
    value: s[by],
    display: by === 'units' ? `${n0(s.units)} ${s.unit}` : ctx.fmt(s[by]),
    note: by === 'units' ? `${ctx.fmt(s.revenue)} · ${signed(s.trendPct)}` : `${n0(s.units)} ${s.unit} · ${signed(s.trendPct)}`,
    tone: toneOf(s.trendPct),
  }));
  const lead = sw
    ? `${top.name} inaongoza kwa ${metric} — ${by === 'units' ? `${n0(top.units)} ${top.unit}` : ctx.fmt(top[by])}, ${Math.round((top[by] / total) * 100)}% ya jumla kwa ${period.label.sw} (siku ${days} za kufunga). Inauza wastani wa ${n1(top.perDay)} ${top.unit} kwa siku.`
    : `${top.name} leads on ${metric} — ${by === 'units' ? `${n0(top.units)} ${top.unit}` : ctx.fmt(top[by])}, ${Math.round((top[by] / total) * 100)}% of the total over ${period.label.en} (${days} closings). That's ${n1(top.perDay)} ${top.unit} a night on average.`;
  const why: string[] = [];
  const ev = evidence(top, ctx);
  if (ev) why.push(sw ? `Kwa nini inajitokeza: ${ev}.` : `Why it stands out: ${ev}.`);
  const byProfit = [...stats].sort((a, b) => b.profit - a.profit)[0];
  if (by !== 'profit' && byProfit.productId !== top.productId) {
    why.push(sw
      ? `Lakini kwa faida, ${byProfit.name} ndiyo kinara: ${ctx.fmt(byProfit.profit)} (faida ${ctx.fmt(byProfit.profitPerUnit)} kwa kila ${byProfit.unit}).`
      : `On profit, though, ${byProfit.name} wins: ${ctx.fmt(byProfit.profit)} (${ctx.fmt(byProfit.profitPerUnit)} profit per ${byProfit.unit}).`);
  }
  return { blocks: [{ kind: 'text', text: lead }, { kind: 'bars', title: sw ? `Kwa ${metric} · ${period.label.sw}` : `By ${metric} · ${period.label.en}`, rows }, ...(why.length ? [{ kind: 'text' as const, text: why.join('\n') }] : [])] };
}

function slowMovers(ctx: AnalystCtx, period: Period): AiAnswer {
  const sw = ctx.lang === 'sw';
  const stats = productStats(ctx.rows, period, ctx.products, ctx.counts);
  const slow = stats
    .filter((s) => s.onHand > 0 && (s.units === 0 || s.daysCover > 21))
    .sort((a, b) => b.onHand * b.price - a.onHand * a.price)
    .slice(0, 6);
  if (!slow.length) return { blocks: [{ kind: 'text', text: sw ? `Hakuna bidhaa inayokwama — kila bidhaa yenye hisa imeuzwa ndani ya ${period.label.sw}, na hakuna yenye zaidi ya wiki 3 za hisa.` : `Nothing is stuck: everything in stock sold during ${period.label.en}, and nothing holds more than 3 weeks of supply.` }] };
  const tied = slow.reduce((s, x) => s + x.onHand * x.price, 0);
  return {
    blocks: [
      { kind: 'text', text: sw ? `Bidhaa ${slow.length} zinakwenda polepole, zimeshikilia ${ctx.fmt(tied)} (kwa bei ya kuuza) kwenye rafu.` : `${slow.length} product${slow.length > 1 ? 's are' : ' is'} moving slowly, holding ${ctx.fmt(tied)} of stock (at selling price) on the shelf.` },
      {
        kind: 'list',
        items: slow.map((s) => ({
          title: s.name,
          tone: 'warn' as Tone,
          detail: s.units === 0
            ? (sw ? `Haijauzwa hata moja kwa ${period.label.sw}. Zipo ${n0(s.onHand)} ${s.unit} (${ctx.fmt(s.onHand * s.price)}). Usiagize tena; jaribu kuiweka mbele au kupunguza bei.` : `Not one sold in ${period.label.en}. ${n0(s.onHand)} ${s.unit} on the shelf (${ctx.fmt(s.onHand * s.price)}). Don't reorder; give it visibility or a price push.`)
            : (sw ? `Inauza ${n1(s.perDay)} kwa siku; ${n0(s.onHand)} zilizopo zinatosha siku ${n0(s.daysCover)}. Simamisha oda hadi ifike chini ya siku 7.` : `Sells ${n1(s.perDay)} a night; the ${n0(s.onHand)} on hand last ~${n0(s.daysCover)} days. Pause orders until it's under a week of stock.`),
        })),
      },
    ],
  };
}

function trend(ctx: AnalystCtx, period: Period): AiAnswer {
  const sw = ctx.lang === 'sw';
  const tr = businessTrend(ctx.rows, period);
  if (!tr.closings) return { blocks: [{ kind: 'text', text: sw ? `Hakuna kufunga kulikothibitishwa kwa ${period.label.sw}.` : `No verified closings in ${period.label.en}.` }] };
  const ch = tr.changePct;
  const items = [
    { label: sw ? 'Mauzo' : 'Sales', value: ctx.fmt(tr.revenue), delta: Number.isNaN(ch) ? undefined : signed(ch), tone: Number.isNaN(ch) ? undefined : toneOf(ch) },
    { label: sw ? 'Faida' : 'Profit', value: ctx.fmt(tr.profit), delta: tr.prevProfit > 0 ? signed(((tr.profit / tr.closings) / (tr.prevProfit / Math.max(1, closingDays(inPeriod(ctx.rows, windowEnding(addDays(period.from, -1), period.days, period.label))))) - 1) * 100) : undefined },
    { label: sw ? 'Kwa siku' : 'Per night', value: ctx.fmt(tr.perDay) },
    { label: sw ? 'Asilimia ya faida' : 'Margin', value: `${Math.round(tr.margin * 100)}%` },
  ];
  const lines: string[] = [];
  if (!Number.isNaN(ch)) {
    lines.push(sw
      ? `Kwa ${period.label.sw}, wastani wa mauzo kwa usiku ni ${ctx.fmt(tr.perDay)} — ${ch >= 0 ? 'juu' : 'chini'} ${Math.abs(Math.round(ch))}% kuliko kipindi kama hicho kilichotangulia (${ctx.fmt(tr.prevPerDay)}).`
      : `Over ${period.label.en} you averaged ${ctx.fmt(tr.perDay)} a night — ${Math.abs(Math.round(ch))}% ${ch >= 0 ? 'above' : 'below'} the period before (${ctx.fmt(tr.prevPerDay)}).`);
  } else {
    lines.push(sw ? `Wastani wa mauzo kwa usiku ni ${ctx.fmt(tr.perDay)} kwa siku ${tr.closings} za kufunga.` : `You averaged ${ctx.fmt(tr.perDay)} a night across ${tr.closings} closings.`);
  }
  if (!Number.isNaN(tr.weeklyGrowthPct) && Math.abs(tr.weeklyGrowthPct) >= 2) {
    lines.push(sw ? `Mstari wa mwenendo: ${tr.weeklyGrowthPct > 0 ? 'unapanda' : 'unashuka'} takriban ${Math.abs(Math.round(tr.weeklyGrowthPct))}% kwa wiki.` : `The trend line is ${tr.weeklyGrowthPct > 0 ? 'rising' : 'falling'} about ${Math.abs(Math.round(tr.weeklyGrowthPct))}% a week.`);
  }
  const ups = tr.drivers.filter((d) => d.delta > 0).slice(0, 2), downs = tr.drivers.filter((d) => d.delta < 0).slice(0, 2);
  if (ups.length || downs.length) {
    const u = ups.map((d) => `${d.name} (+${ctx.fmt(d.delta)})`).join(', '), d = downs.map((x) => `${x.name} (−${ctx.fmt(-x.delta)})`).join(', ');
    lines.push(sw ? `Kilichosababisha: ${u ? `kilichopanda — ${u}` : ''}${u && d ? '; ' : ''}${d ? `kilichoshuka — ${d}` : ''}.` : `What moved it: ${u ? `up — ${u}` : ''}${u && d ? '; ' : ''}${d ? `down — ${d}` : ''}.`);
  }
  if (tr.bestDay && tr.worstDay && tr.closings >= 3) {
    lines.push(sw ? `Usiku bora: ${dayLabel(tr.bestDay.date, 'sw')} (${ctx.fmt(tr.bestDay.revenue)}). Dhaifu zaidi: ${dayLabel(tr.worstDay.date, 'sw')} (${ctx.fmt(tr.worstDay.revenue)}).` : `Best night: ${dayLabel(tr.bestDay.date, 'en')} (${ctx.fmt(tr.bestDay.revenue)}). Weakest: ${dayLabel(tr.worstDay.date, 'en')} (${ctx.fmt(tr.worstDay.revenue)}).`);
  }
  const wd = tr.weekdays.filter((w) => w.n >= 2);
  const blocks: AiBlock[] = [{ kind: 'kpis', items }, { kind: 'text', text: lines.join('\n') }];
  if (wd.length >= 4) {
    blocks.push({ kind: 'bars', title: sw ? 'Wastani kwa siku ya wiki (siku 90)' : 'Average by weekday (90 days)', rows: wd.map((w) => ({ label: WD[ctx.lang][w.day], value: w.avg, display: ctx.fmt(w.avg), note: sw ? `usiku ${w.n}` : `${w.n} nights` })) });
  }
  return { blocks };
}

function buyPlan(ctx: AnalystCtx, q: string): AiAnswer {
  const sw = ctx.lang === 'sw';
  const latest = latestDate(ctx.rows);
  const period = windowEnding(latest, 28, { en: 'the last 4 weeks', sw: 'wiki 4 zilizopita' });
  const m = q.match(/(\d{1,2})\s*(day|siku)/);
  const cover = m ? Math.max(1, Math.min(30, Number(m[1]))) : /month|mwezi/.test(q) ? 30 : 7;
  const stats = productStats(ctx.rows, period, ctx.products, ctx.counts);
  const plan = purchasePlan(stats, cover);
  if (!plan.length) return { blocks: [{ kind: 'text', text: sw ? `Hisa ulizonazo zinatosha siku ${cover} zijazo kwa kasi ya mauzo ya sasa. Hakuna cha kununua kwa sasa.` : `What's on the shelf covers the next ${cover} days at the current selling pace. Nothing needs buying right now.` }] };
  const totalRev = plan.reduce((s, l) => s + l.expectedRevenue, 0), totalProfit = plan.reduce((s, l) => s + l.expectedProfit, 0);
  const urgentN = plan.filter((l) => l.urgency === 'now').length;
  const items = plan.slice(0, 10).map((l) => {
    const s = l.stat;
    const trendBit = Number.isFinite(s.trendPct) && Math.abs(s.trendPct) >= 10 ? (sw ? `, ${s.trendPct > 0 ? 'inapanda' : 'inashuka'} ${Math.abs(Math.round(s.trendPct))}%` : `, ${s.trendPct > 0 ? 'rising' : 'falling'} ${Math.abs(Math.round(s.trendPct))}%`) : '';
    const outBit = s.daysSoldOut > 0 && s.lostUnits > 0 ? (sw ? ` Iliisha usiku ${s.daysSoldOut} — takriban ${n0(s.lostUnits)} zaidi zingeuzwa (${ctx.fmt(s.lostProfit)} faida iliyopotea).` : ` Sold out ${s.daysSoldOut} night${s.daysSoldOut > 1 ? 's' : ''} — ~${n0(s.lostUnits)} more would have sold (${ctx.fmt(s.lostProfit)} profit missed).`) : '';
    return {
      title: `${s.name} — ${sw ? 'nunua' : 'buy'} ${n0(l.qty)} ${s.unit}`,
      tone: (l.urgency === 'now' ? 'bad' : l.urgency === 'soon' ? 'warn' : 'neutral') as Tone,
      detail: sw
        ? `Inauza ${n1(s.recentPerDay)}/siku${trendBit}. Zipo ${n0(Math.max(0, s.onHand))} (siku ${Number.isFinite(s.daysCover) ? n1(s.daysCover) : '—'}). Lengo la siku ${cover}: ${n0(l.target)} pamoja na akiba ${n0(l.safety)}.${outBit} Faida tarajiwa: ${ctx.fmt(l.expectedProfit)}.`
        : `Sells ${n1(s.recentPerDay)} a night${trendBit}. ${n0(Math.max(0, s.onHand))} on hand (${Number.isFinite(s.daysCover) ? n1(s.daysCover) : '—'} days). ${cover}-day target: ${n0(l.target)} incl. ${n0(l.safety)} safety stock.${outBit} Expected profit: ${ctx.fmt(l.expectedProfit)}.`,
    };
  });
  return {
    blocks: [
      { kind: 'text', text: sw
        ? `Oda ya siku ${cover} zijazo, kulingana na mauzo ya ${period.label.sw}${urgentN ? ` — ${urgentN} ni za haraka (zitaisha ndani ya siku 2)` : ''}:`
        : `Order for the next ${cover} days, based on ${period.label.en} of sales${urgentN ? ` — ${urgentN} urgent (run out within 2 days)` : ''}:` },
      { kind: 'list', items },
      { kind: 'kpis', items: [
        { label: sw ? 'Mauzo tarajiwa' : 'Expected sales', value: ctx.fmt(totalRev) },
        { label: sw ? 'Faida tarajiwa' : 'Expected profit', value: ctx.fmt(totalProfit), tone: 'good' },
      ] },
      { kind: 'text', text: sw ? 'Kiasi kimezungushwa juu. Rekebisha kulingana na kreti/katoni za msambazaji wako.' : "Quantities are rounded up — adjust to your supplier's crate or carton size." },
    ],
  };
}

function growthAdvice(ctx: AnalystCtx): AiAnswer {
  const sw = ctx.lang === 'sw';
  const latest = latestDate(ctx.rows);
  const period = windowEnding(latest, 28, { en: 'the last 4 weeks', sw: 'wiki 4 zilizopita' });
  const stats = productStats(ctx.rows, period, ctx.products, ctx.counts);
  const sellers = stats.filter((s) => s.units > 0);
  const cats = categoryStats(sellers);
  const items: { title: string; detail: string; tone: Tone }[] = [];

  // 1. Winners that keep running out — the cheapest growth there is.
  for (const s of sellers.filter((x) => x.daysSoldOut > 0 && x.lostUnits > 0).sort((a, b) => b.lostProfit - a.lostProfit).slice(0, 2)) {
    const lowLevel = Math.ceil(s.recentPerDay * 3 + 1.28 * s.stdPerDay * Math.sqrt(3));
    items.push({
      tone: 'bad',
      title: sw ? `Ongeza hisa ya ${s.name}` : `Carry more ${s.name}`,
      detail: sw
        ? `Iliisha usiku ${s.daysSoldOut} kati ya ${s.daysObserved}. Takriban ${n0(s.lostUnits)} ${s.unit} zaidi zingeuzwa — ${ctx.fmt(s.lostRevenue)} mauzo, ${ctx.fmt(s.lostProfit)} faida. Weka kiwango cha chini kuwa ${lowLevel} ili isiishe tena.`
        : `It sold out on ${s.daysSoldOut} of ${s.daysObserved} nights. About ${n0(s.lostUnits)} more ${s.unit} would have sold — ${ctx.fmt(s.lostRevenue)} in sales, ${ctx.fmt(s.lostProfit)} profit. Set its low-stock level to ${lowLevel} so it stops running out.`,
    });
  }

  // 2. Add to the strongest category — this is where a new product belongs.
  const grow = cats.filter((c) => c.revenue > 0).sort((a, b) => (b.share * (1 + Math.max(0, b.trendPct) / 100) + b.soldOutDays * 0.02) - (a.share * (1 + Math.max(0, a.trendPct) / 100) + a.soldOutDays * 0.02))[0];
  if (grow) {
    const inCat = sellers.filter((s) => s.cat === grow.cat).sort((a, b) => b.revenue - a.revenue);
    const lead = inCat[0];
    const why: string[] = [];
    why.push(sw ? `${grow.cat} ni ${Math.round(grow.share * 100)}% ya mapato yako` : `${grow.cat} is ${Math.round(grow.share * 100)}% of your revenue`);
    if (Math.abs(grow.trendPct) >= 5) why.push(sw ? `${grow.trendPct > 0 ? 'imepanda' : 'imeshuka'} ${Math.abs(Math.round(grow.trendPct))}%` : `${grow.trendPct > 0 ? 'up' : 'down'} ${Math.abs(Math.round(grow.trendPct))}%`);
    if (grow.soldOutDays > 0) why.push(sw ? `bidhaa zake ziliisha mara ${grow.soldOutDays}` : `its products sold out ${grow.soldOutDays} times`);
    items.push({
      tone: 'good',
      title: sw ? `Ongeza bidhaa mpya kwenye ${grow.cat}` : `Add a new product in ${grow.cat}`,
      detail: sw
        ? `${why.join(', ')} — kuna mahitaji zaidi ya unachobeba. Ongeza chapa/aina moja mpya, karibu na bei ya ${lead ? ctx.fmt(lead.price) : '—'} (kama ${lead?.name || ''}), uanze na kidogo (takriban ${lead ? n0(Math.ceil(lead.recentPerDay * 3)) : '—'}) na uangalie kwa wiki 2.`
        : `${why.join(', ')} — demand is bigger than what you carry. Add one new brand or variant priced near ${lead ? ctx.fmt(lead.price) : '—'} (like ${lead?.name || 'your best seller'}), start small (about ${lead ? n0(Math.ceil(lead.recentPerDay * 3)) : '—'} units) and watch it for two weeks.`,
    });
  }

  // 3. Push what earns the most per unit and is already rising.
  const sortedMargin = [...sellers].sort((a, b) => b.profitPerUnit - a.profitPerUnit);
  const star = sortedMargin.find((s) => (Number.isFinite(s.trendPct) ? s.trendPct > 0 : true) && s.units >= 3);
  if (star) {
    items.push({
      tone: 'good',
      title: sw ? `Isukume ${star.name}` : `Push ${star.name}`,
      detail: sw
        ? `Inaleta ${ctx.fmt(star.profitPerUnit)} faida kwa kila ${star.unit} (${Math.round(star.margin * 100)}%)${Number.isFinite(star.trendPct) ? ` na imepanda ${Math.round(star.trendPct)}%` : ''}. Kila ${star.unit} 10 za ziada kwa wiki = ${ctx.fmt(star.profitPerUnit * 10)} faida. Iweke mahali panapoonekana na hakikisha haiishi.`
        : `It earns ${ctx.fmt(star.profitPerUnit)} profit per ${star.unit} (${Math.round(star.margin * 100)}% margin)${Number.isFinite(star.trendPct) ? ` and is up ${Math.round(star.trendPct)}%` : ''}. Every extra 10 a week is ${ctx.fmt(star.profitPerUnit * 10)} profit. Keep it visible and never out of stock.`,
    });
  }

  // 4. Free up money stuck in slow stock.
  const stuck = stats.filter((s) => s.onHand > 0 && (s.units === 0 || s.daysCover > 28)).sort((a, b) => b.onHand * b.price - a.onHand * a.price)[0];
  if (stuck) {
    items.push({
      tone: 'warn',
      title: sw ? `Acha kuagiza ${stuck.name}` : `Stop reordering ${stuck.name}`,
      detail: sw
        ? `${stuck.units === 0 ? 'Haijauzwa kwa wiki 4' : `Zilizopo zinatosha siku ${n0(stuck.daysCover)}`}; ${ctx.fmt(stuck.onHand * stuck.price)} zimekwama kwenye rafu. Tumia pesa hizo kwenye bidhaa zinazoisha.`
        : `${stuck.units === 0 ? 'No sales in 4 weeks' : `Enough on hand for ${n0(stuck.daysCover)} days`}; ${ctx.fmt(stuck.onHand * stuck.price)} is sitting on the shelf. Put that money into what keeps selling out.`,
    });
  }

  // 5. Too much riding on one product.
  const top = sellers[0];
  if (top && top.share >= 0.45) {
    items.push({
      tone: 'neutral',
      title: sw ? 'Usitegemee bidhaa moja' : "Don't lean on one product",
      detail: sw
        ? `${top.name} ni ${Math.round(top.share * 100)}% ya mapato. Ikiisha au bei ya msambazaji ikipanda, usiku wako wote unaathirika. Panua chaguo karibu nayo.`
        : `${top.name} is ${Math.round(top.share * 100)}% of revenue. If it runs short or the supplier raises its price, the whole night suffers. Widen the choice around it.`,
    });
  }

  if (!items.length) return { blocks: [{ kind: 'text', text: sw ? 'Biashara iko sawa: hakuna kinachoisha, hakuna kilichokwama. Endelea kufunga kila siku ili nione mabadiliko mapema.' : "The business is in balance: nothing keeps running out and nothing is stuck. Keep closing daily so I can spot changes early." }] };
  return {
    blocks: [
      { kind: 'text', text: sw ? `Ushauri kwa ${ctx.businessName}, kutoka ${period.label.sw} za mauzo:` : `Advice for ${ctx.businessName}, from ${period.label.en} of sales:` },
      { kind: 'list', items },
    ],
  };
}

function forecastAnswer(ctx: AnalystCtx): AiAnswer {
  const sw = ctx.lang === 'sw';
  const f = forecast(ctx.rows, latestDate(ctx.rows), 7);
  if (!f.length) return tooThin(ctx) || { blocks: [] };
  const rev = f.reduce((s, d) => s + d.revenue, 0), prof = f.reduce((s, d) => s + d.profit, 0);
  return {
    blocks: [
      { kind: 'kpis', items: [{ label: sw ? 'Mauzo siku 7 zijazo' : 'Next 7 days · sales', value: ctx.fmt(rev) }, { label: sw ? 'Faida' : 'Profit', value: ctx.fmt(prof), tone: 'good' }] },
      { kind: 'bars', title: sw ? 'Makadirio kwa siku' : 'Forecast by day', rows: f.map((d) => ({ label: dayLabel(d.date, ctx.lang), value: d.revenue, display: ctx.fmt(d.revenue) })) },
      { kind: 'text', text: sw ? 'Imekadiriwa kutoka wastani wa wiki 4 zilizopita, ikirekebishwa kwa jinsi kila siku ya wiki huuza (siku 90). Ni makadirio, si ahadi.' : 'Based on your average over the last 4 weeks, adjusted for how each weekday usually sells (90 days). An estimate, not a promise.' },
    ],
  };
}

function weekdayAnswer(ctx: AnalystCtx): AiAnswer {
  const sw = ctx.lang === 'sw';
  const tr = businessTrend(ctx.rows, windowEnding(latestDate(ctx.rows), 90, { en: 'the last 90 days', sw: 'siku 90 zilizopita' }));
  const wd = tr.weekdays.filter((w) => w.n >= 1);
  if (wd.length < 3) return tooThin(ctx) || { blocks: [{ kind: 'text', text: sw ? 'Bado sina siku za kutosha za wiki kulinganisha.' : "I don't have enough different weekdays yet to compare." }] };
  const best = [...wd].sort((a, b) => b.avg - a.avg)[0], worst = [...wd].sort((a, b) => a.avg - b.avg)[0];
  return {
    blocks: [
      { kind: 'bars', title: sw ? 'Wastani wa mauzo kwa siku ya wiki' : 'Average sales by weekday', rows: wd.map((w) => ({ label: WD[ctx.lang][w.day], value: w.avg, display: ctx.fmt(w.avg), note: sw ? `usiku ${w.n}` : `${w.n} nights`, tone: w.day === best.day ? 'good' as Tone : w.day === worst.day ? 'bad' as Tone : undefined })) },
      { kind: 'text', text: sw
        ? `${WD.sw[best.day]} ndiyo siku bora (${ctx.fmt(best.avg)}), mara ${n1(best.avg / Math.max(1, worst.avg))} ya ${WD.sw[worst.day]} (${ctx.fmt(worst.avg)}). Hakikisha hisa imejaa kabla ya ${WD.sw[best.day]}, na tumia ${WD.sw[worst.day]} kwa ofa au kuhesabu hisa.`
        : `${WD.en[best.day]} is your best night (${ctx.fmt(best.avg)}), ${n1(best.avg / Math.max(1, worst.avg))}× ${WD.en[worst.day]} (${ctx.fmt(worst.avg)}). Stock up before ${WD.en[best.day]}, and use ${WD.en[worst.day]} for offers or stock-taking.` },
    ],
  };
}

function categoryAnswer(ctx: AnalystCtx, period: Period): AiAnswer {
  const sw = ctx.lang === 'sw';
  const cats = categoryStats(productStats(ctx.rows, period, ctx.products, ctx.counts).filter((s) => s.units > 0));
  if (!cats.length) return tooThin(ctx) || { blocks: [] };
  return {
    blocks: [
      { kind: 'bars', title: sw ? `Mapato kwa aina · ${period.label.sw}` : `Revenue by category · ${period.label.en}`, rows: cats.map((c) => ({ label: c.cat, value: c.revenue, display: ctx.fmt(c.revenue), note: `${Math.round(c.share * 100)}% · ${signed(c.trendPct)}`, tone: toneOf(c.trendPct) })) },
      { kind: 'text', text: sw
        ? cats.map((c) => `${c.cat}: faida ${ctx.fmt(c.profit)} (${c.revenue > 0 ? Math.round((c.profit / c.revenue) * 100) : 0}%), bidhaa ${c.products}${c.soldOutDays ? `, iliisha mara ${c.soldOutDays}` : ''}.`).join('\n')
        : cats.map((c) => `${c.cat}: ${ctx.fmt(c.profit)} profit (${c.revenue > 0 ? Math.round((c.profit / c.revenue) * 100) : 0}% margin), ${c.products} product${c.products > 1 ? 's' : ''}${c.soldOutDays ? `, sold out ${c.soldOutDays} times` : ''}.`).join('\n') },
    ],
  };
}

function productDeepDive(ctx: AnalystCtx, p: Product, period: Period): AiAnswer {
  const sw = ctx.lang === 'sw';
  const stats = productStats(ctx.rows, period, ctx.products, ctx.counts);
  const s = stats.find((x) => x.productId === p.id);
  if (!s) return { blocks: [{ kind: 'text', text: sw ? `Sina mauzo ya ${p.name} kwa ${period.label.sw}.` : `No sales of ${p.name} recorded in ${period.label.en}.` }] };
  const rank = stats.filter((x) => x.units > 0).findIndex((x) => x.productId === p.id) + 1;
  const plan = purchasePlan([s], 7).find(Boolean);
  const series = inPeriod(ctx.rows, period).filter((r) => r.productId === p.id).slice(-10);
  const blocks: AiBlock[] = [
    { kind: 'kpis', items: [
      { label: sw ? 'Zimeuzwa' : 'Sold', value: `${n0(s.units)} ${s.unit}`, delta: signed(s.trendPct), tone: toneOf(s.trendPct) },
      { label: sw ? 'Mapato' : 'Revenue', value: ctx.fmt(s.revenue) },
      { label: sw ? 'Faida' : 'Profit', value: ctx.fmt(s.profit), tone: 'good' },
      { label: sw ? 'Zilizopo' : 'On hand', value: `${n0(s.onHand)}`, delta: Number.isFinite(s.daysCover) ? (sw ? `siku ${n1(s.daysCover)}` : `${n1(s.daysCover)} days`) : undefined, tone: s.daysCover < 2 ? 'bad' : undefined },
    ] },
    { kind: 'text', text: [
      sw ? `${p.name} ni namba ${rank || '—'} kwa mapato (${Math.round(s.share * 100)}%), inauza ${n1(s.perDay)} kwa usiku na faida ${ctx.fmt(s.profitPerUnit)} kwa kila ${s.unit} (${Math.round(s.margin * 100)}%).`
        : `${p.name} is #${rank || '—'} by revenue (${Math.round(s.share * 100)}% share), selling ${n1(s.perDay)} a night at ${ctx.fmt(s.profitPerUnit)} profit per ${s.unit} (${Math.round(s.margin * 100)}% margin).`,
      Number.isFinite(s.trendPct) && Math.abs(s.trendPct) >= 5 ? (sw ? `Mwenendo: ${s.trendPct > 0 ? 'inapanda' : 'inashuka'} ${Math.abs(Math.round(s.trendPct))}% (nusu ya pili ya kipindi dhidi ya ya kwanza).` : `Trend: ${s.trendPct > 0 ? 'up' : 'down'} ${Math.abs(Math.round(s.trendPct))}% (second half of the period vs the first).`) : '',
      s.daysSoldOut && s.recentPerDay > s.perDay * 1.25 ? (sw ? `Ikiwa ipo kwenye rafu inauza ${n1(s.recentPerDay)} kwa usiku — wastani uko chini kwa sababu ya usiku iliokosekana.` : `When it's actually on the shelf it sells ${n1(s.recentPerDay)} a night — the average is lower only because of the nights it was missing.`) : '',
      s.daysSoldOut && s.lostUnits ? (sw ? `Iliisha usiku ${s.daysSoldOut} — mauzo yaliyopotea ~${ctx.fmt(s.lostRevenue)}.` : `Sold out on ${s.daysSoldOut} night${s.daysSoldOut > 1 ? 's' : ''} — ~${ctx.fmt(s.lostRevenue)} of sales missed.`) : '',
      plan ? (sw ? `Pendekezo: nunua ${n0(plan.qty)} ${s.unit} kufunika siku 7.` : `Recommendation: buy ${n0(plan.qty)} ${s.unit} to cover the next 7 days.`) : (sw ? 'Hisa inatosha wiki ijayo.' : 'Stock is enough for the coming week.'),
    ].filter(Boolean).join('\n') },
  ];
  if (series.length >= 3) blocks.push({ kind: 'bars', title: sw ? 'Usiku wa karibuni' : 'Recent nights', rows: series.map((r) => ({ label: dayLabel(r.date, ctx.lang), value: r.sold, display: `${n0(r.sold)}`, tone: r.closing <= 0 && r.available > 0 ? 'bad' as Tone : undefined, note: r.closing <= 0 && r.available > 0 ? (sw ? 'iliisha' : 'sold out') : undefined })) });
  return { blocks };
}

/** The full picture: numbers, leaders, trend, what to buy, what to change. */
export function fullAnalysis(ctx: AnalystCtx): AiAnswer {
  const thin = tooThin(ctx);
  if (thin) return thin;
  const sw = ctx.lang === 'sw';
  const latest = latestDate(ctx.rows);
  const p30 = windowEnding(latest, 30, { en: 'the last 30 days', sw: 'siku 30 zilizopita' });
  const t = trend(ctx, p30), top = topSellers(ctx, p30, 'revenue'), buy = buyPlan(ctx, ''), adv = growthAdvice(ctx);
  const buyList = buy.blocks.find((b) => b.kind === 'list') as Extract<AiBlock, { kind: 'list' }> | undefined;
  const advList = adv.blocks.find((b) => b.kind === 'list') as Extract<AiBlock, { kind: 'list' }> | undefined;
  return {
    blocks: [
      { kind: 'text', text: sw ? `Uchambuzi kamili wa ${ctx.businessName} · siku 30 zilizopita` : `Full analysis of ${ctx.businessName} · last 30 days` },
      ...t.blocks.filter((b) => b.kind !== 'bars'),
      ...top.blocks.filter((b) => b.kind === 'bars'),
      ...(buyList ? [{ ...buyList, title: sw ? 'Nunua wiki hii' : 'Buy this week', items: buyList.items.slice(0, 4) }] : []),
      ...(advList ? [{ ...advList, title: sw ? 'Hatua za kuchukua' : 'What to do next', items: advList.items.slice(0, 3) }] : []),
    ],
  };
}

/** The opening message: where the business stands, in a glance. */
export function overview(ctx: AnalystCtx): AiAnswer | null {
  if (closingDays(ctx.rows) < MIN_CLOSINGS) return null;
  const sw = ctx.lang === 'sw';
  const latest = latestDate(ctx.rows);
  const p = windowEnding(latest, 30, { en: 'the last 30 days', sw: 'siku 30 zilizopita' });
  const t = trend(ctx, p);
  const stats = productStats(ctx.rows, p, ctx.products, ctx.counts).filter((s) => s.units > 0);
  const plan = purchasePlan(productStats(ctx.rows, windowEnding(latest, 28, p.label), ctx.products, ctx.counts), 7);
  const urgent = plan.filter((l) => l.urgency === 'now');
  const lines = [
    stats[0] ? (sw ? `Inayouza zaidi: ${stats[0].name} (${Math.round(stats[0].share * 100)}% ya mapato).` : `Best seller: ${stats[0].name} (${Math.round(stats[0].share * 100)}% of revenue).`) : '',
    urgent.length ? (sw ? `Nunua sasa: ${urgent.slice(0, 3).map((l) => `${l.stat.name} ×${n0(l.qty)}`).join(', ')}.` : `Buy now: ${urgent.slice(0, 3).map((l) => `${l.stat.name} ×${n0(l.qty)}`).join(', ')}.`) : '',
    sw ? 'Niulize: bidhaa inayouza zaidi, mwenendo, nini cha kununua, nini cha kuongeza, au uchambuzi kamili.' : 'Ask me: what sells most, the trend, what to buy, what to add, or a full analysis.',
  ].filter(Boolean);
  return { blocks: [{ kind: 'text', text: sw ? `${ctx.businessName} · siku 30 zilizopita` : `${ctx.businessName} · last 30 days` }, t.blocks[0], { kind: 'text', text: lines.join('\n') }] };
}

// ---------------------------------------------------------------- routing

/** Answer a sales, trend or buying question — or null if it isn't one. */
export function analyse(question: string, ctx: AnalystCtx, named: Product | null): AiAnswer | null {
  const q = question.toLowerCase();
  const latest = latestDate(ctx.rows);
  const period = periodFromQuestion(q, latest);
  const has = (re: RegExp) => re.test(q);

  const wants = {
    full: has(/(full|complete|whole|entire).*(analys|report|picture|review)|analy[sz]e (my|the) business|business (analysis|review|health)|uchambuzi (kamili|wa biashara)|chambua biashara/),
    buy: has(/\b(buy|order|purchase|restock|re-?order|stock up|supplier)\b|nunu|agiz|\boda\b/),
    add: has(/\b(add|new product|introduce|expand|grow|increase (sales|profit)|improve|advice|advise|recommend|should i)\b|ongez|bidhaa mpya|panua|ushauri|nifanye nini|pendekez|niweke/),
    forecast: has(/forecast|predict|next (week|7 days|month)|expect|projection|tabiri|makadirio|wiki ijayo|kesho/),
    weekday: has(/which day|weekday|day of (the )?week|busiest|best (day|night)s?\b|siku (gani|bora)|siku ya wiki/),
    category: has(/categor|\baina\b|kundi/),
    slow: has(/slow|worst|least|not selling|dead stock|stuck|haiuzwi|polepole|zinazokwama|dhaifu/),
    profitRank: has(/(most|best|highest|top).*(profit|margin)|profitable|faida (kubwa|zaidi)|inaleta faida/),
    top: has(/(best|top|most|highest).*(sell|sold|seller|product|item|drink|popular)|sells? (the )?most|best.?sellers?|popular|inauz\w* zaidi|inayouza|bora zaidi|maarufu|zaidi kuuzwa/),
    trend: has(/trend|growth|growing|doing|perform|going|compare|progress|up or down|this (week|month)|last (week|month)|mwenendo|inaendaje|ukuaji|hali ya biashara|wiki hii|mwezi huu|\b(sales|revenue|profit|mapato|mauzo|faida)\b/),
  };

  // a named product gets the full sales picture only when the question is about how it sells;
  // "price of Konyagi?" or "how many left?" stay with the quick lookup
  const aboutSales = named && !wants.top && !wants.slow && has(/sell|sold|doing|trend|perform|analy|how (is|are|has)|sales|profit|revenue|mauzo|inaendaje|inauza|faida|mwenendo|chambua/);
  if (Object.values(wants).some(Boolean) || aboutSales) {
    const thin = tooThin(ctx);
    if (thin) return thin;
  }
  if (wants.full) return fullAnalysis(ctx);
  if (wants.buy) return buyPlan(ctx, q);
  if (aboutSales && named) return productDeepDive(ctx, named, period);
  if (named && !wants.top && !wants.slow && !wants.buy) return null;
  if (wants.forecast) return forecastAnswer(ctx);
  if (wants.weekday) return weekdayAnswer(ctx);
  if (wants.category) return categoryAnswer(ctx, period);
  if (wants.slow) return slowMovers(ctx, period);
  if (wants.profitRank) return topSellers(ctx, period, 'profit');
  if (wants.top) return topSellers(ctx, period, /revenue|money|mapato|pesa/.test(q) ? 'revenue' : 'units');
  if (wants.add) return growthAdvice(ctx);
  if (wants.trend) return trend(ctx, period);
  return null;
}
