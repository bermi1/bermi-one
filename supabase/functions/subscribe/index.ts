// Self-serve subscription payment.
//
// The client pays for themselves: they pick a plan, give the number that holds
// the money, and get a USSD prompt. Bermi Techs charging on their behalf still
// works, but a product that can only be paid for by ringing support is a
// product that does not get paid for.
//
// The caller's JWT is what identifies the account. Everything below is keyed to
// auth.uid() and never to anything the browser sent — a body field naming whose
// subscription to extend would let anyone pay a dollar onto someone else's
// account, or worse, name a plan the price does not match.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const APP_ID = Deno.env.get('PAYME_APP_ID') ?? '';
const SECRET = Deno.env.get('PAYME_APP_SECRET') ?? '';
const SANDBOX = (Deno.env.get('PAYME_SANDBOX') ?? '1') === '1';
const CALLBACK = Deno.env.get('PAYME_CALLBACK_URL') ?? '';
const RATE = Number(Deno.env.get('USD_TZS_RATE') ?? '2650');

/** Tanzanian numbers reach the gateway as 255XXXXXXXXX. People type them every other way. */
function msisdn(input: string): string {
  const digits = (input || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('255')) return digits;
  if (digits.startsWith('0')) return '255' + digits.slice(1);
  if (digits.length === 9) return '255' + digits;
  return digits;
}

async function signed(payload: Record<string, unknown>, path: string) {
  const message = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message + timestamp));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-ID': APP_ID,
    'X-Timestamp': timestamp,
    'X-Signature': btoa(String.fromCharCode(...new Uint8Array(sig))),
  };
  if (SANDBOX) headers['X-Sandbox'] = '1';

  return fetch(`https://portal.paymeafrica.com/api/v1${path}`, { method: 'POST', headers, body: message });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json({ error: 'Not signed in' }, 401);

  const asCaller = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: auth } = await asCaller.auth.getUser();
  if (!auth?.user) return json({ error: 'Not signed in' }, 401);
  const uid = auth.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE);

  let body: { action?: string; plan_code?: string; phone?: string; reference?: string } = {};
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }

  /*
    Is payment even configured?

    Booleans only — never the secret, never the app id. The point is that "the
    payment button does nothing" stops being a guess: a missing callback URL
    leaves the gateway with nowhere to report to, so every charge sits PENDING
    for ever and looks identical to a charge nobody answered. This says which.
  */
  if (body.action === 'config') {
    const { data: plans } = await admin
      .from('subscription_plans')
      .select('code, name, amount, currency, active')
      .eq('active', true)
      .order('amount');

    return json({
      app_id_set: !!APP_ID,
      secret_set: !!SECRET,
      callback_set: !!CALLBACK,
      callback_url: CALLBACK || null,
      sandbox: SANDBOX,
      usd_rate: RATE,
      plans: plans ?? [],
      ready: !!APP_ID && !!SECRET && !!CALLBACK && (plans?.length ?? 0) > 0,
    });
  }

  // --- checking on a prompt already sent ----------------------------------
  if (body.action === 'status') {
    if (!body.reference) return json({ error: 'reference is required' }, 400);

    // Scoped to this account: a reference is guessable, and someone else's
    // payment status is not this caller's to read.
    const { data: mine } = await admin
      .from('payments')
      .select('reference, status, amount')
      .eq('reference', body.reference)
      .eq('paid_by', uid)
      .maybeSingle();
    if (!mine) return json({ error: 'Not found' }, 404);

    // Already settled by the webhook — no need to trouble the gateway.
    if (mine.status !== 'PENDING') return json({ status: mine.status, amount: mine.amount });

    if (!APP_ID || !SECRET) return json({ status: mine.status, amount: mine.amount });

    const res = await signed({ reference: body.reference }, '/query');
    const out = await res.json().catch(() => ({}));

    // provider_checked: false means the live check itself failed, not that the
    // payment is confirmed pending. Writing that through would turn "we do not
    // know" into "we asked and it is still waiting".
    if (out?.provider_checked !== false) {
      const p = String(out?.payment_status ?? '').toUpperCase();
      const status = p === 'COMPLETED' ? 'COMPLETED' : p === 'FAILED' ? 'FAILED' : p === 'CANCELLED' ? 'CANCELLED' : 'PENDING';
      if (status !== mine.status) {
        await admin.from('payments').update({ status, updated_at: new Date().toISOString() }).eq('reference', body.reference);
      }
      return json({ status, amount: mine.amount, provider_message: out?.provider_message ?? null });
    }

    return json({ status: 'PENDING', amount: mine.amount, provider_checked: false, provider_message: out?.provider_message ?? null });
  }

  // --- starting a payment --------------------------------------------------
  if (!APP_ID || !SECRET) return json({ error: 'Payments are not configured yet.' }, 503);

  const phone = msisdn(body.phone ?? '');
  if (!/^255[0-9]{9}$/.test(phone)) return json({ error: 'Enter a valid phone number.' }, 400);

  // The plan is looked up by code and priced from the database. The browser
  // saying what it costs would make the price a suggestion.
  const { data: plan } = await admin
    .from('subscription_plans')
    .select('id, code, name, amount, currency')
    .eq('code', body.plan_code ?? '')
    .eq('active', true)
    .maybeSingle();
  if (!plan) return json({ error: 'Unknown plan' }, 400);

  const { data: sub } = await admin
    .from('subscriptions')
    .select('id')
    .eq('owner_id', uid)
    .maybeSingle();

  // One business of theirs, purely so the payment has somewhere to sit for the
  // console's per-client view. Billing itself is the account's.
  const { data: biz } = await admin
    .from('businesses')
    .select('id')
    .eq('owner_id', uid)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  const usd = Number(plan.amount);
  const amount = Math.round(usd * RATE);
  if (amount <= 0) return json({ error: 'That plan has no price set.' }, 400);

  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const reference = `BSUB_${stamp}_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  const payload: Record<string, unknown> = {
    action: 'collection',
    amount,
    msisdn: phone,
    reference,
    ...(CALLBACK ? { callback_url: CALLBACK } : {}),
  };

  // Written before the call: if the gateway answers and we then fail, the
  // reference still exists to reconcile against.
  const { error: insertError } = await admin.from('payments').insert({
    business_id: biz?.id ?? null,
    subscription_id: sub?.id ?? null,
    purpose: 'subscription',
    reference,
    direction: 'collection',
    amount,
    msisdn: phone,
    channel: 'CASHIN',
    label: `Bermi One — ${plan.name} ($${usd})`,
    sandbox: SANDBOX,
    request_payload: payload,
    created_by: uid,
    paid_by: uid,
    plan_code: plan.code,
  });
  if (insertError) return json({ error: insertError.message }, 400);

  let out: Record<string, unknown>;
  try {
    const res = await signed(payload, '/transact');
    out = await res.json();
  } catch (e) {
    await admin.from('payments').update({ status: 'FAILED', provider_message: String(e) }).eq('reference', reference);
    return json({ error: 'Could not reach the payment gateway. Try again in a moment.', reference }, 502);
  }

  const provider = (out?.provider_response ?? {}) as Record<string, unknown>;
  await admin.from('payments').update({
    provider_transaction_id: (out?.transaction_id as string) ?? null,
    result_code: (provider.resultcode as string) ?? null,
    provider_message: (provider.message as string) ?? null,
    response_payload: out,
    updated_at: new Date().toISOString(),
  }).eq('reference', reference);

  return json({
    reference,
    amount,
    usd,
    plan: plan.name,
    status: 'PENDING',
    message: (provider.message as string) ?? null,
  });
});
