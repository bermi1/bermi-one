// The Bermi Techs side, from the app's point of view.
//
// Every call goes to the `admin` edge function, which re-checks that the caller
// really is a platform administrator before it does anything. Nothing here is
// trusted as authorisation — this file only decides what to *show*.

import { supabase } from './supabase';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';

export interface Plan {
  id: string;
  code: string;
  name: string;
  amount: number;
  currency: string;
  interval_days: number;
  features: Record<string, unknown>;
  active: boolean;
  sort_order: number;
}

export interface Subscription {
  id: string;
  owner_id: string;
  business_id: string | null;
  plan_id: string | null;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  billing_phone: string | null;
  notes: string | null;
  subscription_plans?: Pick<Plan, 'code' | 'name' | 'amount'> | null;
}

export interface ClientRow {
  id: string;
  name: string;
  type: string;
  city: string | null;
  country_code: string;
  owner_id: string;
  owner_name: string | null;
  suspended: boolean;
  suspended_reason: string | null;
  created_at: string;
  subscription: Subscription | null;
  /** How many businesses the whole account runs — the number the plan is priced on. */
  account_businesses: number;
  last_closing: string | null;
}

export interface Overview {
  businesses: number;
  accounts: number;
  suspended: number;
  newThisMonth: number;
  subscriptions: { active: number; trialing: number; pastDue: number; suspended: number; cancelled: number };
  mrr: number;
  currency: string;
  activeLast30: number;
  closingsLast30: number;
  verifiedLast30: number;
  collectedLast30: number;
}

export interface ClientDetail {
  business: ClientRow & { suspended_at: string | null };
  owner: { id: string; full_name: string | null; email: string | null; last_sign_in_at: string | null };
  subscription: (Subscription & { subscription_plans: Plan | null }) | null;
  account_businesses: { id: string; name: string; suspended: boolean }[];
  payments: PlatformPayment[];
  sessions: { session_date: string; status: string; total_calculated_sales: number }[];
}

export interface PlatformPayment {
  id: string;
  business_id: string;
  reference: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  msisdn: string | null;
  label: string | null;
  sandbox: boolean;
  created_at: string;
  businesses?: { name: string } | null;
}

async function callAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin', { body });
  if (error) throw new Error(error.message);
  const out = data as T & { error?: string };
  if (out?.error) throw new Error(out.error);
  return out;
}

/** Whether the signed-in user is Bermi Techs staff. Decides only what is shown. */
export async function checkPlatformAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_platform_admin');
  if (error) return false;
  return !!data;
}

export const fetchOverview = () => callAdmin<Overview>({ action: 'overview' });
export const fetchClients = () => callAdmin<{ clients: ClientRow[] }>({ action: 'clients' }).then((r) => r.clients);
export const fetchClient = (businessId: string) => callAdmin<ClientDetail>({ action: 'client', business_id: businessId });
export const fetchAllPayments = () => callAdmin<{ payments: PlatformPayment[] }>({ action: 'payments' }).then((r) => r.payments);

export const setSuspended = (businessId: string, suspended: boolean, reason?: string) =>
  callAdmin<{ ok: boolean }>({ action: 'set_suspended', business_id: businessId, suspended, reason });

export const setSubscription = (businessId: string, patch: {
  plan_id?: string;
  status?: SubscriptionStatus;
  period_days?: number;
  billing_phone?: string;
  notes?: string;
}) => callAdmin<{ subscription: Subscription }>({ action: 'set_subscription', business_id: businessId, ...patch });

/**
 * Sends the client a recovery link. Support never sees or sets a password —
 * the most it can do is hand someone a way back into their own account.
 */
export const resetPassword = (email: string) =>
  callAdmin<{ ok: boolean; action_link: string | null }>({ action: 'reset_password', email });

export const chargeSubscription = (businessId: string, opts?: { amount?: number; billing_phone?: string }) =>
  callAdmin<{ reference: string; amount: number }>({ action: 'charge_subscription', business_id: businessId, ...opts });

export const queryPayment = (reference: string) =>
  callAdmin<{ payment_status?: string; provider_checked?: boolean; provider_message?: string | null }>({ action: 'query_payment', reference });

export async function fetchPlans(): Promise<Plan[]> {
  const { data } = await supabase.from('subscription_plans').select('*').eq('active', true).order('sort_order');
  return (data || []) as Plan[];
}

/**
 * What a client's own copy of the app needs to know about their bill.
 *
 * Keyed by account, not business: one plan covers everything the person owns,
 * so there is exactly one row to find and row level security already scopes it
 * to whoever is asking.
 */
export async function fetchMySubscription(): Promise<Subscription | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('*, subscription_plans(code, name, amount)')
    .maybeSingle();
  return (data as Subscription) || null;
}

/** Whole days left on a trial — never negative, and 0 once it has run out. */
export function trialDaysLeft(sub: Subscription | null): number {
  if (!sub || sub.status !== 'trialing' || !sub.trial_ends_at) return 0;
  const ms = new Date(sub.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

// ---------------------------------------------------------------------------
// The portal's own data layer.
//
// These read straight from the database as the signed-in administrator rather
// than through the admin function. Row level security is already the
// authority — is_platform_admin() gates every one of these tables and RPCs —
// so routing them through an edge function would add a hop and a second
// implementation of the same rule. It also means Realtime, which enforces the
// same policies, delivers the same rows to the same person.
// ---------------------------------------------------------------------------

import type { ActionTypeName, ObjectTypeName } from '../ontology/schema';

export interface ActivityRow {
  id: string;
  business_id: string;
  object_type: ObjectTypeName;
  action_type: ActionTypeName;
  object_id: string | null;
  summary: string;
  payload: Record<string, unknown>;
  actor_name: string | null;
  created_at: string;
  businesses?: { name: string } | null;
}

export interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  business_id: string | null;
  owner_id: string | null;
  summary: string;
  payload: Record<string, unknown>;
  created_at: string;
  businesses?: { name: string } | null;
}

export interface OntologySnapshot {
  objects: Partial<Record<ObjectTypeName, number>>;
  actions: { action_type: string; n: number; last_at: string }[];
}

export async function fetchActivity(opts: {
  limit?: number;
  objectType?: ObjectTypeName | null;
  businessId?: string | null;
} = {}): Promise<ActivityRow[]> {
  let q = supabase
    .from('action_log')
    .select('*, businesses(name)')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 80);
  if (opts.objectType) q = q.eq('object_type', opts.objectType);
  if (opts.businessId) q = q.eq('business_id', opts.businessId);
  const { data } = await q;
  return (data || []) as ActivityRow[];
}

export async function fetchAudit(limit = 80): Promise<AuditRow[]> {
  const { data } = await supabase
    .from('admin_audit')
    .select('*, businesses(name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []) as AuditRow[];
}

/** Platform-wide counts per noun, and per verb over a window. */
export async function fetchOntology(sinceDays = 30): Promise<OntologySnapshot> {
  const [{ data: objects }, { data: actions }] = await Promise.all([
    supabase.rpc('platform_ontology_counts'),
    supabase.rpc('platform_action_counts', { since_days: sinceDays }),
  ]);
  return {
    objects: (objects || {}) as Partial<Record<ObjectTypeName, number>>,
    actions: ((actions || []) as { action_type: string; n: number; last_at: string }[]),
  };
}

/** Suspending and restoring, done directly so the audit trigger sees who did it. */
export async function setBusinessSuspended(businessId: string, suspended: boolean, reason?: string): Promise<string | null> {
  const { error } = await supabase
    .from('businesses')
    .update({
      suspended,
      suspended_reason: suspended ? (reason?.trim() || null) : null,
      suspended_at: suspended ? new Date().toISOString() : null,
    })
    .eq('id', businessId);
  return error?.message ?? null;
}

export async function updateSubscription(ownerId: string, patch: {
  plan_id?: string;
  status?: SubscriptionStatus;
  period_days?: number;
  billing_phone?: string;
}): Promise<string | null> {
  const row: Record<string, unknown> = { owner_id: ownerId, updated_at: new Date().toISOString() };
  if (patch.plan_id) row.plan_id = patch.plan_id;
  if (patch.status) row.status = patch.status;
  if (patch.billing_phone !== undefined) row.billing_phone = patch.billing_phone;
  if (patch.period_days) {
    const start = new Date();
    row.current_period_start = start.toISOString();
    row.current_period_end = new Date(start.getTime() + patch.period_days * 86_400_000).toISOString();
  }
  const { error } = await supabase.from('subscriptions').upsert(row, { onConflict: 'owner_id' });
  if (error) return error.message;

  // Paying up lifts the block on every business in the account — the reason
  // for it is gone, and leaving one bar dark would be a support ticket.
  if (patch.status === 'active') {
    await supabase
      .from('businesses')
      .update({ suspended: false, suspended_reason: null, suspended_at: null })
      .eq('owner_id', ownerId);
  }
  return null;
}

export interface NotificationRow {
  id: string;
  business_id: string | null;
  channel: 'sms' | 'email' | 'push';
  kind: string;
  recipient: string;
  subject: string | null;
  body: string;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  provider: string | null;
  provider_message: string | null;
  sent_at: string | null;
  created_at: string;
  businesses?: { name: string } | null;
}

export interface WebhookEventRow {
  id: string;
  source: string;
  reference: string | null;
  signature_ok: boolean;
  handled: boolean;
  outcome: string | null;
  created_at: string;
}

/** What has been sent, what is waiting, and what failed trying. */
export async function fetchNotifications(limit = 80): Promise<NotificationRow[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*, businesses(name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []) as NotificationRow[];
}

/**
 * Every callback the gateway sent, including the rejected ones — which are the
 * whole reason to keep this: a signature that stops matching is invisible
 * otherwise until someone notices payments have quietly stopped settling.
 */
export async function fetchWebhookEvents(limit = 60): Promise<WebhookEventRow[]> {
  const { data } = await supabase
    .from('webhook_events')
    .select('id, source, reference, signature_ok, handled, outcome, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []) as WebhookEventRow[];
}

export interface DailyPoint {
  day: string;
  closings: number;
  verified: number;
  sales: number;
  new_businesses: number;
  collected: number;
}

/** One row a day for the last 30, zeros included, so the charts tell the truth. */
export async function fetchDailySeries(days = 30): Promise<DailyPoint[]> {
  const { data } = await supabase.rpc('platform_daily_series', { days });
  return ((data || []) as DailyPoint[]).map((d) => ({
    ...d,
    closings: Number(d.closings),
    verified: Number(d.verified),
    sales: Number(d.sales),
    new_businesses: Number(d.new_businesses),
    collected: Number(d.collected),
  }));
}

// --- inquiries, from the console's side ------------------------------------
export { fetchSupportQueue, fetchThread, postMessage, setInquiryStatus } from './support';
export type { Inquiry, InquiryMessage, InquiryStatus } from './support';
