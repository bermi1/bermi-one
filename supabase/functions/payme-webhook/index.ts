// Where Payme Africa tells us how a subscription charge actually ended.
//
// This endpoint is public — the gateway has no Supabase session — so the
// signature is the only thing standing between it and anyone who can guess a
// reference. An unverified callback is dropped, not "handled leniently".
//
// A completed charge extends the client's subscription period and lifts any
// suspension. It never touches a client's own books: this is Bermi Techs
// collecting its fee, not the bar taking money over the counter.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { normaliseStatus, verifyCallback } from './payme_shared.ts';

const SECRET = Deno.env.get('PAYME_APP_SECRET') ?? '';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  if (!SECRET) return new Response('Not configured', { status: 503 });

  const raw = await req.text();
  const timestamp = req.headers.get('X-Timestamp') ?? '';
  const signature = req.headers.get('X-Middleware-Signature') ?? '';
  if (!signature || !(await verifyCallback(raw, timestamp, signature, SECRET))) {
    return new Response('Bad signature', { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const reference = String(body.reference || '');
  if (!reference) return new Response('No reference', { status: 400 });

  // The service role is needed here: there is no user session behind a webhook,
  // and the row belongs to a business this request cannot prove membership of.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: payment } = await admin
    .from('payments')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();
  if (!payment) return new Response('Unknown reference', { status: 404 });

  const status = normaliseStatus(String(body.result || ''), String(body.payment_status || ''));

  // Callbacks can arrive twice. A subscription that extended its period once
  // must not extend it again on a repeat delivery.
  if (payment.status === 'COMPLETED') return new Response('ok', { status: 200 });

  if (status === 'COMPLETED' && payment.purpose === 'subscription' && payment.subscription_id) {
    const { data: sub } = await admin
      .from('subscriptions')
      .select('*, subscription_plans(interval_days)')
      .eq('id', payment.subscription_id)
      .maybeSingle();

    if (sub) {
      // Extend from whichever is later: the end of the period they already paid
      // for, or now. Paying early should add time, not throw the rest away;
      // paying late should not back-date the new period into the past.
      const days = sub.subscription_plans?.interval_days ?? 30;
      const existingEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
      const base = existingEnd && existingEnd > new Date() ? existingEnd : new Date();
      const end = new Date(base.getTime() + days * 86_400_000);

      await admin
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: end.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id);

      // Settling the bill lifts the block. Nothing else here reads suspension,
      // so this is the one place that has to remember to clear it.
      await admin
        .from('businesses')
        .update({ suspended: false, suspended_reason: null, suspended_at: null })
        .eq('id', payment.business_id);
    }
  }

  await admin
    .from('payments')
    .update({
      status,
      provider_transaction_id: (body.transid as string) ?? payment.provider_transaction_id,
      callback_payload: body,
      updated_at: new Date().toISOString(),
    })
    .eq('reference', reference);

  return new Response('ok', { status: 200 });
});
