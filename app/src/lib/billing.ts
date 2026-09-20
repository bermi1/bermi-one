// Paying for a subscription, from the client's side.
//
// The browser names a plan CODE and a phone number, nothing more. The price
// comes from the database inside the edge function, and the account comes from
// the caller's own JWT — because a browser that can name the amount is a
// browser that can name a smaller one, and a browser that can name the account
// is a browser that can top up someone else's.

import { invokeFunction } from './functions';
import type { PlanCode } from './plans';

export type PayStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface GatewayConfig {
  app_id_set: boolean;
  secret_set: boolean;
  callback_set: boolean;
  callback_url: string | null;
  sandbox: boolean;
  usd_rate: number;
  plans: { code: string; name: string; amount: number; currency: string; active: boolean }[];
  /** Everything a payment needs is in place. */
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
export function startPayment(planCode: PlanCode, phone: string): Promise<PayStart> {
  return call<PayStart>({ plan_code: planCode, phone });
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
