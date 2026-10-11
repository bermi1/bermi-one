/*
  The barbershop, as numbers.

  Everything here is pure: no React, no network. The database is the authority
  on what a visit cost and what a barber earned (salon_record_visit computes and
  stores both); these functions are the same arithmetic for the screen to show
  before the visit is saved, and the rollups the reports are built from.
*/

export interface SalonService {
  id: string;
  business_id: string;
  name: string;
  category: string;
  price: number;
  duration_min: number;
  commission_pct: number;
  active: boolean;
  sort_order: number;
}

export interface SalonClient {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  visits: number;
  total_spent: number;
  last_visit_at: string | null;
  created_at: string;
}

/** One service on a ticket. price_charged is what this customer paid, which need not be the list price. */
export interface VisitLine {
  service_id: string | null;
  name: string;
  list_price: number;
  price_charged: number;
  qty: number;
}

export interface SalonVisit {
  id: string;
  business_id: string;
  client_id: string | null;
  client_name: string | null;
  barber_id: string | null;
  barber_name: string | null;
  items: VisitLine[];
  subtotal: number;
  discount: number;
  tip: number;
  total: number;
  commission: number;
  paid_cash: number;
  paid_mobile: number;
  paid_card: number;
  status: 'open' | 'paid' | 'void';
  appointment_id: string | null;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
  paid_at: string | null;
}

export type ApptStatus = 'requested' | 'confirmed' | 'arrived' | 'done' | 'no_show' | 'cancelled';
export type ApptSource = 'walk_in' | 'phone' | 'online';

export interface SalonAppointment {
  id: string;
  business_id: string;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  barber_id: string | null;
  barber_name: string | null;
  service_ids: string[];
  service_names: string | null;
  price_estimate: number;
  start_at: string;
  end_at: string;
  status: ApptStatus;
  source: ApptSource;
  note: string | null;
  visit_id: string | null;
  created_at: string;
}

/** Holding a chair: these block the slot. */
export const ACTIVE_APPT: ApptStatus[] = ['requested', 'confirmed', 'arrived'];

export function lineTotal(l: VisitLine) {
  return Math.max(0, l.price_charged) * Math.max(1, l.qty);
}

/** Subtotal, discount (never more than the subtotal), tip, and what is due. */
export function visitTotals(lines: VisitLine[], discount: number, tip: number) {
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const disc = Math.min(Math.max(0, discount || 0), subtotal);
  const t = Math.max(0, tip || 0);
  return { subtotal, discount: disc, tip: t, total: subtotal - disc + t };
}

/**
 * The barber's share, as salon_record_visit computes it: each service's
 * charged price, less its pro-rata share of the discount, at the barber's own
 * rate when one is set or else the service's rate; plus the whole tip.
 */
export function visitCommission(
  lines: VisitLine[],
  discount: number,
  tip: number,
  services: Pick<SalonService, 'id' | 'commission_pct'>[],
  barberPct: number | null | undefined,
  hasBarber: boolean,
) {
  const { subtotal, discount: disc, tip: t } = visitTotals(lines, discount, tip);
  const keep = subtotal > 0 ? (subtotal - disc) / subtotal : 0;
  const byId = new Map(services.map((s) => [s.id, s.commission_pct]));
  const onServices = lines.reduce((sum, l) => {
    const pct = barberPct ?? (l.service_id ? byId.get(l.service_id) ?? 0 : 0);
    return sum + lineTotal(l) * keep * (pct / 100);
  }, 0);
  return Math.round(onServices + (hasBarber ? t : 0));
}

/** Spread a total over cash / mobile / card when only one method is picked. */
export function splitPayment(total: number, method: 'cash' | 'mobile' | 'card') {
  return { paid_cash: method === 'cash' ? total : 0, paid_mobile: method === 'mobile' ? total : 0, paid_card: method === 'card' ? total : 0 };
}

const DAY = 86_400_000;

export function daysSince(iso: string | null, now = Date.now()) {
  return iso ? Math.floor((now - new Date(iso).getTime()) / DAY) : Infinity;
}

/** Clients who used to come and have stopped: 2+ visits, last seen 30+ days ago, best spenders first. */
export function winBack(clients: SalonClient[], now = Date.now(), days = 30) {
  return clients
    .filter((c) => c.visits >= 2 && daysSince(c.last_visit_at, now) >= days)
    .sort((a, b) => b.total_spent - a.total_spent);
}

export interface BarberRow { id: string | null; name: string; revenue: number; clients: number; avgTicket: number; commission: number; tips: number }

/** Revenue, clients, average ticket and commission per barber. Revenue excludes tips. */
export function barberLeaderboard(visits: SalonVisit[]): BarberRow[] {
  const m = new Map<string, BarberRow>();
  for (const v of visits) {
    if (v.status !== 'paid') continue;
    const key = v.barber_id || '—';
    const row = m.get(key) || { id: v.barber_id, name: v.barber_name || 'Unassigned', revenue: 0, clients: 0, avgTicket: 0, commission: 0, tips: 0 };
    row.revenue += v.total - v.tip;
    row.tips += v.tip;
    row.clients += 1;
    row.commission += v.commission;
    m.set(key, row);
  }
  return [...m.values()].map((r) => ({ ...r, avgTicket: r.clients ? Math.round(r.revenue / r.clients) : 0 })).sort((a, b) => b.revenue - a.revenue);
}

export interface ServiceRow { name: string; count: number; revenue: number; avgCharged: number; listPrice: number }

/** How often each service is sold, what it brings in, and what customers really pay against the list price. */
export function serviceMix(visits: SalonVisit[]): ServiceRow[] {
  const m = new Map<string, { name: string; count: number; revenue: number; list: number }>();
  for (const v of visits) {
    if (v.status !== 'paid') continue;
    for (const l of v.items || []) {
      const key = l.service_id || l.name;
      const row = m.get(key) || { name: l.name, count: 0, revenue: 0, list: l.list_price };
      row.count += Math.max(1, l.qty);
      row.revenue += lineTotal(l);
      row.list = l.list_price;
      m.set(key, row);
    }
  }
  return [...m.values()]
    .map((r) => ({ name: r.name, count: r.count, revenue: r.revenue, avgCharged: r.count ? Math.round(r.revenue / r.count) : 0, listPrice: r.list }))
    .sort((a, b) => b.revenue - a.revenue);
}

/** Visits by weekday (0 = Mon) × hour, for the busy-hours heatmap. */
export function hourHeatmap(visits: SalonVisit[]) {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const v of visits) {
    if (v.status !== 'paid') continue;
    const d = new Date(v.paid_at || v.created_at);
    grid[(d.getDay() + 6) % 7][d.getHours()] += 1;
  }
  return grid;
}

/** Share of the period's visits that came from clients who had been before. */
export function returningRate(visits: SalonVisit[]) {
  const paid = visits.filter((v) => v.status === 'paid');
  if (!paid.length) return 0;
  const seen = new Map<string, number>();
  for (const v of paid) if (v.client_id) seen.set(v.client_id, (seen.get(v.client_id) || 0) + 1);
  const returning = paid.filter((v) => v.client_id && (seen.get(v.client_id) || 0) > 1).length;
  return returning / paid.length;
}

/** No-shows as a share of bookings that reached their time. */
export function noShowRate(appts: SalonAppointment[], now = Date.now()) {
  const due = appts.filter((a) => new Date(a.start_at).getTime() < now && a.status !== 'cancelled' && a.status !== 'requested');
  if (!due.length) return 0;
  return due.filter((a) => a.status === 'no_show').length / due.length;
}

/** Revenue per day for the trend chart (excludes tips), oldest first. */
export function dailyRevenue(visits: SalonVisit[], days: number, now = new Date()) {
  const out: { date: string; revenue: number; clients: number }[] = [];
  const idx = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const key = localDate(d);
    idx.set(key, out.length);
    out.push({ date: key, revenue: 0, clients: 0 });
  }
  for (const v of visits) {
    if (v.status !== 'paid') continue;
    const i = idx.get(localDate(new Date(v.paid_at || v.created_at)));
    if (i === undefined) continue;
    out[i].revenue += v.total - v.tip;
    out[i].clients += 1;
  }
  return out;
}

export function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function hhmm(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Tanzanian numbers in the form WhatsApp wants: 2557XXXXXXXX. */
export function waNumber(phone: string | null | undefined, country = 'TZ') {
  if (!phone) return null;
  let p = phone.replace(/[^0-9]/g, '');
  if (country === 'TZ') {
    if (p.startsWith('0')) p = '255' + p.slice(1);
    if (p.length === 9) p = '255' + p;
  }
  return p.length >= 10 ? p : null;
}

export function waLink(phone: string | null | undefined, text: string, country = 'TZ') {
  const n = waNumber(phone, country);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export const DEFAULT_HOURS: Record<string, [string, string] | null> = {
  '1': ['08:00', '20:00'], '2': ['08:00', '20:00'], '3': ['08:00', '20:00'], '4': ['08:00', '20:00'],
  '5': ['08:00', '20:00'], '6': ['08:00', '20:00'], '7': ['10:00', '18:00'],
};

/** Opening hours for a date in the shop's settings, or null when closed. */
export function hoursFor(hours: Record<string, [string, string] | null> | undefined, d: Date): [string, string] | null {
  const iso = String(((d.getDay() + 6) % 7) + 1);
  const h = (hours || DEFAULT_HOURS)[iso];
  return h === undefined ? DEFAULT_HOURS[iso] : h;
}

/**
 * Free start times on a day for a service of `minutes`, the same rule the
 * server applies to online bookings: inside opening hours, not in the past,
 * and not overlapping anything the barber already has. With no barber picked,
 * any one free barber will do.
 */
export function freeSlots(opts: {
  day: Date; minutes: number; barberId: string | null; barberIds: string[];
  appts: SalonAppointment[]; hours?: Record<string, [string, string] | null>; step?: number; now?: number; ignoreId?: string;
}) {
  const { day, minutes, barberId, barberIds, appts, hours, step = 30, now = Date.now(), ignoreId } = opts;
  const h = hoursFor(hours, day);
  if (!h) return [] as Date[];
  const [oh, om] = h[0].split(':').map(Number);
  const [ch, cm] = h[1].split(':').map(Number);
  const open = new Date(day); open.setHours(oh, om, 0, 0);
  const close = new Date(day); close.setHours(ch, cm, 0, 0);
  const live = appts.filter((a) => a.id !== ignoreId && ACTIVE_APPT.includes(a.status));
  const busy = (bid: string | null, s: number, e: number) => live.some((a) => a.barber_id === bid && new Date(a.start_at).getTime() < e && new Date(a.end_at).getTime() > s);
  const out: Date[] = [];
  for (let t = open.getTime(); t + minutes * 60_000 <= close.getTime(); t += step * 60_000) {
    if (t < now + 10 * 60_000) continue;
    const e = t + minutes * 60_000;
    let ok: boolean;
    if (barberId) ok = !busy(barberId, t, e);
    else if (barberIds.length === 0) ok = !live.some((a) => new Date(a.start_at).getTime() < e && new Date(a.end_at).getTime() > t);
    else {
      const unassigned = live.filter((a) => !a.barber_id && new Date(a.start_at).getTime() < e && new Date(a.end_at).getTime() > t).length;
      ok = barberIds.filter((b) => !busy(b, t, e)).length - unassigned > 0;
    }
    if (ok) out.push(new Date(t));
  }
  return out;
}

export type QueueStatus = 'waiting' | 'called' | 'serving' | 'done' | 'left';
export interface QueueTicket {
  id: string;
  business_id: string;
  day: string;
  number: number;
  client_name: string;
  client_phone: string | null;
  service_ids: string[];
  service_names: string | null;
  minutes: number;
  barber_id: string | null;
  barber_name: string | null;
  status: QueueStatus;
  source: 'online' | 'desk';
  token: string;
  visit_id: string | null;
  created_at: string;
  called_at: string | null;
  done_at: string | null;
}
