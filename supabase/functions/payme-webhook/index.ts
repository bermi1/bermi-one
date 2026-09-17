// Where Payme Africa tells us how a subscription charge actually ended.
//
// JWT verification is OFF for this function, deliberately: the gateway has no
// Supabase session. The X-Middleware-Signature HMAC is the authentication, and
// it is checked before a single field of the body is read or trusted.
//
// A completed charge extends the client's subscription period and lifts any
// suspension. It never touches a client's own books: this is Bermi Techs
// collecting its fee, not the bar taking money over the counter.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { normaliseStatus, verifyCallback } from './payme_shared.ts';

const SECRET = Deno.env.get('PAYME_APP_SECRET') ?? '';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

/**
 * Keep every callback, including the ones we turn away.
 *
 * A webhook is the one part of this integration that cannot be reproduced on
 * demand. When one arrives with a reference we have never seen, or fails its
 * signature, the only way to find out why later is to have kept it.
 */
async function record(entry: {
  reference: string | null;
  signatureOk: boolean;
  handled: boolean;
  outcome: string;
  headers: Record<string, string>;
  body: unknown;
}) {
  await admin.from('webhook_events').insert({
    source: 'payme',
    reference: entry.reference,
    signature_ok: entry.signatureOk,
    handled: entry.handled,
    outcome: entry.outcome,
    headers: entry.headers,
    body: entry.body ?? {},
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  if (!SECRET) return new Response('Not configured', { status: 503 });

  const raw = await req.text();
  const timestamp = req.headers.get('X-Timestamp') ?? '';
  const signature = req.headers.get('X-Middleware-Signature') ?? '';

  // Only the headers worth keeping. Storing them all would mean storing
  // whatever else the edge happens to attach, which is not ours to retain.
  const headers = {
    'x-timestamp': timestamp,
    'x-middleware-signature': signature ? signature.slice(0, 12) + '\u2026' : '',
    'content-type': req.headers.get('content-type') ?? '',
    'user-agent': req.headers.get('user-agent') ?? '',
  };

  let body: Record<string, unknown> = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    await record({ reference: null, signatureOk: false, handled: false, outcome: 'bad_json', headers, body: { raw: raw.slice(0, 500) } });
    return new Response('Bad JSON', { status: 400 });
  }

  const signatureOk = !!signature && (await verifyCallback(raw, timestamp, signature, SECRET));
  if (!signatureOk) {
    await record({ reference: String(body.reference ?? '') || null, signatureOk: false, handled: false, outcome: 'bad_signature', headers, body });
    return new Response('Bad signature', { status: 401 });
  }

  // The developer portal fires a simulated ping to prove the URL is reachable.
  // It carries no transaction, so acknowledge it rather than hunting for one.
  const event = String(body.event ?? body.type ?? '');
  const reference = String(body.reference ?? '');
  if (event === 'test_ping' || (!reference && !body.payment_status)) {
    await record({ reference: null, signatureOk: true, handled: true, outcome: 'test_ping', headers, body });
    return new Response(JSON.stringify({ ok: true, message: 'Bermi One received the ping' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!reference) {
    await record({ reference: null, signatureOk: true, handled: false, outcome: 'no_reference', headers, body });
    return new Response('No reference', { status: 400 });
  }

  const { data: payment } = await admin
    .from('payments')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();

  if (!payment) {
    // 200, not 404: the signature was valid, so this is genuinely from the
    // gateway. Returning an error would have them retry a reference we will
    // never recognise. The row above is the trail for working out why.
    await record({ reference, signatureOk: true, handled: false, outcome: 'unknown_reference', headers, body });
    return new Response(JSON.stringify({ ok: true, message: 'Unknown reference, recorded' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const status = normaliseStatus(String(body.result || ''), String(body.payment_status || ''));

  // Callbacks can arrive twice. A subscription that extended its period once
  // must not extend it again on a repeat delivery.
  if (payment.status === 'COMPLETED') {
    await record({ reference, signatureOk: true, handled: true, outcome: 'duplicate_already_completed', headers, body });
    return new Response('ok', { status: 200 });
  }

  let outcome = `status_${status.toLowerCase()}`;

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

  await record({ reference, signatureOk: true, handled: true, outcome, headers, body });

  return new Response('ok', { status: 200 });
});
