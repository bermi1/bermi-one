// Closing an account, and meaning it.
//
// Google and Apple both require that an account created in the app can be
// destroyed from inside the app. This is that path, and it is deliberately
// narrow: the only account it will ever delete is the one belonging to the JWT
// that called it. There is no id in the request body to get wrong, and no
// parameter an attacker could aim at somebody else.
//
// Deleting the auth user cascades to the profile, the businesses, and through
// them to products, stock sessions, ledger entries, staff, notifications and
// the action log. Payment rows survive with their business link nulled: they
// are the accounting record of a transaction between two companies, and they
// are not the client's to erase.

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json({ error: 'Not signed in' }, 401);

  const asCaller = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: auth } = await asCaller.auth.getUser();
  if (!auth?.user) return json({ error: 'Not signed in' }, 401);
  const uid = auth.user.id;

  // Typed by hand on the confirmation screen. It is the difference between a
  // mis-tap on a phone in a loud bar and a decision.
  let body: { confirm?: string } = {};
  try { body = await req.json(); } catch { /* an empty body is a missing confirmation */ }
  if ((body.confirm ?? '').trim().toUpperCase() !== 'DELETE') {
    return json({ error: 'Type DELETE to confirm.' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE);

  // Count first, so the caller can be told what went — and so the response is
  // evidence rather than a reassuring noise.
  const { data: businesses } = await admin.from('businesses').select('id').eq('owner_id', uid);
  const businessIds = (businesses ?? []).map((b: { id: string }) => b.id);

  let sessions = 0;
  let entries = 0;
  let products = 0;
  if (businessIds.length) {
    const counted = await Promise.all([
      admin.from('stock_sessions').select('id', { count: 'exact', head: true }).in('business_id', businessIds),
      admin.from('ledger_entries').select('id', { count: 'exact', head: true }).in('business_id', businessIds),
      admin.from('products').select('id', { count: 'exact', head: true }).in('business_id', businessIds),
    ]);
    sessions = counted[0].count ?? 0;
    entries = counted[1].count ?? 0;
    products = counted[2].count ?? 0;
  }

  // Keep the charge, drop the client from it. Done before the cascade so the
  // row is already detached when the business disappears.
  await admin.from('payments').update({ paid_by: null, created_by: null, msisdn: null }).eq('paid_by', uid);

  // Businesses go first and explicitly. Letting the auth cascade reach them
  // works, but the order Postgres fires several cascades in is not something to
  // depend on when one of them is a table this size.
  if (businessIds.length) {
    const { error } = await admin.from('businesses').delete().eq('owner_id', uid);
    if (error) return json({ error: `Could not delete the businesses: ${error.message}` }, 500);
  }

  const { error: userError } = await admin.auth.admin.deleteUser(uid);
  if (userError) return json({ error: `Could not delete the account: ${userError.message}` }, 500);

  return json({
    ok: true,
    deleted: { businesses: businessIds.length, products, sessions, entries },
  });
});
