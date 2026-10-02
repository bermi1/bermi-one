// Asks Payme about payments still pending, every minute, so an outcome lands
// in minutes rather than whenever the provider's own callback gets round to
// it (it has taken 5–12 hours).
//
// Run by pg_cron through pg_net. JWT verification is off — there is no user —
// so the caller has to present the key kept in Vault, or nothing happens.
// Final outcomes are not written here: they are forwarded, signed, to
// payme-webhook, the one place that activates a plan.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const PAYME_BASE = 'https://portal.paymeafrica.com/api/v1';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function hmac64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

Deno.serve(async (req) => {
  try {
    const { data: key } = await admin.rpc('payme_reconcile_key');
    if (!key || req.headers.get('x-reconcile-key') !== key) return json({ error: 'Forbidden' }, 401);

    const { data: cfg } = await admin.rpc('payme_config');
    const v = (cfg ?? {}) as Record<string, string | null>;
    const secret = Deno.env.get('PAYME_APP_SECRET') || v.secret || '';
    const sandbox = (Deno.env.get('PAYME_SANDBOX') || v.sandbox || '1') === '1';
    const appId = Deno.env.get('PAYME_APP_ID') || (sandbox ? (v.sandbox_app_id || v.app_id) : v.app_id) || '';
    if (!secret || !appId) return json({ error: 'Payme not configured' }, 503);

    // Oldest first, a handful per run: Payme allows 30 requests a minute per
    // IP and one live check per transaction every 30 seconds.
    const now = Date.now();
    const { data: pending } = await admin
      .from('payments')
      .select('reference, provider_transaction_id, sandbox')
      .eq('status', 'PENDING')
      .not('provider_transaction_id', 'is', null)
      .lte('created_at', new Date(now - 45_000).toISOString())
      .gte('created_at', new Date(now - 24 * 3600_000).toISOString())
      .order('created_at', { ascending: true })
      .limit(10);

    const results: { reference: string; payment_status: string; forwarded: boolean }[] = [];
    for (const p of pending ?? []) {
      const body = JSON.stringify({ reference: p.reference });
      const ts = String(Math.floor(Date.now() / 1000));
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-App-ID': appId,
        'X-Timestamp': ts,
        'X-Signature': await hmac64(secret, body + ts),
      };
      if (p.sandbox) headers['X-Sandbox'] = '1';

      let out: Record<string, unknown> = {};
      try {
        const res = await fetch(`${PAYME_BASE}/query`, { method: 'POST', headers, body });
        out = await res.json().catch(() => ({}));
      } catch { continue; }

      const status = String(out.payment_status ?? '').toUpperCase();
      const final = status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED';
      let forwarded = false;
      if (final && out.provider_checked !== false) {
        const raw = JSON.stringify({
          reference: p.reference,
          result: status === 'COMPLETED' ? 'SUCCESS' : 'FAILED',
          payment_status: status,
          transid: p.provider_transaction_id,
          source: 'reconcile',
        });
        const ts2 = String(Math.floor(Date.now() / 1000));
        const res = await fetch(`${SUPABASE_URL}/functions/v1/payme-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Timestamp': ts2, 'X-Middleware-Signature': await hmac64(secret, raw + ts2) },
          body: raw,
        });
        forwarded = res.ok;
      }
      results.push({ reference: p.reference, payment_status: status || 'UNKNOWN', forwarded });
    }
    return json({ checked: results.length, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('payme-reconcile failed:', message);
    return json({ error: message }, 500);
  }
});
