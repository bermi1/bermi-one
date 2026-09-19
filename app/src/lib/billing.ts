// Paying for a subscription, from the client's side.
//
// The browser names a plan CODE and a phone number, nothing more. The price
// comes from the database inside the edge function, and the account comes from
// the caller's own JWT — because a browser that can name the amount is a
// browser that can name a smaller one, and a browser that can name the account
// is a browser that can top up someone else's.

import { supabase } from './supabase';
import type { PlanCode } from './plans';

export type PayStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface PayStart {
  reference: string;
  amount: number;
  usd: number;
  plan: string;
  status: PayStatus;
  message: string | null;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('subscribe', { body });
  if (error) throw new Error(error.message);
  const out = data as T & { error?: string };
  if (out?.error) throw new Error(out.error);
  return out;
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
