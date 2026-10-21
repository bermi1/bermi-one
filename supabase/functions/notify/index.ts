// The notification worker.
//
// Drains the `notifications` outbox and sends what is queued: SMS through
// BRIQ (karibu.briq.tz), email through Resend. It is a worker rather than an inline send for
// one reason that matters — a bar's closing must never fail because an SMS
// gateway is slow, and a message that fails must stay visible and retryable
// instead of disappearing into a log line.
//
// Runs unauthenticated but not unprotected: it is called by a schedule, and a
// shared key has to match: NOTIFY_WORKER_KEY from the environment, or the
// internal cron key kept in Vault (the one pg_cron already sends to
// payme-reconcile), so the schedule works without a dashboard secret. There is
// no user session behind a cron job, so a JWT would have nothing to verify.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const WORKER_KEY = Deno.env.get('NOTIFY_WORKER_KEY') ?? '';
// The SMS provider (BRIQ): the function environment first, then Vault (set
// from the HQ console). Read per run, so a key saved in HQ starts working
// within a minute without a redeploy.
let SMS_KEY = '';
let SMS_URL = '';
let SMS_SENDER = '';
async function loadSmsConfig() {
  const { data } = await admin.rpc('sms_config');
  const v = (data ?? {}) as { api_key?: string | null; url?: string | null; sender?: string | null };
  SMS_KEY = Deno.env.get('SMS_API_KEY') || v.api_key || '';
  SMS_URL = Deno.env.get('SMS_URL') || v.url || 'https://karibu.briq.tz/v1/message/send-instant';
  SMS_SENDER = Deno.env.get('SMS_SENDER_ID') || v.sender || 'BRIQ';
}
// Email (Resend): the key and From address are saved from the HQ console into
// Vault and read on every run, like the SMS key; env vars still win if set.
let RESEND_KEY = '';
let MAIL_FROM = 'Bermi One <reports@bermione.com>';
async function loadEmailConfig() {
  const { data } = await admin.rpc('email_config');
  const v = (data ?? {}) as { api_key?: string | null; from?: string | null };
  RESEND_KEY = Deno.env.get('RESEND_API_KEY') || v.api_key || '';
  MAIL_FROM = Deno.env.get('MAIL_FROM') || v.from || 'Bermi One <reports@bermione.com>';
}

/** Give up after this many tries rather than hammering a gateway forever. */
const MAX_ATTEMPTS = 4;
const BATCH = 25;

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

/** Tanzanian numbers reach every gateway as 255XXXXXXXXX. People type them every other way. */
function msisdn(input: string): string {
  const digits = (input || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('255')) return digits;
  if (digits.startsWith('0')) return '255' + digits.slice(1);
  if (digits.length === 9) return '255' + digits;
  return digits;
}

/*
  BRIQ: POST /v1/message/send-instant with X-API-Key; body { content,
  recipients: ["2557…"], sender_id }. It answers { success, data, errors:
  [{ code, message }] } — a 200 is only a send when success is true, and a
  refusal names its reason, which is kept on the row for the owner to see.
*/
async function sendSms(to: string, body: string): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!SMS_KEY) return { ok: false, message: 'SMS API key is not set' };

  const res = await fetch(SMS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': SMS_KEY },
    body: JSON.stringify({ content: body, recipients: [msisdn(to)], sender_id: SMS_SENDER }),
  });

  const text = await res.text();
  let parsed: { success?: boolean; data?: Record<string, unknown> | null; errors?: { code?: string; message?: string }[]; detail?: string; message?: string } = {};
  try { parsed = text ? JSON.parse(text) : {}; } catch { /* keep the raw text below */ }

  if (!res.ok || parsed.success === false) {
    const why = parsed.errors?.map((e) => e.message || e.code).filter(Boolean).join('; ') || parsed.detail || parsed.message || text.slice(0, 200);
    return { ok: false, message: `${res.status} ${why}`.slice(0, 300) };
  }
  const d = (parsed.data ?? {}) as Record<string, unknown>;
  return { ok: true, id: String(d.id ?? d.message_id ?? d.reference ?? ''), message: String(d.status ?? 'sent') };
}

async function sendEmail(to: string, subject: string, body: string): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!RESEND_KEY) return { ok: false, message: 'RESEND_API_KEY is not set' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [to],
      subject,
      // The summary is composed as plain text and stays that way. It is read on
      // a phone, often on a bad connection, and a table of numbers survives
      // that better than a layout does.
      text: body,
    }),
  });

  const text = await res.text();
  if (!res.ok) return { ok: false, message: `${res.status} ${text.slice(0, 200)}` };
  let parsed: Record<string, unknown> = {};
  try { parsed = text ? JSON.parse(text) : {}; } catch { /* id stays empty */ }
  return { ok: true, id: String(parsed.id ?? ''), message: 'sent' };
}

let vaultKey: string | null = null;
async function allowed(key: string): Promise<boolean> {
  if (!key) return false;
  if (WORKER_KEY && key === WORKER_KEY) return true;
  if (vaultKey === null) {
    const { data } = await admin.rpc('payme_reconcile_key');
    vaultKey = typeof data === 'string' ? data : '';
  }
  return !!vaultKey && key === vaultKey;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  const key = req.headers.get('X-Worker-Key') ?? new URL(req.url).searchParams.get('key') ?? '';
  if (!(await allowed(key))) return new Response('Forbidden', { status: 403 });

  await Promise.all([loadSmsConfig(), loadEmailConfig()]);
  // What can go out right now, for the app to show ("SMS is not set up yet") instead of silence.
  await admin.from('platform_config').upsert({ key: 'notify_status', value: { sms: !!SMS_KEY, email: !!RESEND_KEY, checked_at: new Date().toISOString() } });

  // Queue whatever periodic reports are due before draining. One schedule runs
  // the whole thing: the database decides what is due (and stamps it so a
  // double run cannot send twice), this worker just delivers.
  let reportsQueued = 0;
  try {
    const { data } = await admin.rpc('queue_due_reports');
    reportsQueued = Number(data ?? 0);
  } catch {
    // A failure here must not stop the queue already waiting from going out.
  }

  const { data: queued } = await admin
    .from('notifications')
    .select('*')
    .eq('status', 'queued')
    // Only channels this worker can deliver. A campaign queued before the SMS
    // key is set waits for it, rather than burning its retries and failing.
    .in('channel', [...(SMS_KEY ? ['sms'] : []), ...(RESEND_KEY ? ['email'] : [])])
    .lte('scheduled_for', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(BATCH);

  const rows = queued ?? [];
  let sent = 0;
  let failed = 0;

  for (const n of rows) {
    const attempts = (n.attempts ?? 0) + 1;
    let result: { ok: boolean; id?: string; message?: string };

    try {
      if (n.channel === 'sms') {
        result = await sendSms(n.recipient, n.body);
      } else if (n.channel === 'email') {
        result = await sendEmail(n.recipient, n.subject ?? 'Bermi One', n.body);
      } else {
        result = { ok: false, message: `No sender for channel ${n.channel}` };
      }
    } catch (e) {
      result = { ok: false, message: String(e) };
    }

    if (result.ok) {
      sent++;
      await admin.from('notifications').update({
        status: 'sent',
        attempts,
        provider: n.channel === 'sms' ? 'briq' : 'resend',
        provider_id: result.id ?? null,
        provider_message: result.message ?? null,
        sent_at: new Date().toISOString(),
      }).eq('id', n.id);
    } else if (n.channel === 'email' && /domain is not verified/i.test(result.message ?? '')) {
      // Not this message's fault: the sending domain is still being verified
      // at Resend. Hold it for an hour without using up its retries, so the
      // queue simply starts flowing once the DNS records go green.
      await admin.from('notifications').update({
        provider: 'resend',
        provider_message: result.message ?? 'Sending domain not verified yet',
        scheduled_for: new Date(Date.now() + 60 * 60_000).toISOString(),
      }).eq('id', n.id);
    } else {
      failed++;
      // Back off and try again, up to a point. Past that it stays failed and
      // visible, because a message quietly retrying forever is a message
      // nobody ever finds out was never delivered.
      const giveUp = attempts >= MAX_ATTEMPTS;
      await admin.from('notifications').update({
        status: giveUp ? 'failed' : 'queued',
        attempts,
        provider: n.channel === 'sms' ? 'briq' : 'resend',
        provider_message: result.message ?? 'send failed',
        scheduled_for: giveUp
          ? n.scheduled_for
          : new Date(Date.now() + attempts * 5 * 60_000).toISOString(),
      }).eq('id', n.id);
    }
  }

  return new Response(JSON.stringify({ reportsQueued, picked: rows.length, sent, failed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
