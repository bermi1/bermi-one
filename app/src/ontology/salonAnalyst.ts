// Bermi AI for a barbershop: the same contract as analyst.ts — numbers from
// paid visits, a reason behind every recommendation, and "not enough data yet"
// instead of a guess. Visits are the ground truth: what was done, by whom, at
// what price, when.

import type { Lang } from '../lib/types';
import type { AiAnswer, AiBlock, Tone } from './analyst';
import {
  barberLeaderboard, daysSince, hourHeatmap, returningRate, serviceMix, winBack,
  type SalonAppointment, type SalonClient, type SalonService, type SalonVisit,
} from '../lib/salon';

export interface SalonAnalystCtx {
  visits: SalonVisit[]; // last 90 days, paid and unpaid
  appts: SalonAppointment[];
  clients: SalonClient[];
  services: SalonService[];
  lang: Lang;
  fmt: (n: number) => string;
  businessName: string;
}

const MIN_VISITS = 10;
const DAY = 86_400_000;
const pct = (p: number) => `${p >= 0 ? '+' : '−'}${Math.abs(Math.round(p * 100))}%`;
const toneOf = (p: number): Tone => (p >= 0.05 ? 'good' : p <= -0.05 ? 'bad' : 'neutral');
const WD_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WD_SW = ['Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi', 'Jumapili'];

function paidIn(visits: SalonVisit[], fromDaysAgo: number, toDaysAgo = 0, now = Date.now()) {
  return visits.filter((v) => {
    if (v.status !== 'paid') return false;
    const t = new Date(v.paid_at || v.created_at).getTime();
    return t >= now - fromDaysAgo * DAY && t < now - toDaysAgo * DAY;
  });
}
const takings = (vs: SalonVisit[]) => vs.reduce((s, v) => s + v.total - v.tip, 0);

function thin(ctx: SalonAnalystCtx): AiAnswer | null {
  const n = ctx.visits.filter((v) => v.status === 'paid').length;
  if (n >= MIN_VISITS) return null;
  const sw = ctx.lang === 'sw';
  return { blocks: [{ kind: 'text', text: sw
    ? `Nina ziara ${n} tu zilizolipwa. Nikiwa na angalau ${MIN_VISITS} nitaanza kulinganisha vinyozi, huduma na saa — na baada ya wiki mbili ushauri unakuwa wa kuaminika.`
    : `I have ${n} paid visit${n === 1 ? '' : 's'} so far. From ${MIN_VISITS} I can start comparing barbers, services and hours — and after two weeks the advice gets properly reliable.` }] };
}

export function salonOverview(ctx: SalonAnalystCtx): AiAnswer | null {
  const t = thin(ctx); if (t) return t;
  const sw = ctx.lang === 'sw';
  const cur = paidIn(ctx.visits, 30); const prev = paidIn(ctx.visits, 60, 30);
  const rev = takings(cur); const prevRev = takings(prev);
  const g = prevRev ? (rev - prevRev) / prevRev : null;
  const avg = cur.length ? rev / cur.length : 0;
  const top = barberLeaderboard(cur)[0]; const svc = serviceMix(cur)[0];
  const blocks: AiBlock[] = [
    { kind: 'kpis', items: [
      { label: sw ? 'Mapato, siku 30' : 'Takings, last 30 days', value: ctx.fmt(rev), delta: g === null ? undefined : pct(g), tone: g === null ? undefined : toneOf(g) },
      { label: sw ? 'Wateja' : 'Clients', value: String(cur.length), delta: prev.length ? pct((cur.length - prev.length) / prev.length) : undefined, tone: prev.length ? toneOf((cur.length - prev.length) / prev.length) : undefined },
      { label: sw ? 'Wastani wa tiketi' : 'Average ticket', value: ctx.fmt(Math.round(avg)) },
      { label: sw ? 'Wanaorudi' : 'Returning clients', value: `${Math.round(returningRate(paidIn(ctx.visits, 90)) * 100)}%` },
    ] },
    { kind: 'text', text: [
      top ? (sw ? `Kinyozi bora: ${top.name} — ${ctx.fmt(top.revenue)} kutoka wateja ${top.clients}.` : `Top barber: ${top.name} — ${ctx.fmt(top.revenue)} from ${top.clients} clients.`) : '',
      svc ? (sw ? `Huduma inayoleta pesa zaidi: ${svc.name} (×${svc.count}, ${ctx.fmt(svc.revenue)}).` : `Biggest earner: ${svc.name} (×${svc.count}, ${ctx.fmt(svc.revenue)}).`) : '',
      sw ? 'Niulize: "kinyozi bora?", "saa zipi ni za polepole?", "bei gani nipandishe?", "wateja gani hawarudi?"' : 'Ask me: "who is my best barber?", "when are we slow?", "what should I charge more for?", "who has stopped coming?"',
    ].filter(Boolean).join('\n') },
  ];
  return { blocks };
}

function barbers(ctx: SalonAnalystCtx): AiAnswer {
  const sw = ctx.lang === 'sw';
  const rows = barberLeaderboard(paidIn(ctx.visits, 30));
  const prev = new Map(barberLeaderboard(paidIn(ctx.visits, 60, 30)).map((r) => [r.name, r.revenue]));
  if (!rows.length) return { blocks: [{ kind: 'text', text: sw ? 'Hakuna mauzo yenye kinyozi siku 30 zilizopita.' : 'No sales with a barber in the last 30 days.' }] };
  const shopAvg = takings(paidIn(ctx.visits, 30)) / Math.max(1, paidIn(ctx.visits, 30).length);
  return { blocks: [
    { kind: 'bars', title: sw ? 'Mapato kwa kinyozi, siku 30' : 'Takings by barber, last 30 days', rows: rows.map((r) => {
      const p = prev.get(r.name); const g = p ? (r.revenue - p) / p : null;
      return { label: r.name, value: r.revenue, display: ctx.fmt(r.revenue), note: `${r.clients} ${sw ? 'wateja' : 'clients'} · ${sw ? 'wastani' : 'avg'} ${ctx.fmt(r.avgTicket)}${g !== null ? ` · ${pct(g)}` : ''}`, tone: g === null ? undefined : toneOf(g) };
    }) },
    { kind: 'list', items: rows.slice(0, 3).map((r) => {
      const upsell = r.avgTicket < shopAvg * 0.85;
      return {
        title: r.name,
        detail: upsell
          ? (sw ? `Tiketi yake (${ctx.fmt(r.avgTicket)}) iko chini ya wastani wa duka (${ctx.fmt(Math.round(shopAvg))}). Mfundishe kupendekeza ndevu au kuosha nywele — ${ctx.fmt(Math.round(shopAvg - r.avgTicket))} zaidi kwa mteja ni ${ctx.fmt(Math.round((shopAvg - r.avgTicket) * r.clients))} kwa mwezi.` : `Average ticket ${ctx.fmt(r.avgTicket)} is below the shop’s ${ctx.fmt(Math.round(shopAvg))}. Coach add-ons (beard, wash): closing that gap is ${ctx.fmt(Math.round((shopAvg - r.avgTicket) * r.clients))} a month at the same client count.`)
          : (sw ? `Wateja ${r.clients}, kamisheni ${ctx.fmt(r.commission)}. Mpe nafasi za saa zenye shughuli.` : `${r.clients} clients, ${ctx.fmt(r.commission)} commission earned. Give them the peak-hour slots.`),
        tone: upsell ? 'warn' as Tone : 'good' as Tone,
      };
    }) },
  ] };
}

function services(ctx: SalonAnalystCtx): AiAnswer {
  const sw = ctx.lang === 'sw';
  const mix = serviceMix(paidIn(ctx.visits, 60));
  if (!mix.length) return { blocks: [{ kind: 'text', text: sw ? 'Bado hakuna huduma zilizouzwa.' : 'No services sold yet.' }] };
  return { blocks: [
    { kind: 'bars', title: sw ? 'Huduma kwa mapato, siku 60' : 'Services by takings, last 60 days', rows: mix.slice(0, 8).map((s) => ({ label: `${s.name} ×${s.count}`, value: s.revenue, display: ctx.fmt(s.revenue), note: s.listPrice && Math.abs(s.avgCharged - s.listPrice) / s.listPrice >= 0.05 ? `${sw ? 'wastani' : 'avg'} ${ctx.fmt(s.avgCharged)} vs ${sw ? 'orodha' : 'list'} ${ctx.fmt(s.listPrice)}` : undefined })) },
  ] };
}

/** Pricing advice from what customers actually pay and how often they buy. */
function pricing(ctx: SalonAnalystCtx): AiAnswer {
  const sw = ctx.lang === 'sw';
  const mix = serviceMix(paidIn(ctx.visits, 60));
  const items: { title: string; detail: string; tone: Tone }[] = [];
  for (const s of mix) {
    if (s.count < 5 || !s.listPrice) continue;
    const gap = (s.avgCharged - s.listPrice) / s.listPrice;
    if (gap >= 0.08) items.push({ title: sw ? `Pandisha bei ya ${s.name}` : `Raise ${s.name}`, tone: 'good',
      detail: sw ? `Wateja wanalipa wastani ${ctx.fmt(s.avgCharged)} dhidi ya bei ya orodha ${ctx.fmt(s.listPrice)} (${pct(gap)}) kwa ziara ${s.count}. Weka bei mpya ${ctx.fmt(Math.round(s.avgCharged / 500) * 500)} — soko tayari limeikubali.` : `Clients already pay ${ctx.fmt(s.avgCharged)} on average against a list price of ${ctx.fmt(s.listPrice)} (${pct(gap)}) over ${s.count} visits. Set the list to ${ctx.fmt(Math.round(s.avgCharged / 500) * 500)} — the market has accepted it.` });
    else if (gap <= -0.1) items.push({ title: sw ? `${s.name} inauzwa chini ya bei` : `${s.name} is being discounted`, tone: 'warn',
      detail: sw ? `Wastani ${ctx.fmt(s.avgCharged)} dhidi ya ${ctx.fmt(s.listPrice)} (${pct(gap)}). Hiyo ni ${ctx.fmt(Math.round((s.listPrice - s.avgCharged) * s.count))} iliyopotea kwa siku 60. Weka bei moja wazi au punguza bei ya orodha.` : `Charged ${ctx.fmt(s.avgCharged)} on average vs ${ctx.fmt(s.listPrice)} (${pct(gap)}) — ${ctx.fmt(Math.round((s.listPrice - s.avgCharged) * s.count))} given away over 60 days. Hold the list price, or lower it honestly.` });
  }
  const top = mix[0];
  if (top && top.count >= 10 && !items.some((i) => i.title.includes(top.name))) {
    items.push({ title: sw ? `${top.name}: ongeza 10%?` : `${top.name}: test +10%`, tone: 'neutral',
      detail: sw ? `Ndiyo huduma kuu (×${top.count}). Kuongeza 10% kungeleta ~${ctx.fmt(Math.round(top.revenue * 0.1 / 2))} zaidi kwa mwezi hata kama wateja wachache wangepungua.` : `It’s your volume service (×${top.count} in 60 days). +10% is ~${ctx.fmt(Math.round(top.revenue * 0.1 / 2))} more a month even before any add-on sales.` });
  }
  const sold = new Set(mix.map((m) => m.name));
  for (const s of ctx.services.filter((x) => x.active && !sold.has(x.name))) {
    items.push({ title: sw ? `${s.name} haiuzwi` : `${s.name} isn’t selling`, tone: 'warn', detail: sw ? 'Hakuna aliyeinunua siku 60. Ipendekeze kwa wateja wa kawaida au iondoe kwenye orodha.' : 'Nobody bought it in 60 days. Have barbers offer it as an add-on, or take it off the menu.' });
  }
  if (!items.length) items.push({ title: sw ? 'Bei ziko sawa' : 'Prices look right', tone: 'good', detail: sw ? 'Wateja wanalipa karibu na bei ya orodha kwa huduma zote.' : 'Clients pay close to list for every service — no gap to close yet.' });
  return { blocks: [{ kind: 'list', title: sw ? 'Ushauri wa bei' : 'Pricing advice', items }] };
}

function hours(ctx: SalonAnalystCtx): AiAnswer {
  const sw = ctx.lang === 'sw';
  const grid = hourHeatmap(paidIn(ctx.visits, 60));
  const byDay = grid.map((row) => row.reduce((s, n) => s + n, 0));
  const byHour = Array.from({ length: 24 }, (_, h) => grid.reduce((s, row) => s + row[h], 0));
  const open = byHour.map((n, h) => ({ h, n })).filter((x) => x.h >= 8 && x.h <= 20);
  const busy = [...open].sort((a, b) => b.n - a.n).slice(0, 3);
  const slow = [...open].sort((a, b) => a.n - b.n).slice(0, 3);
  const days = byDay.map((n, i) => ({ i, n })).sort((a, b) => b.n - a.n);
  return { blocks: [
    { kind: 'bars', title: sw ? 'Wateja kwa siku ya wiki (siku 60)' : 'Clients by weekday (60 days)', rows: byDay.map((n, i) => ({ label: sw ? WD_SW[i] : WD_EN[i], value: n, display: String(n), tone: i === days[0].i ? 'good' as Tone : i === days[6].i ? 'bad' as Tone : undefined })) },
    { kind: 'list', items: [
      { title: sw ? 'Saa za shughuli nyingi' : 'Peak hours', detail: busy.map((b) => `${b.h}:00`).join(', ') + (sw ? ' — hakikisha vinyozi wote wapo, na usiweke punguzo saa hizi.' : ' — have every chair staffed, and never discount these hours.'), tone: 'good' },
      { title: sw ? 'Saa za polepole' : 'Slow hours', detail: slow.map((b) => `${b.h}:00`).join(', ') + (sw ? ` — weka ofa ya "saa za utulivu" (mfano punguzo 15%) au tuma kiungo cha miadi kwa wateja walioacha kuja.` : ` — run an off-peak offer (e.g. 15% off) or send your booking link to lapsed clients for these times.`), tone: 'warn' },
      { title: sw ? `${WD_SW[days[6].i]} ndiyo siku ya polepole` : `${WD_EN[days[6].i]} is your slowest day`, detail: sw ? `${days[6].n} wateja dhidi ya ${days[0].n} siku ya ${WD_SW[days[0].i]}. Fikiria saa fupi au ofa maalum.` : `${days[6].n} clients against ${days[0].n} on ${WD_EN[days[0].i]}. Consider shorter hours or a standing offer that day.`, tone: 'neutral' },
    ] },
  ] };
}

function retention(ctx: SalonAnalystCtx): AiAnswer {
  const sw = ctx.lang === 'sw';
  const lost = winBack(ctx.clients);
  const value = lost.reduce((s, c) => s + c.total_spent / Math.max(1, c.visits), 0);
  const ret = returningRate(paidIn(ctx.visits, 90));
  const due = ctx.appts.filter((a) => new Date(a.start_at).getTime() < Date.now() && !['cancelled', 'requested'].includes(a.status));
  const ns = due.length ? due.filter((a) => a.status === 'no_show').length / due.length : 0;
  return { blocks: [
    { kind: 'kpis', items: [
      { label: sw ? 'Wanaorudi (siku 90)' : 'Returning (90 days)', value: `${Math.round(ret * 100)}%`, tone: ret >= 0.5 ? 'good' : 'warn' },
      { label: sw ? 'Hawajarudi siku 30+' : 'Lapsed 30+ days', value: String(lost.length), tone: lost.length ? 'warn' : 'good' },
      { label: sw ? 'Hawakuja kwenye miadi' : 'No-show rate', value: `${Math.round(ns * 100)}%`, tone: ns > 0.1 ? 'bad' : 'neutral' },
    ] },
    { kind: 'list', title: sw ? 'Warudishe kwanza' : 'Win these back first', items: lost.slice(0, 6).map((c) => ({
      title: c.name, tone: 'warn' as Tone,
      detail: sw ? `Ziara ${c.visits}, ${ctx.fmt(c.total_spent)} jumla, mara ya mwisho siku ${daysSince(c.last_visit_at)} zilizopita.` : `${c.visits} visits, ${ctx.fmt(c.total_spent)} lifetime, last seen ${daysSince(c.last_visit_at)} days ago.`,
    })).concat(lost.length ? [] : [{ title: sw ? 'Hakuna aliyepotea' : 'No one has lapsed', detail: sw ? 'Wateja wako wa kawaida wote wamekuja ndani ya siku 30.' : 'Every regular has been in within 30 days.', tone: 'good' as Tone }]) },
    ...(lost.length ? [{ kind: 'text' as const, text: sw ? `Kuwarudisha nusu yao ni ~${ctx.fmt(Math.round(value / 2))} kwa ziara moja tu kila mmoja. Fungua Wateja → Warudishe, ugusa WhatsApp.` : `Bringing back half of them is ~${ctx.fmt(Math.round(value / 2))} on one visit each. Open Clients → Win back and tap WhatsApp.` }] : []),
  ] };
}

function trend(ctx: SalonAnalystCtx): AiAnswer {
  const sw = ctx.lang === 'sw';
  const weeks = [0, 1, 2, 3, 4, 5, 6, 7].map((w) => paidIn(ctx.visits, (w + 1) * 7, w * 7)).reverse();
  const rows = weeks.map((vs, i) => ({ label: sw ? `Wiki -${7 - i}` : `${7 - i}w ago`, value: takings(vs), display: ctx.fmt(takings(vs)), note: `${vs.length} ${sw ? 'wateja' : 'clients'}` }));
  rows[rows.length - 1].label = sw ? 'Wiki hii' : 'This week';
  const last4 = weeks.slice(-4).reduce((s, w) => s + takings(w), 0); const prev4 = weeks.slice(0, 4).reduce((s, w) => s + takings(w), 0);
  const g = prev4 ? (last4 - prev4) / prev4 : 0;
  const next = Math.round(weeks.slice(-4).reduce((s, w) => s + takings(w), 0) / 4 * (1 + g / 4));
  return { blocks: [
    { kind: 'bars', title: sw ? 'Mapato kwa wiki' : 'Takings by week', rows },
    { kind: 'text', text: sw
      ? `Wiki 4 za mwisho ${ctx.fmt(last4)} dhidi ya ${ctx.fmt(prev4)} za kabla (${pct(g)}). Kwa mwenendo huu, wiki ijayo ni karibu ${ctx.fmt(next)}.`
      : `Last 4 weeks ${ctx.fmt(last4)} vs ${ctx.fmt(prev4)} the 4 before (${pct(g)}). On this trend next week lands around ${ctx.fmt(next)}.` },
  ] };
}

export function salonFull(ctx: SalonAnalystCtx): AiAnswer {
  const t = thin(ctx); if (t) return t;
  return { blocks: [...(salonOverview(ctx)?.blocks || []), ...barbers(ctx).blocks, ...pricing(ctx).blocks, ...hours(ctx).blocks.slice(1), ...retention(ctx).blocks.slice(1)] };
}

export function salonAnalyse(question: string, ctx: SalonAnalystCtx): AiAnswer | null {
  const q = question.toLowerCase();
  const t = thin(ctx);
  const route: [RegExp, (c: SalonAnalystCtx) => AiAnswer][] = [
    [/full|everything|kamili|yote/, salonFull],
    [/barber|stylist|staff|kinyozi|vinyozi|nani bora|who.*best|best.*(person|worker)/, barbers],
    [/price|pricing|charge|raise|bei|pandisha|ghali/, pricing],
    [/hour|slow|busy|peak|quiet|day|saa|polepole|shughuli|siku gani/, hours],
    [/return|lapsed|stopped|lost|retain|win back|no.?show|hawarudi|warudishe|rudi|wateja gani/, retention],
    [/trend|grow|week|forecast|next|mwenendo|wiki|kukua|ijayo/, trend],
    [/service|sell|popular|cut|huduma|inauza|zaidi/, services],
    [/overview|how.*(doing|business)|summary|habari|muhtasari|biashara/, (c) => salonOverview(c) || services(c)],
  ];
  for (const [re, fn] of route) if (re.test(q)) return t || fn(ctx);
  return null;
}
