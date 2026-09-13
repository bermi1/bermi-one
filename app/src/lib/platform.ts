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
  business_id: string;
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
  last_closing: string | null;
}

export interface Overview {
  businesses: number;
  suspended: number;
  newThisMonth: number;
  subscriptions: { active: number; trialing: number; pastDue: number; suspended: number; cancelled: number };
  mrr: number;
  activeLast30: number;
  closingsLast30: number;
  verifiedLast30: number;
  collectedLast30: number;
}

export interface ClientDetail {
  business: ClientRow & { suspended_at: string | null };
  owner: { id: string; full_name: string | null; email: string | null; last_sign_in_at: string | null };
  subscription: (Subscription & { subscription_plans: Plan | null }) | null;
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

/** What a client's own copy of the app needs to know about their bill. */
export async function fetchMySubscription(businessId: string): Promise<Subscription | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('*, subscription_plans(code, name, amount)')
    .eq('business_id', businessId)
    .maybeSingle();
  return (data as Subscription) || null;
}
