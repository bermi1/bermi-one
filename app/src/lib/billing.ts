// Paying for a subscription, from the client's side.
//
// The browser names a plan CODE and a phone number, nothing more. The price
// comes from the database inside the edge function, and the account comes from
// the caller's own JWT — because a browser that can name the amount is a
// browser that can name a smaller one, and a browser that can name the account
// is a browser that can top up someone else's.

import { invokeFunction } from './functions';
import { supabase } from './supabase';
import type { PlanCode } from './plans';

/**
 * How long a payment buys. Mirrors the `billing_periods` table, which is what
 * the server actually prices from — these figures only drive what the page
 * shows, so a stale copy here can mislabel a price but never change one.
 */
export type PeriodCode = 'monthly' | 'quarterly' | 'annual';
export interface BillingPeriod { code: PeriodCode; months: number; discountPct: number; freeMonths: number }
export const PERIODS: BillingPeriod[] = [
  { code: 'monthly', months: 1, discountPct: 0, freeMonths: 0 },
  { code: 'quarterly', months: 3, discountPct: 10, freeMonths: 0 },
  { code: 'annual', months: 12, discountPct: 0, freeMonths: 2 },
];

/** USD due for a plan over a period — the same sum the subscribe function does. */
export function periodUsd(monthlyUsd: number, period: BillingPeriod): number {
  const payable = period.months - period.freeMonths;
  return Math.round(monthlyUsd * payable * (1 - period.discountPct / 100) * 100) / 100;
}

export interface LatestPayment {
  reference: string;
  status: PayStatus;
  amount: number;
  label: string | null;
  billing_period: string | null;
  created_at: string;
  updated_at: string | null;
}

/** The account's most recent subscription payment, whatever became of it. */
export async function latestPayment(ownerId: string): Promise<LatestPayment | null> {
  const { data } = await supabase
    .from('payments')
    .select('reference, status, amount, label, billing_period, created_at, updated_at')
    .eq('paid_by', ownerId)
    .eq('purpose', 'subscription')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as LatestPayment | null) ?? null;
}

export type PayStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface GatewayConfig {
  app_id_set: boolean;
  secret_set: boolean;
  callback_set: boolean;
  callback_url: string | null;
  sandbox: boolean;
  usd_rate: number;
  plans: { code: string; name: string; amount: number; currency: string; active: boolean }[];
  /** Where the credentials came from — the dashboard's env vars, or Vault. */
  source: 'env' | 'vault' | 'none';
  /**
   * The one thing that being fully configured cannot prove: whether Payme
   * itself will accept this app id. A signed probe query answers that live —
   * `accepted: false` here is a Payme-side problem, not ours.
   */
  gateway: { status: number; message: string; accepted: boolean } | null;
  /** Everything a payment needs is in place, including the gateway's say-so. */
  ready: boolean;
}

export interface PayStart {
  reference: string;
  amount: number;
  usd: number;
  plan: string;
  status: PayStatus;
  message: string | null;
}

const call = <T,>(body: Record<string, unknown>) => invokeFunction<T>('subscribe', body);

/**
 * Whether payment is configured at all.
 *
 * Booleans, never the secret. "The pay button does nothing" has three very
 * different causes — no credentials, no callback URL, or a gateway that is not
 * answering — and without this they are indistinguishable from the outside.
 */
export function gatewayConfig(): Promise<GatewayConfig> {
  return call<GatewayConfig>({ action: 'config' });
}

/** Push a payment prompt to the number the client gave. */
export function startPayment(planCode: PlanCode, phone: string, period: PeriodCode = 'monthly'): Promise<PayStart> {
  return call<PayStart>({ plan_code: planCode, phone, period });
}

/**
 * Where the prompt got to.
 *
 * `provider_checked: false` means the live check itself failed — the payment is
 * not confirmed pending, we simply do not know yet. Worth asking again rather
 * than showing the client a wrong answer confidently.
 */
export function checkPayment(reference: string): Promise<{
  status: PayStatus;
  amount: number;
  provider_checked?: boolean;
  provider_message?: string | null;
}> {
  return call({ action: 'status', reference });
}

export function normalisePhone(input: string): string {
  const digits = (input || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('255')) return digits;
  if (digits.startsWith('0')) return '255' + digits.slice(1);
  if (digits.length === 9) return '255' + digits;
  return digits;
}

export function isValidPhone(input: string): boolean {
  return /^255[0-9]{9}$/.test(normalisePhone(input));
}
