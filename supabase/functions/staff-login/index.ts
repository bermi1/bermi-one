// Staff sign in on their own phone: phone number and PIN, from the login screen.
//
// A staff member has no email and no password — the owner added them with a
// phone and gave them a PIN. This finds them by phone, checks the PIN (with the
// same hash and a lockout that grows on repeated failure), creates their narrow
// staff account the first time, and hands back a one-time token the app trades
// for a session. What that account may do is decided by the database: its one
// business, recording the work, nothing owner-only.
//
// JWT verification is off: the person signing in has no session yet.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

interface Candidate { member_id: string; business_id: string; business_name: string; member_name: string; user_id: string | null; suspended: boolean }

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('staff-login failed:', message);
    return json({ error: message }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: { phone?: string; pin?: string; member_id?: string } = {};
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  const phone = String(body.phone ?? '');
  const pin = String(body.pin ?? '');
  if (phone.replace(/\D/g, '').length < 9) return json({ error: 'Enter your phone number.', code: 'PHONE_REQUIRED' }, 400);
  if (!/^\d{4,8}$/.test(pin)) return json({ error: 'Enter your PIN.', code: 'PIN_REQUIRED' }, 400);

  const { data, error } = await admin.rpc('staff_login_candidates', { p_phone: phone });
  if (error) throw new Error(error.message);
  let found = (data ?? []) as Candidate[];
  if (body.member_id) found = found.filter((c) => c.member_id === body.member_id);
  if (!found.length) {
    return json({ error: 'No staff account uses that phone number with a PIN. Ask the owner to add your phone in Manage → Staff and set your PIN.', code: 'NOT_FOUND' }, 404);
  }
  // The same phone on two teams: say which, rather than trying the PIN on both
  // (a wrong guess would count against the other one's lock).
  if (found.length > 1) {
    return json({ code: 'CHOOSE', choices: found.map((c) => ({ member_id: c.member_id, business: c.business_name, name: c.member_name })) }, 200);
  }
  const who = found[0];

  const { data: verdict, error: pinError } = await admin.rpc('staff_login_check', { p_member: who.member_id, p_pin: pin });
  if (pinError) throw new Error(pinError.message);
  if (verdict === 'locked') return json({ error: 'Too many wrong PINs. Try again later, or ask the owner to reset your PIN.', code: 'LOCKED' }, 429);
  if (verdict !== 'ok') return json({ error: 'Wrong PIN.', code: 'WRONG' }, 401);
  if (who.suspended) return json({ error: `${who.business_name} is paused. Ask the owner to renew Bermi One.`, code: 'SUSPENDED' }, 403);

  // Their account: made once, then reused on every sign-in.
  const email = `staff-${who.member_id}@staff.bermi.one`;
  let userId = who.user_id;
  if (!userId) {
    const { data: made, error: makeError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: { staff_member_id: who.member_id, business_id: who.business_id, full_name: who.member_name },
      app_metadata: { kind: 'staff' },
    });
    if (makeError || !made.user) throw new Error(makeError?.message || 'Could not create the staff account');
    userId = made.user.id;
    const { error: linkError } = await admin.from('staff_members').update({ user_id: userId }).eq('id', who.member_id);
    if (linkError) throw new Error(linkError.message);
  }
  // Always point the profile at the business and the right name, in case either changed.
  await admin.from('profiles').upsert({ id: userId, full_name: who.member_name, role: 'staff', onboarded: true, active_business_id: who.business_id }, { onConflict: 'id' });

  // A one-time token, traded by the app for a session (verifyOtp). Nothing is emailed.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (linkErr || !link?.properties?.hashed_token) throw new Error(linkErr?.message || 'Could not start the session');
  return json({ token_hash: link.properties.hashed_token, business: who.business_name, name: who.member_name });
}
