// The notification worker.
//
// Drains the `notifications` outbox and sends what is queued: SMS through
// Textify, email through Resend. It is a worker rather than an inline send for
// one reason that matters — a bar's closing must never fail because an SMS
// gateway is slow, and a message that fails must stay visible and retryable
// instead of disappearing into a log line.
//
// Runs unauthenticated but not unprotected: it is called by a schedule, and a
// shared NOTIFY_WORKER_KEY has to match. There is no user session behind a cron
// job, so a JWT would have nothing to verify.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const WORKER_KEY = Deno.env.get('NOTIFY_WORKER_KEY') ?? '';
const TEXTIFY_KEY = Deno.env.get('TEXTIFY_API_KEY') ?? '';
const TEXTIFY_URL = Deno.env.get('TEXTIFY_URL') ?? 'https://api.textify.africa/v1/send';
const TEXTIFY_SENDER = Deno.env.get('TEXTIFY_SENDER_ID') ?? 'BERMI';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const MAIL_FROM = Deno.env.get('MAIL_FROM') ?? 'Bermi One <noreply@bermi.one>';

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

async function sendSms(to: string, body: string): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!TEXTIFY_KEY) return { ok: false, message: 'TEXTIFY_API_KEY is not set' };

  const res = await fetch(TEXTIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TEXTIFY_KEY}`,
    },
    body: JSON.stringify({
      sender_id: TEXTIFY_SENDER,
      to: msisdn(to),
      message: body,
    }),
  });

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try { parsed = text ? JSON.parse(text) : {}; } catch { /* keep the raw text below */ }

  if (!res.ok) return { ok: false, message: `${res.status} ${text.slice(0, 200)}` };
  return {
    ok: true,
    id: String(parsed.id ?? parsed.message_id ?? parsed.reference ?? ''),
    message: String(parsed.status ?? parsed.message ?? 'sent'),
  };
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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  const key = req.headers.get('X-Worker-Key') ?? new URL(req.url).searchParams.get('key') ?? '';
  if (!WORKER_KEY || key !== WORKER_KEY) return new Response('Forbidden', { status: 403 });

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
        provider: n.channel === 'sms' ? 'textify' : 'resend',
        provider_id: result.id ?? null,
        provider_message: result.message ?? null,
        sent_at: new Date().toISOString(),
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
        provider: n.channel === 'sms' ? 'textify' : 'resend',
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
