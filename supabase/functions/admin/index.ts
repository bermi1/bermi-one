// The Bermi Techs console, server side.
//
// Everything here runs with the service role, which bypasses row level
// security entirely — so the very first thing every request does is prove the
// caller is a platform admin, from a token the auth server has verified. If
// that check is not the first gate, this function is a hole straight through
// every tenant's data.
//
// A subscription belongs to an ACCOUNT, not a business: Standard covers three
// businesses for $30, so billing per business would charge that person $90 for
// what they were sold as $30. Every join below goes through businesses.owner_id.

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
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') ?? '';

/**
 * Who is calling, from the bearer token alone — no anon key needed.
 * See the same note in supabase/functions/subscribe/index.ts.
 */
async function callerOf(req: Request, admin: ReturnType<typeof createClient>) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data?.user ?? null;
}


/** Payme credentials: environment first, then Vault. Same rule as subscribe. */
async function paymeConfig(admin: ReturnType<typeof createClient>) {
  const envApp = Deno.env.get('PAYME_APP_ID') ?? '';
  const envSecret = Deno.env.get('PAYME_APP_SECRET') ?? '';
  const envSandbox = Deno.env.get('PAYME_SANDBOX') ?? '';
  const envCallback = Deno.env.get('PAYME_CALLBACK_URL') ?? '';
  let v: Record<string, string | null> = {};
  if (!envApp || !envSecret || !envCallback || !envSandbox) {
    const { data } = await admin.rpc('payme_config');
    v = (data ?? {}) as Record<string, string | null>;
  }
  const sandbox = (envSandbox || v.sandbox || '1') === '1';
  return {
    appId: envApp || (sandbox ? (v.sandbox_app_id || v.app_id) : v.app_id) || '',
    secret: envSecret || v.secret || '',
    sandbox,
    callback: envCallback || v.callback_url || '',
  };
}

interface Body {
  action:
    | 'overview'
    | 'clients'
    | 'client'
    | 'set_suspended'
    | 'set_subscription'
    | 'reset_password'
    | 'charge_subscription'
    | 'query_payment'
    | 'payments'
    | 'set_payme_config'
    | 'test_payme';
  business_id?: string;
  owner_id?: string;
  user_id?: string;
  email?: string;
  suspended?: boolean;
  reason?: string;
  plan_id?: string;
  status?: string;
  period_days?: number;
  billing_phone?: string;
  notes?: string;
  amount?: number;
  reference?: string;
  limit?: number;
  query?: string;
  app_id?: string;
  sandbox_app_id?: string;
  secret?: string;
  sandbox?: boolean;
}

/**
 * One signed /query for a reference that cannot exist. Payme answers 401
 * "Invalid or Inactive App ID" when it does not recognise the app, and
 * something else (404, a JSON body) once it does — which is the whole
 * question this asks.
 */
async function probePayme(appId: string, secret: string, sandbox: boolean) {
  if (!appId || !secret) return { app_id: appId || null, sandbox, status: 0, message: 'Not set', accepted: false };
  const message = JSON.stringify({ reference: 'BSUB_PROBE_HQ' });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message + timestamp));
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-ID': appId,
    'X-Timestamp': timestamp,
    'X-Signature': btoa(String.fromCharCode(...new Uint8Array(sig))),
  };
  if (sandbox) headers['X-Sandbox'] = '1';
  try {
    const res = await fetch('https://portal.paymeafrica.com/api/v1/query', { method: 'POST', headers, body: message });
    const text = await res.text();
    let msg = text.slice(0, 200);
    try { const j = JSON.parse(text); msg = j.error || j.message || j.provider_message || msg; } catch { /* keep text */ }
    return { app_id: appId, sandbox, status: res.status, message: msg || `HTTP ${res.status}`, accepted: res.status !== 401 && res.status !== 403 };
  } catch (e) {
    return { app_id: appId, sandbox, status: 0, message: e instanceof Error ? e.message : String(e), accepted: false };
  }
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('admin failed:', message);
    return json({ error: message }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE);

  // Step one, always: who is asking, and are they staff?
  const user = await callerOf(req, admin);
  if (!user) return json({ error: 'Not signed in' }, 401);

  /*
    The same membership test is_platform_admin() makes, asked directly.
    The RPC reads auth.uid(), so it has to run as the caller — and building a
    caller-scoped client is exactly the thing that was throwing. The service
    client reads platform_admins regardless of RLS, and the id comes from a
    verified token, so the check is the same one.
  */
  const { data: staffRow } = await admin
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!staffRow) return json({ error: 'Not a platform administrator' }, 403);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad JSON' }, 400);
  }

  /** Resolve the account behind a business, since billing lives on the account. */
  async function ownerOf(businessId: string): Promise<string | null> {
    const { data } = await admin.from('businesses').select('owner_id').eq('id', businessId).maybeSingle();
    return data?.owner_id ?? null;
  }

  switch (body.action) {
    case 'overview': {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [businesses, subs, sessions, payments] = await Promise.all([
        admin.from('businesses').select('id, owner_id, suspended, created_at'),
        admin.from('subscriptions').select('status, current_period_end, trial_ends_at, plan_id, subscription_plans(amount, currency)'),
        admin.from('stock_sessions').select('business_id, session_date, status').gte('session_date', since.slice(0, 10)),
        admin.from('payments').select('amount, status, created_at').gte('created_at', since),
      ]);

      const biz = businesses.data ?? [];
      const subRows = (subs.data ?? []) as { status: string; subscription_plans: { amount: number } | null }[];
      const active = subRows.filter((s) => s.status === 'active');
      // Monthly recurring revenue counts only accounts that are actually
      // paying. Trials and suspended clients are pipeline, not revenue, and
      // mixing the two is how a dashboard starts lying to the people running
      // the company on it.
      const mrr = active.reduce((sum, s) => sum + (s.subscription_plans?.amount ?? 0), 0);

      const sess = sessions.data ?? [];
      const paid = (payments.data ?? []).filter((p) => p.status === 'COMPLETED');

      return json({
        businesses: biz.length,
        accounts: new Set(biz.map((b) => b.owner_id)).size,
        suspended: biz.filter((b) => b.suspended).length,
        newThisMonth: biz.filter((b) => b.created_at >= since).length,
        subscriptions: {
          active: active.length,
          trialing: subRows.filter((s) => s.status === 'trialing').length,
          pastDue: subRows.filter((s) => s.status === 'past_due').length,
          suspended: subRows.filter((s) => s.status === 'suspended').length,
          cancelled: subRows.filter((s) => s.status === 'cancelled').length,
        },
        mrr,
        currency: 'USD',
        activeLast30: new Set(sess.map((s) => s.business_id)).size,
        closingsLast30: sess.length,
        verifiedLast30: sess.filter((s) => s.status === 'verified').length,
        collectedLast30: paid.reduce((sum, p) => sum + p.amount, 0),
      });
    }

    /*
      Clients are ACCOUNTS.

      A plan is bought once per account and covers every business in it, so
      listing businesses put the same person — with the same subscription —
      on the screen once per bar. One row per owner now, with their
      businesses nested inside it.
    */
    case 'clients': {
      const { data: biz } = await admin
        .from('businesses')
        .select('id, name, type, city, country_code, owner_id, suspended, suspended_reason, created_at, sort_order')
        .order('created_at', { ascending: true })
        .limit(2000);
      const businesses = biz ?? [];
      if (businesses.length === 0) return json({ clients: [] });

      const ids = businesses.map((b) => b.id);
      const ownerIds = Array.from(new Set(businesses.map((b) => b.owner_id)));

      const [{ data: subs }, { data: owners }, { data: lastSessions }, users] = await Promise.all([
        admin.from('subscriptions').select('*, subscription_plans(code, name, amount, currency)').in('owner_id', ownerIds),
        admin.from('profiles').select('id, full_name').in('id', ownerIds),
        admin.from('stock_sessions').select('business_id, session_date').in('business_id', ids).order('session_date', { ascending: false }),
        Promise.all(ownerIds.map((id) => admin.auth.admin.getUserById(id))),
      ]);

      const subBy = new Map((subs ?? []).map((s) => [s.owner_id, s]));
      const nameBy = new Map((owners ?? []).map((o) => [o.id, o.full_name]));
      const emailBy = new Map<string, string | null>();
      users.forEach((u, i) => emailBy.set(ownerIds[i], u.data?.user?.email ?? null));
      const lastBy = new Map<string, string>();
      for (const row of lastSessions ?? []) if (!lastBy.has(row.business_id)) lastBy.set(row.business_id, row.session_date);

      const clients = ownerIds.map((owner) => {
        const mine = businesses
          .filter((b) => b.owner_id === owner)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((b) => ({
            id: b.id, name: b.name, type: b.type, city: b.city, country_code: b.country_code,
            suspended: b.suspended, suspended_reason: b.suspended_reason, created_at: b.created_at,
            last_closing: lastBy.get(b.id) ?? null,
          }));
        const closings = mine.map((b) => b.last_closing).filter(Boolean) as string[];
        return {
          owner_id: owner,
          owner_name: nameBy.get(owner) ?? null,
          owner_email: emailBy.get(owner) ?? null,
          created_at: mine[0]?.created_at ?? null,
          subscription: subBy.get(owner) ?? null,
          businesses: mine,
          businesses_count: mine.length,
          suspended_count: mine.filter((b) => b.suspended).length,
          last_closing: closings.sort().reverse()[0] ?? null,
        };
      });

      // Newest accounts first — that is who support is most likely looking for.
      clients.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return json({ clients });
    }

    case 'client': {
      // An account. business_id still works, resolved to its owner, so a
      // screen open during the deploy does not break.
      const owner = body.owner_id ?? (body.business_id ? await ownerOf(body.business_id) : null);
      if (!owner) return json({ error: 'owner_id is required' }, 400);

      const [{ data: businesses }, { data: subscription }, { data: profile }, { data: authUser }] = await Promise.all([
        admin.from('businesses').select('*').eq('owner_id', owner).order('sort_order'),
        admin.from('subscriptions').select('*, subscription_plans(*)').eq('owner_id', owner).maybeSingle(),
        admin.from('profiles').select('id, full_name').eq('id', owner).maybeSingle(),
        admin.auth.admin.getUserById(owner),
      ]);
      if (!businesses || businesses.length === 0) return json({ error: 'Not found' }, 404);

      const ids = businesses.map((b) => b.id);
      const [{ data: payments }, { data: sessions }] = await Promise.all([
        admin.from('payments').select('*').or(`paid_by.eq.${owner},business_id.in.(${ids.join(',')})`).order('created_at', { ascending: false }).limit(30),
        admin.from('stock_sessions').select('business_id, session_date, status, total_calculated_sales').in('business_id', ids).order('session_date', { ascending: false }).limit(40),
      ]);

      return json({
        owner: { id: owner, full_name: profile?.full_name ?? null, email: authUser?.user?.email ?? null, last_sign_in_at: authUser?.user?.last_sign_in_at ?? null },
        subscription,
        businesses,
        payments: payments ?? [],
        sessions: sessions ?? [],
      });
    }

    case 'set_suspended': {
      if (!body.business_id) return json({ error: 'business_id is required' }, 400);
      const suspended = !!body.suspended;
      const { error } = await admin
        .from('businesses')
        .update({
          suspended,
          suspended_reason: suspended ? (body.reason ?? null) : null,
          suspended_at: suspended ? new Date().toISOString() : null,
        })
        .eq('id', body.business_id);
      if (error) return json({ error: error.message }, 400);

      // The subscription only follows when the WHOLE account is blocked.
      // Suspending one bar out of three is a support action, not a billing
      // event, and flipping the account's status would cut off the others.
      const owner = await ownerOf(body.business_id);
      if (owner) {
        const { data: all } = await admin.from('businesses').select('suspended').eq('owner_id', owner);
        const everyOneBlocked = (all ?? []).length > 0 && (all ?? []).every((b) => b.suspended);
        if (everyOneBlocked || !suspended) {
          await admin
            .from('subscriptions')
            .update({ status: everyOneBlocked ? 'suspended' : 'active', updated_at: new Date().toISOString() })
            .eq('owner_id', owner);
        }
      }

      return json({ ok: true, suspended });
    }

    case 'set_subscription': {
      const owner = body.owner_id ?? (body.business_id ? await ownerOf(body.business_id) : null);
      if (!owner) return json({ error: 'business_id or owner_id is required' }, 400);

      const patch: Record<string, unknown> = { owner_id: owner, updated_at: new Date().toISOString() };
      if (body.plan_id) patch.plan_id = body.plan_id;
      if (body.status) patch.status = body.status;
      if (body.billing_phone !== undefined) patch.billing_phone = body.billing_phone;
      if (body.notes !== undefined) patch.notes = body.notes;
      if (body.period_days) {
        const start = new Date();
        patch.current_period_start = start.toISOString();
        patch.current_period_end = new Date(start.getTime() + body.period_days * 86_400_000).toISOString();
      }
      const { data, error } = await admin.from('subscriptions').upsert(patch, { onConflict: 'owner_id' }).select().single();
      if (error) return json({ error: error.message }, 400);

      // Paying up lifts the block on every business in the account: the reason
      // for it is gone, and leaving one bar dark would be a support ticket.
      if (body.status === 'active') {
        await admin.from('businesses').update({ suspended: false, suspended_reason: null, suspended_at: null }).eq('owner_id', owner);
      }
      return json({ subscription: data });
    }

    case 'reset_password': {
      if (!body.email) return json({ error: 'email is required' }, 400);
      // A recovery link, not a new password: support staff should never be
      // able to read or set a client's password, only to send them a way back in.
      const { data, error } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: body.email,
        options: SITE_URL ? { redirectTo: SITE_URL } : undefined,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, action_link: data?.properties?.action_link ?? null });
    }

    case 'payments': {
      const { data } = await admin
        .from('payments')
        .select('*, businesses(name)')
        .order('created_at', { ascending: false })
        .limit(body.limit ?? 60);
      return json({ payments: data ?? [] });
    }

    case 'charge_subscription': {
      const owner = body.owner_id ?? (body.business_id ? await ownerOf(body.business_id) : null);
      if (!owner) return json({ error: 'business_id or owner_id is required' }, 400);

      // Any one business under the account carries the charge, purely so it
      // has somewhere to sit for the per-account payments list — billing
      // itself is the account's, which is why owner_id alone is enough above.
      const businessId = body.business_id ?? (await admin.from('businesses').select('id').eq('owner_id', owner).order('sort_order').limit(1).maybeSingle()).data?.id ?? null;

      const { data: sub } = await admin
        .from('subscriptions')
        .select('*, subscription_plans(amount, currency, name)')
        .eq('owner_id', owner)
        .maybeSingle();
      if (!sub) return json({ error: 'This account has no subscription yet.' }, 400);

      const phone = body.billing_phone || sub.billing_phone;
      if (!phone) return json({ error: 'No billing phone on file for this account.' }, 400);

      // The plan is priced in USD; the gateway collects TZS. Converting here,
      // at charge time, is the only place a rate should ever be applied — the
      // stored price must not drift with the market.
      const usd = Number(sub.subscription_plans?.amount ?? 0);
      const rate = Number(Deno.env.get('USD_TZS_RATE') ?? '2650');
      const amount = Math.round(Number(body.amount ?? usd * rate));
      if (amount <= 0) return json({ error: 'Nothing to charge — the plan has no amount.' }, 400);

      const { appId, secret, sandbox, callback } = await paymeConfig(admin);
      if (!appId || !secret) return json({ error: 'Payme Africa is not configured yet.' }, 503);
      const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
      const reference = `BSUB_${stamp}_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

      const payload: Record<string, unknown> = {
        action: 'collection',
        amount,
        msisdn: phone,
        reference,
        ...(callback ? { callback_url: callback } : {}),
      };

      await admin.from('payments').insert({
        business_id: businessId,
        paid_by: owner,
        subscription_id: sub.id,
        purpose: 'subscription',
        reference,
        direction: 'collection',
        amount,
        msisdn: phone,
        channel: 'CASHIN',
        label: `Bermi One — ${sub.subscription_plans?.name ?? 'subscription'} ($${usd})`,
        sandbox,
        request_payload: payload,
        created_by: user.id,
      });

      const message = JSON.stringify(payload);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message + timestamp));
      const signature = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-App-ID': appId,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
      };
      if (sandbox) headers['X-Sandbox'] = '1';

      let out: Record<string, unknown>;
      try {
        const res = await fetch('https://portal.paymeafrica.com/api/v1/transact', { method: 'POST', headers, body: message });
        out = await res.json();
      } catch (e) {
        await admin.from('payments').update({ status: 'FAILED', provider_message: String(e) }).eq('reference', reference);
        return json({ error: 'Could not reach Payme Africa.', reference }, 502);
      }

      await admin
        .from('payments')
        .update({
          provider_transaction_id: (out?.transaction_id as string) ?? null,
          response_payload: out,
          updated_at: new Date().toISOString(),
        })
        .eq('reference', reference);

      return json({ reference, amount, usd, response: out });
    }

    case 'query_payment': {
      if (!body.reference) return json({ error: 'reference is required' }, 400);
      const { appId, secret, sandbox } = await paymeConfig(admin);
      if (!appId || !secret) return json({ error: 'Payme Africa is not configured yet.' }, 503);

      const message = JSON.stringify({ reference: body.reference });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message + timestamp));
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-App-ID': appId,
        'X-Timestamp': timestamp,
        'X-Signature': btoa(String.fromCharCode(...new Uint8Array(sigBytes))),
      };
      if (sandbox) headers['X-Sandbox'] = '1';

      const res = await fetch('https://portal.paymeafrica.com/api/v1/query', { method: 'POST', headers, body: message });
      const out = await res.json();

      // provider_checked: false means the live check failed, not that the
      // payment is confirmed pending — do not write that through as an answer.
      if (out?.provider_checked !== false) {
        const p = String(out?.payment_status ?? '').toUpperCase();
        const status = p === 'COMPLETED' ? 'COMPLETED' : p === 'FAILED' ? 'FAILED' : p === 'CANCELLED' ? 'CANCELLED' : 'PENDING';
        await admin.from('payments').update({ status, updated_at: new Date().toISOString() }).eq('reference', body.reference);
      }
      return json(out, res.status);
    }

    /*
      Credentials, from the console. Goes into Vault through a function only
      the service role can call; nothing comes back but "saved", so the
      secret is write-only from the moment it is typed.
    */
    case 'set_payme_config': {
      const { error } = await admin.rpc('set_payme_config', {
        p_app_id: body.app_id?.trim() || null,
        p_sandbox_app_id: body.sandbox_app_id?.trim() || null,
        p_secret: body.secret?.trim() || null,
        p_sandbox: body.sandbox === undefined ? null : body.sandbox ? '1' : '0',
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // Both modes in one tap: which app id, if either, Payme accepts right now.
    case 'test_payme': {
      const { data } = await admin.rpc('payme_config');
      const v = (data ?? {}) as Record<string, string | null>;
      const secret = Deno.env.get('PAYME_APP_SECRET') || v.secret || '';
      const liveId = Deno.env.get('PAYME_APP_ID') || v.app_id || '';
      const testId = v.sandbox_app_id || liveId;
      const [live, sandbox] = await Promise.all([probePayme(liveId, secret, false), probePayme(testId, secret, true)]);
      return json({ mode: (Deno.env.get('PAYME_SANDBOX') || v.sandbox || '1') === '1' ? 'sandbox' : 'live', live, sandbox });
    }

    default:
      return json({ error: 'Unknown action' }, 400);
  }
}
