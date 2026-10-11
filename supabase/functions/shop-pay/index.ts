// Payments for the Shop module, through Payme Africa.
//
//   order   — a customer pays an online order: a push prompt to their phone.
//             No sign-in; the order's secret token is the authority, and the
//             amount always comes from the order in the database.
//   status  — the store page (or the owner's SMS screen) asks how a prompt
//             ended. A final answer from the gateway is forwarded to
//             payme-webhook, the one place that acts on payments.
//   sms     — a shop owner buys an SMS credits pack. Needs the owner's JWT.
//
// JWT verification is off at the platform because customers have no session;
// each action checks its own authority below.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAYME_BASE = 'https://portal.paymeafrica.com/api/v1';

interface Payme { appId: string; secret: string; sandbox: boolean; callback: string }

/** Same source order as subscribe: function environment first, then Vault. */
async function paymeConfig(admin: ReturnType<typeof createClient>): Promise<Payme> {
  const env = {
    appId: Deno.env.get('PAYME_APP_ID') ?? '',
    secret: Deno.env.get('PAYME_APP_SECRET') ?? '',
    sandbox: Deno.env.get('PAYME_SANDBOX') ?? '',
    callback: Deno.env.get('PAYME_CALLBACK_URL') ?? '',
  };
  let v: Record<string, string | null> = {};
  if (!env.appId || !env.secret || !env.callback || !env.sandbox) {
    const { data } = await admin.rpc('payme_config');
    v = (data ?? {}) as Record<string, string | null>;
  }
  const sandbox = (env.sandbox || v.sandbox || '1') === '1';
  return {
    appId: env.appId || (sandbox ? (v.sandbox_app_id || v.app_id) : v.app_id) || '',
    secret: env.secret || v.secret || '',
    sandbox,
    callback: env.callback || v.callback_url || '',
  };
}

function msisdn(input: string): string {
  const digits = (input || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('255')) return digits;
  if (digits.startsWith('0')) return '255' + digits.slice(1);
  if (digits.length === 9) return '255' + digits;
  return digits;
}

async function hmac64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function signed(p: Payme, payload: Record<string, unknown>, path: string) {
  const message = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-ID': p.appId,
    'X-Timestamp': timestamp,
    'X-Signature': await hmac64(p.secret, message + timestamp),
  };
  if (p.sandbox) headers['X-Sandbox'] = '1';
  return fetch(`${PAYME_BASE}${path}`, { method: 'POST', headers, body: message });
}

/** Final outcomes go through payme-webhook, signed as Payme signs them (see subscribe). */
async function forwardToWebhook(secret: string, payload: Record<string, unknown>) {
  const raw = JSON.stringify({ ...payload, source: 'reconcile' });
  const ts = String(Math.floor(Date.now() / 1000));
  await fetch(`${SUPABASE_URL}/functions/v1/payme-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Timestamp': ts, 'X-Middleware-Signature': await hmac64(secret, raw + ts) },
    body: raw,
  });
}

function newReference(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `${prefix}_${stamp}_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

/** Insert the payment row first, then push; a gateway refusal is said plainly. */
async function push(admin: ReturnType<typeof createClient>, pm: Payme, row: Record<string, unknown>) {
  const reference = row.reference as string;
  const payload: Record<string, unknown> = {
    action: 'collection', amount: row.amount, msisdn: row.msisdn, reference,
    ...(pm.callback ? { callback_url: pm.callback } : {}),
  };
  const { error } = await admin.from('payments').insert({ ...row, direction: 'collection', channel: 'CASHIN', sandbox: pm.sandbox, request_payload: payload });
  if (error) return json({ error: error.message }, 400);

  let out: Record<string, unknown> = {};
  let httpStatus = 0;
  try {
    const res = await signed(pm, payload, '/transact');
    httpStatus = res.status;
    out = await res.json().catch(() => ({}));
  } catch (e) {
    await admin.from('payments').update({ status: 'FAILED', provider_message: String(e) }).eq('reference', reference);
    await admin.rpc('payment_failed_effects', { p_reference: reference });
    return json({ error: 'Could not reach the payment gateway. Try again in a moment.', reference }, 502);
  }
  if (httpStatus === 401 || httpStatus === 403 || (httpStatus >= 400 && out?.error)) {
    const why = String(out?.error ?? out?.message ?? `Gateway returned ${httpStatus}`);
    await admin.from('payments').update({ status: 'FAILED', provider_message: why, response_payload: out, updated_at: new Date().toISOString() }).eq('reference', reference);
    await admin.rpc('payment_failed_effects', { p_reference: reference });
    return json({ error: `The payment gateway refused the request: ${why}`, reference }, 502);
  }
  const provider = (out?.provider_response ?? {}) as Record<string, unknown>;
  await admin.from('payments').update({
    provider_transaction_id: (out?.transaction_id as string) ?? null,
    result_code: (provider.resultcode as string) ?? null,
    provider_message: (provider.message as string) ?? null,
    response_payload: out,
    updated_at: new Date().toISOString(),
  }).eq('reference', reference);
  return json({ reference, amount: row.amount, status: 'PENDING' });
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('shop-pay failed:', message);
    return json({ error: message }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE);

  let body: { action?: string; token?: string; phone?: string; reference?: string; business_id?: string; pack?: string } = {};
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  const pm = await paymeConfig(admin);

  // --- a customer paying an online order -----------------------------------
  if (body.action === 'order') {
    if (!pm.appId || !pm.secret) return json({ error: 'Online payment is not available right now. Choose another way to pay.' }, 503);
    const { data: order } = await admin.from('shop_orders')
      .select('id, business_id, number, total, status, payment_method, payment_status, customer_phone')
      .eq('token', body.token ?? '').maybeSingle();
    if (!order) return json({ error: 'Order not found' }, 404);
    if (order.payment_status === 'paid') return json({ status: 'COMPLETED' });
    if (order.status === 'cancelled') return json({ error: 'This order was cancelled.' }, 409);
    if (Number(order.total) <= 0) return json({ error: 'Nothing to pay' }, 400);

    const phone = msisdn(body.phone || order.customer_phone || '');
    if (!/^255[0-9]{9}$/.test(phone)) return json({ error: 'Enter a valid phone number.' }, 400);

    const { data: waiting } = await admin.from('payments').select('reference')
      .eq('shop_order_id', order.id).eq('status', 'PENDING')
      .gte('created_at', new Date(Date.now() - 3 * 60_000).toISOString()).limit(1).maybeSingle();
    if (waiting) return json({ error: 'A payment prompt is already waiting on the phone. Approve it, or wait 3 minutes.', code: 'PROMPT_WAITING', reference: waiting.reference }, 409);

    // Pay-by-Payme from now on, even if the customer first chose another way.
    await admin.from('shop_orders').update({ payment_method: 'payme', payment_status: 'unpaid' }).eq('id', order.id);
    const { data: biz } = await admin.from('businesses').select('name').eq('id', order.business_id).maybeSingle();
    return push(admin, pm, {
      reference: newReference('BSHP'),
      business_id: order.business_id,
      purpose: 'shop_order',
      shop_order_id: order.id,
      amount: Math.round(Number(order.total)),
      msisdn: phone,
      label: `${biz?.name ?? 'Shop'} — order #${order.number}`,
    });
  }

  // --- how did a prompt end? -----------------------------------------------
  if (body.action === 'status') {
    let q = admin.from('payments').select('reference, status, amount, provider_transaction_id, shop_order_id, paid_by');
    if (body.token) {
      const { data: order } = await admin.from('shop_orders').select('id, payment_status').eq('token', body.token).maybeSingle();
      if (!order) return json({ error: 'Not found' }, 404);
      if (order.payment_status === 'paid') return json({ status: 'COMPLETED', order_paid: true });
      q = q.eq('shop_order_id', order.id);
    } else if (body.reference) {
      // An owner checking their SMS purchase: only their own.
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
      const { data } = token ? await admin.auth.getUser(token) : { data: null };
      if (!data?.user) return json({ error: 'Not signed in' }, 401);
      q = q.eq('reference', body.reference).eq('paid_by', data.user.id);
    } else return json({ error: 'token or reference is required' }, 400);

    const { data: pay } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!pay) return json({ status: 'NONE' });
    if (pay.status !== 'PENDING' || !pm.appId || !pm.secret) return json({ status: pay.status, reference: pay.reference });

    const res = await signed(pm, { reference: pay.reference }, '/query');
    const out = await res.json().catch(() => ({}));
    const p = String(out?.payment_status ?? '').toUpperCase();
    if (out?.provider_checked !== false && (p === 'COMPLETED' || p === 'FAILED' || p === 'CANCELLED')) {
      await forwardToWebhook(pm.secret, { reference: pay.reference, result: p === 'COMPLETED' ? 'SUCCESS' : 'FAILED', payment_status: p, transid: pay.provider_transaction_id ?? null });
      const { data: after } = await admin.from('payments').select('status').eq('reference', pay.reference).maybeSingle();
      return json({ status: after?.status ?? p, reference: pay.reference });
    }
    return json({ status: 'PENDING', reference: pay.reference, provider_message: out?.provider_message ?? null });
  }

  // --- an owner buying SMS credits -----------------------------------------
  if (body.action === 'sms') {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    const { data: who } = token ? await admin.auth.getUser(token) : { data: null };
    const uid = who?.user?.id;
    if (!uid) return json({ error: 'Not signed in' }, 401);
    if (!pm.appId || !pm.secret) return json({ error: 'Payments are not configured yet.' }, 503);

    const { data: biz } = await admin.from('businesses').select('id, name').eq('id', body.business_id ?? '').eq('owner_id', uid).maybeSingle();
    if (!biz) return json({ error: 'Not your business' }, 403);

    // Packs and price live in the database; the browser only names a pack.
    const { data: cfg } = await admin.from('platform_config').select('key, value').in('key', ['sms_packs', 'sms_price_tzs']);
    const packs = (cfg?.find((c) => c.key === 'sms_packs')?.value ?? []) as { code: string; credits: number }[];
    const price = Number(cfg?.find((c) => c.key === 'sms_price_tzs')?.value ?? 30);
    const pack = packs.find((x) => x.code === body.pack);
    if (!pack) return json({ error: 'Unknown pack' }, 400);

    const phone = msisdn(body.phone ?? '');
    if (!/^255[0-9]{9}$/.test(phone)) return json({ error: 'Enter a valid phone number.' }, 400);

    return push(admin, pm, {
      reference: newReference('BSMS'),
      business_id: biz.id,
      purpose: 'sms_credits',
      sms_credits: pack.credits,
      amount: Math.round(pack.credits * price),
      msisdn: phone,
      paid_by: uid,
      created_by: uid,
      label: `${biz.name} — ${pack.credits.toLocaleString('en')} SMS credits`,
    });
  }

  return json({ error: 'Unknown action' }, 400);
}
