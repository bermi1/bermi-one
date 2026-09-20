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
    | 'payments';
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

    case 'clients': {
      const { data: biz } = await admin
        .from('businesses')
        .select('id, name, type, city, country_code, owner_id, suspended, suspended_reason, created_at')
        .order('created_at', { ascending: false })
        .limit(body.limit ?? 300);
      const businesses = biz ?? [];
      if (businesses.length === 0) return json({ clients: [] });

      const ids = businesses.map((b) => b.id);
      const ownerIds = Array.from(new Set(businesses.map((b) => b.owner_id)));

      const [{ data: subs }, { data: owners }, { data: lastSessions }] = await Promise.all([
        admin.from('subscriptions').select('*, subscription_plans(code, name, amount, currency)').in('owner_id', ownerIds),
        admin.from('profiles').select('id, full_name').in('id', ownerIds),
        admin.from('stock_sessions').select('business_id, session_date').in('business_id', ids).order('session_date', { ascending: false }),
      ]);

      const subBy = new Map((subs ?? []).map((s) => [s.owner_id, s]));
      const ownerBy = new Map((owners ?? []).map((o) => [o.id, o.full_name]));
      const lastBy = new Map<string, string>();
      for (const s of lastSessions ?? []) if (!lastBy.has(s.business_id)) lastBy.set(s.business_id, s.session_date);

      const siblings = new Map<string, number>();
      for (const b of businesses) siblings.set(b.owner_id, (siblings.get(b.owner_id) ?? 0) + 1);

      return json({
        clients: businesses.map((b) => ({
          ...b,
          owner_name: ownerBy.get(b.owner_id) ?? null,
          subscription: subBy.get(b.owner_id) ?? null,
          account_businesses: siblings.get(b.owner_id) ?? 1,
          last_closing: lastBy.get(b.id) ?? null,
        })),
      });
    }

    case 'client': {
      if (!body.business_id) return json({ error: 'business_id is required' }, 400);
      const { data: business } = await admin.from('businesses').select('*').eq('id', body.business_id).maybeSingle();
      if (!business) return json({ error: 'Not found' }, 404);

      const [{ data: subscription }, { data: payments }, { data: sessions }, { data: owner }, { data: authUser }, { data: siblings }] = await Promise.all([
        admin.from('subscriptions').select('*, subscription_plans(*)').eq('owner_id', business.owner_id).maybeSingle(),
        admin.from('payments').select('*').eq('business_id', body.business_id).order('created_at', { ascending: false }).limit(20),
        admin.from('stock_sessions').select('session_date, status, total_calculated_sales').eq('business_id', body.business_id).order('session_date', { ascending: false }).limit(30),
        admin.from('profiles').select('id, full_name').eq('id', business.owner_id).maybeSingle(),
        admin.auth.admin.getUserById(business.owner_id),
        admin.from('businesses').select('id, name, suspended').eq('owner_id', business.owner_id),
      ]);

      return json({
        business,
        owner: { ...owner, email: authUser?.user?.email ?? null, last_sign_in_at: authUser?.user?.last_sign_in_at ?? null },
        subscription,
        account_businesses: siblings ?? [],
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
      if (!body.business_id) return json({ error: 'business_id is required' }, 400);
      const owner = await ownerOf(body.business_id);
      if (!owner) return json({ error: 'Not found' }, 404);

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

      const appId = Deno.env.get('PAYME_APP_ID') ?? '';
      const secret = Deno.env.get('PAYME_APP_SECRET') ?? '';
      if (!appId || !secret) return json({ error: 'Payme Africa is not configured yet.' }, 503);

      const sandbox = (Deno.env.get('PAYME_SANDBOX') ?? '1') === '1';
      const callback = Deno.env.get('PAYME_CALLBACK_URL') ?? '';
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
        business_id: body.business_id,
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
      const appId = Deno.env.get('PAYME_APP_ID') ?? '';
      const secret = Deno.env.get('PAYME_APP_SECRET') ?? '';
      if (!appId || !secret) return json({ error: 'Payme Africa is not configured yet.' }, 503);
      const sandbox = (Deno.env.get('PAYME_SANDBOX') ?? '1') === '1';

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

    default:
      return json({ error: 'Unknown action' }, 400);
  }
}
