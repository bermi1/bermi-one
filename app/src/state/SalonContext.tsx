import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useData } from './DataContext';
import { logAction } from '../ontology/actions';
import type { ApptSource, ApptStatus, QueueStatus, QueueTicket, SalonAppointment, SalonClient, SalonService, SalonVisit, VisitLine } from '../lib/salon';
import { localDate } from '../lib/salon';

/*
  The barbershop's working set.

  Bounded on purpose, so a shop with five years behind it opens as fast as a
  new one: the whole service menu (a few dozen rows at most), the 500 most
  recent clients, the last 35 days of visits and the appointments from a week
  back to 60 days ahead. Anything older — a long report range, one client's full
  history — is fetched on demand by the screen that needs it.
*/

export interface NewVisit {
  client_id?: string | null;
  client_name?: string;
  client_phone?: string;
  barber_id?: string | null;
  items: VisitLine[];
  discount: number;
  tip: number;
  paid_cash: number;
  paid_mobile: number;
  paid_card: number;
  appointment_id?: string | null;
  note?: string;
}

export interface NewAppointment {
  client_id?: string | null;
  client_name: string;
  client_phone?: string | null;
  barber_id?: string | null;
  service_ids: string[];
  start_at: string;
  source: ApptSource;
  note?: string | null;
}

interface SalonCtx {
  isSalon: boolean;
  loaded: boolean;
  services: SalonService[];
  clients: SalonClient[];
  visits: SalonVisit[];
  appointments: SalonAppointment[];
  reload: () => Promise<void>;
  saveService: (s: Partial<SalonService> & { name: string }) => Promise<string | null>;
  recordVisit: (v: NewVisit) => Promise<{ ok: true; total: number; commission: number } | { ok: false; error: string }>;
  createAppointment: (a: NewAppointment) => Promise<string | null>;
  setAppointmentStatus: (id: string, status: ApptStatus) => Promise<void>;
  rescheduleAppointment: (id: string, startIso: string, barberId: string | null) => Promise<string | null>;
  saveClient: (c: Partial<SalonClient> & { name: string }) => Promise<string | null>;
  fetchVisits: (fromIso: string, toIso: string) => Promise<SalonVisit[]>;
  fetchAppointments: (fromIso: string, toIso: string) => Promise<SalonAppointment[]>;
  fetchClientVisits: (clientId: string) => Promise<SalonVisit[]>;
  ensureSlug: () => Promise<string | null>;
  /** Today's walk-in queue, oldest number first. Refreshed every 20 s while open. */
  queue: QueueTicket[];
  refreshQueue: () => Promise<void>;
  addToQueue: (name: string, phone?: string, serviceIds?: string[], barberId?: string | null) => Promise<string | null>;
  setQueueStatus: (id: string, status: QueueStatus, barberId?: string | null) => Promise<void>;
}

const Ctx = createContext<SalonCtx | null>(null);

const ERRORS: Record<string, string> = {
  NO_SERVICES: 'Add at least one service.',
  PAYMENT_MISMATCH: 'The payment does not add up to the total.',
  BARBER_NOT_FOUND: 'That barber is no longer on the team.',
  CLIENT_NOT_FOUND: 'That client could not be found.',
  NOT_ALLOWED: 'This business is not active for recording.',
};

function friendly(msg: string) {
  const code = Object.keys(ERRORS).find((k) => msg.includes(k));
  return code ? ERRORS[code] : msg;
}

export function SalonProvider({ children }: { children: ReactNode }) {
  const { activeBusiness, staffMembers, role, activeStaff, profile, refreshMoney } = useData();
  const isSalon = activeBusiness?.type === 'barber';
  const bizId = isSalon ? activeBusiness!.id : null;
  const actor = role === 'staff' && activeStaff ? activeStaff.name : (profile?.full_name || undefined);

  const [loaded, setLoaded] = useState(false);
  const [services, setServices] = useState<SalonService[]>([]);
  const [clients, setClients] = useState<SalonClient[]>([]);
  const [visits, setVisits] = useState<SalonVisit[]>([]);
  const [appointments, setAppointments] = useState<SalonAppointment[]>([]);
  const [queue, setQueue] = useState<QueueTicket[]>([]);

  const reload = useCallback(async () => {
    if (!bizId) return;
    const since = new Date(Date.now() - 35 * 86_400_000).toISOString();
    const apFrom = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const apTo = new Date(Date.now() + 60 * 86_400_000).toISOString();
    const [sv, cl, vi, ap] = await Promise.all([
      supabase.from('salon_services').select('*').eq('business_id', bizId).order('sort_order').limit(200),
      supabase.from('salon_clients').select('*').eq('business_id', bizId).order('last_visit_at', { ascending: false, nullsFirst: false }).limit(500),
      supabase.from('salon_visits').select('*').eq('business_id', bizId).gte('created_at', since).order('created_at', { ascending: false }).limit(1000),
      supabase.from('salon_appointments').select('*').eq('business_id', bizId).gte('start_at', apFrom).lte('start_at', apTo).order('start_at').limit(1000),
    ]);
    setServices((sv.data || []) as SalonService[]);
    setClients((cl.data || []) as SalonClient[]);
    setVisits((vi.data || []) as SalonVisit[]);
    setAppointments((ap.data || []) as SalonAppointment[]);
    setLoaded(true);
  }, [bizId]);

  useEffect(() => {
    setLoaded(false);
    setServices([]); setClients([]); setVisits([]); setAppointments([]); setQueue([]);
    if (bizId) void reload();
  }, [bizId, reload]);

  const refreshQueue = useCallback(async () => {
    if (!bizId) return;
    // The shop's day is computed server side in its time zone; the device's local date matches it for a shop's own phone.
    const { data } = await supabase.from('salon_queue').select('*').eq('business_id', bizId).eq('day', localDate(new Date())).order('number').limit(500);
    setQueue((data || []) as QueueTicket[]);
  }, [bizId]);

  // Online customers join while the shop is open, so keep the list fresh.
  useEffect(() => {
    if (!bizId) return;
    void refreshQueue();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void refreshQueue(); }, 20_000);
    return () => clearInterval(t);
  }, [bizId, refreshQueue]);

  const addToQueue = useCallback<SalonCtx['addToQueue']>(async (name, phone, serviceIds, barberId) => {
    if (!bizId) return 'No business';
    const { error } = await supabase.rpc('salon_queue_add', { p_business: bizId, p_name: name, p_phone: phone || null, p_service_ids: serviceIds || [], p_barber: barberId || null });
    if (error) return error.message;
    await refreshQueue();
    return null;
  }, [bizId, refreshQueue]);

  const setQueueStatus = useCallback<SalonCtx['setQueueStatus']>(async (id, status, barberId) => {
    const barber = barberId ? staffMembers.find((m) => m.id === barberId) : undefined;
    const patch: Record<string, unknown> = { status };
    if (status === 'called' || status === 'serving') patch.called_at = new Date().toISOString();
    if (status === 'done' || status === 'left') patch.done_at = new Date().toISOString();
    if (barber) { patch.barber_id = barber.id; patch.barber_name = barber.name; }
    setQueue((xs) => xs.map((q) => (q.id === id ? { ...q, ...patch } as QueueTicket : q)));
    await supabase.from('salon_queue').update(patch).eq('id', id);
  }, [staffMembers]);

  const saveService = useCallback<SalonCtx['saveService']>(async (s) => {
    if (!bizId) return 'No business';
    const row = {
      name: s.name.trim(), category: s.category || 'Hair', price: Math.max(0, Number(s.price) || 0),
      duration_min: Math.min(600, Math.max(5, Number(s.duration_min) || 30)),
      commission_pct: Math.min(100, Math.max(0, Number(s.commission_pct) || 0)),
      active: s.active ?? true, sort_order: s.sort_order ?? services.length + 1,
    };
    if (s.id) {
      const { data, error } = await supabase.from('salon_services').update(row).eq('id', s.id).select().single();
      if (error) return error.message;
      setServices((xs) => xs.map((x) => (x.id === s.id ? (data as SalonService) : x)));
    } else {
      const { data, error } = await supabase.from('salon_services').insert({ ...row, business_id: bizId }).select().single();
      if (error) return error.message;
      setServices((xs) => [...xs, data as SalonService]);
    }
    void logAction({ businessId: bizId, actionType: s.id ? 'service.update' : 'service.create', objectId: s.id, summary: `${s.id ? 'Updated' : 'Added'} service ${row.name} at ${row.price}`, payload: row, actorName: actor });
    return null;
  }, [bizId, services.length, actor]);

  const recordVisit = useCallback<SalonCtx['recordVisit']>(async (v) => {
    if (!bizId) return { ok: false, error: 'No business' };
    const { data, error } = await supabase.rpc('salon_record_visit', {
      p: { ...v, business_id: bizId, recorded_by: actor || '' },
    });
    if (error) return { ok: false, error: friendly(error.message) };
    const out = data as { visit_id: string; client_id: string | null; total: number; commission: number };
    // Pull the saved rows back rather than guessing them: the server stamped the totals.
    const [vi, cl] = await Promise.all([
      supabase.from('salon_visits').select('*').eq('id', out.visit_id).single(),
      out.client_id ? supabase.from('salon_clients').select('*').eq('id', out.client_id).single() : Promise.resolve({ data: null }),
    ]);
    if (vi.data) setVisits((xs) => [vi.data as SalonVisit, ...xs]);
    if (cl.data) setClients((xs) => [cl.data as SalonClient, ...xs.filter((c) => c.id !== (cl.data as SalonClient).id)]);
    if (v.appointment_id) setAppointments((xs) => xs.map((a) => (a.id === v.appointment_id ? { ...a, status: 'done', visit_id: out.visit_id } : a)));
    void refreshMoney();
    void logAction({ businessId: bizId, actionType: 'visit.record', objectId: out.visit_id, summary: `Recorded ${v.items.map((i) => i.name).join(' + ')} — ${out.total}`, payload: { total: out.total, commission: out.commission }, actorName: actor });
    return { ok: true, total: out.total, commission: out.commission };
  }, [bizId, actor, refreshMoney]);

  const createAppointment = useCallback<SalonCtx['createAppointment']>(async (a) => {
    if (!bizId) return 'No business';
    const picked = services.filter((s) => a.service_ids.includes(s.id));
    const minutes = picked.reduce((m, s) => m + s.duration_min, 0) || 30;
    const start = new Date(a.start_at);
    const barber = staffMembers.find((m) => m.id === a.barber_id);
    const row = {
      business_id: bizId, client_id: a.client_id || null, client_name: a.client_name.trim(), client_phone: a.client_phone || null,
      barber_id: a.barber_id || null, barber_name: barber?.name || null, service_ids: a.service_ids,
      service_names: picked.map((s) => s.name).join(' + ') || null, price_estimate: picked.reduce((m, s) => m + Number(s.price), 0),
      start_at: start.toISOString(), end_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
      status: 'confirmed' as ApptStatus, source: a.source, note: a.note || null,
    };
    const clash = appointments.some((x) => x.barber_id && x.barber_id === row.barber_id && ['requested', 'confirmed', 'arrived'].includes(x.status)
      && new Date(x.start_at) < new Date(row.end_at) && new Date(x.end_at) > start);
    if (clash) return 'That barber already has someone booked then.';
    const { data, error } = await supabase.from('salon_appointments').insert(row).select().single();
    if (error) return error.message;
    setAppointments((xs) => [...xs, data as SalonAppointment].sort((p, q) => p.start_at.localeCompare(q.start_at)));
    void logAction({ businessId: bizId, actionType: 'appointment.create', objectId: (data as SalonAppointment).id, summary: `Booked ${row.client_name} for ${row.service_names || 'a visit'}`, payload: { start_at: row.start_at }, actorName: actor });
    return null;
  }, [bizId, services, staffMembers, appointments, actor]);

  const setAppointmentStatus = useCallback<SalonCtx['setAppointmentStatus']>(async (id, status) => {
    setAppointments((xs) => xs.map((a) => (a.id === id ? { ...a, status } : a)));
    await supabase.from('salon_appointments').update({ status }).eq('id', id);
    if (bizId) void logAction({ businessId: bizId, actionType: 'appointment.status', objectId: id, summary: `Appointment marked ${status.replace('_', ' ')}`, actorName: actor });
  }, [bizId, actor]);

  const rescheduleAppointment = useCallback<SalonCtx['rescheduleAppointment']>(async (id, startIso, barberId) => {
    const a = appointments.find((x) => x.id === id);
    if (!a) return 'Not found';
    const len = new Date(a.end_at).getTime() - new Date(a.start_at).getTime();
    const start = new Date(startIso);
    const end = new Date(start.getTime() + len);
    const clash = appointments.some((x) => x.id !== id && barberId && x.barber_id === barberId && ['requested', 'confirmed', 'arrived'].includes(x.status)
      && new Date(x.start_at) < end && new Date(x.end_at) > start);
    if (clash) return 'That barber already has someone booked then.';
    const barber = staffMembers.find((m) => m.id === barberId);
    const patch = { start_at: start.toISOString(), end_at: end.toISOString(), barber_id: barberId, barber_name: barber?.name || null };
    const { error } = await supabase.from('salon_appointments').update(patch).eq('id', id);
    if (error) return error.message;
    setAppointments((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)).sort((p, q) => p.start_at.localeCompare(q.start_at)));
    return null;
  }, [appointments, staffMembers]);

  const saveClient = useCallback<SalonCtx['saveClient']>(async (c) => {
    if (!bizId) return 'No business';
    const phone = c.phone ? c.phone.replace(/[^0-9+]/g, '') || null : null;
    const row = { name: c.name.trim(), phone, notes: c.notes ?? null };
    if (c.id) {
      const { data, error } = await supabase.from('salon_clients').update(row).eq('id', c.id).select().single();
      if (error) return error.message.includes('salon_clients_phone_key') ? 'Another client already has that phone number.' : error.message;
      setClients((xs) => xs.map((x) => (x.id === c.id ? (data as SalonClient) : x)));
    } else {
      const { data, error } = await supabase.from('salon_clients').insert({ ...row, business_id: bizId }).select().single();
      if (error) return error.message.includes('salon_clients_phone_key') ? 'A client with that phone number already exists.' : error.message;
      setClients((xs) => [data as SalonClient, ...xs]);
    }
    return null;
  }, [bizId]);

  const fetchVisits = useCallback<SalonCtx['fetchVisits']>(async (fromIso, toIso) => {
    if (!bizId) return [];
    const { data } = await supabase.from('salon_visits').select('*').eq('business_id', bizId)
      .gte('created_at', fromIso).lte('created_at', toIso).order('created_at', { ascending: false }).limit(1000);
    return (data || []) as SalonVisit[];
  }, [bizId]);

  const fetchAppointments = useCallback<SalonCtx['fetchAppointments']>(async (fromIso, toIso) => {
    if (!bizId) return [];
    const { data } = await supabase.from('salon_appointments').select('*').eq('business_id', bizId)
      .gte('start_at', fromIso).lte('start_at', toIso).order('start_at').limit(1000);
    return (data || []) as SalonAppointment[];
  }, [bizId]);

  const fetchClientVisits = useCallback<SalonCtx['fetchClientVisits']>(async (clientId) => {
    const { data } = await supabase.from('salon_visits').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(100);
    return (data || []) as SalonVisit[];
  }, []);

  const ensureSlug = useCallback(async () => {
    if (!bizId) return null;
    if (activeBusiness?.slug) return activeBusiness.slug;
    const { data, error } = await supabase.rpc('ensure_business_slug', { p_business: bizId });
    return error ? null : (data as string);
  }, [bizId, activeBusiness]);

  const value = useMemo<SalonCtx>(() => ({
    isSalon, loaded, services, clients, visits, appointments, reload, saveService, recordVisit, createAppointment,
    setAppointmentStatus, rescheduleAppointment, saveClient, fetchVisits, fetchAppointments, fetchClientVisits, ensureSlug,
    queue, refreshQueue, addToQueue, setQueueStatus,
  }), [isSalon, loaded, services, clients, visits, appointments, reload, saveService, recordVisit, createAppointment,
    setAppointmentStatus, rescheduleAppointment, saveClient, fetchVisits, fetchAppointments, fetchClientVisits, ensureSlug,
    queue, refreshQueue, addToQueue, setQueueStatus]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSalon() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSalon must be used within SalonProvider');
  return ctx;
}
