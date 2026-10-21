// Moves cold data out of the database and into Storage.
//
// The free tier gives the database 500 MB and Storage 1 GB of its own. A
// verified closing carries a snapshot of every product line (about 16 KB), so
// a busy bar adds megabytes a year that nobody opens after a few months. Old
// closings keep every total in the database — reports, the weekly SMS and the
// cash book read only those — and their per-product detail moves to
// `cold/closings/<business>/<date>_<id>.json.gz`, where Session history still
// opens it. Old log rows (actions, webhooks, sent messages) go the same way,
// written before they are removed, so nothing is lost.
//
// Runs from pg_cron (public.cron_archive_tick), which only calls when there is
// something to move. Protected by the same worker key as the notify function.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const WORKER_KEY = Deno.env.get('NOTIFY_WORKER_KEY') ?? '';
const BUCKET = 'cold';
const CLOSINGS_PER_RUN = 200;
const LOG_ROWS_PER_RUN = 2000;

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

async function gzip(value: unknown): Promise<Uint8Array> {
  const stream = new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function put(path: string, value: unknown): Promise<string | null> {
  const { error } = await admin.storage.from(BUCKET).upload(path, await gzip(value), { contentType: 'application/gzip', upsert: true });
  return error ? error.message : null;
}

/** Closing detail older than cold_closing_days(): file first, then clear it from the row. */
async function archiveClosings() {
  const { data: days } = await admin.rpc('cold_closing_days');
  const cutoff = new Date(Date.now() - Number(days ?? 150) * 86_400_000).toISOString().slice(0, 10);
  const { data: rows, error } = await admin.from('stock_sessions')
    .select('id, business_id, session_date, lines, counts')
    .eq('status', 'verified').is('archived_at', null).lt('session_date', cutoff)
    .or('lines.not.is.null,counts.not.is.null')
    .order('session_date', { ascending: true }).limit(CLOSINGS_PER_RUN);
  if (error) return { moved: 0, error: error.message };
  let moved = 0;
  for (const r of rows ?? []) {
    const path = `closings/${r.business_id}/${r.session_date}_${r.id}.json.gz`;
    const failed = await put(path, { id: r.id, business_id: r.business_id, session_date: r.session_date, lines: r.lines, counts: r.counts });
    if (failed) return { moved, error: `${path}: ${failed}` };
    const { error: upErr } = await admin.from('stock_sessions')
      .update({ lines: null, counts: null, archived_at: new Date().toISOString(), archive_path: path })
      .eq('id', r.id).is('archived_at', null);
    if (upErr) return { moved, error: upErr.message };
    moved++;
  }
  return { moved };
}

/** Old log rows: one gzipped file per batch, then the rows go. */
async function archiveLog(table: string, olderThanDays: number, extra?: (q: any) => any) {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
  let q = admin.from(table).select('*').lt('created_at', cutoff).order('created_at', { ascending: true }).limit(LOG_ROWS_PER_RUN);
  if (extra) q = extra(q);
  const { data: rows, error } = await q;
  if (error) return { moved: 0, error: error.message };
  if (!rows?.length) return { moved: 0 };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const failed = await put(`logs/${table}/${stamp}.json.gz`, rows);
  if (failed) return { moved: 0, error: failed };
  const ids = rows.map((r: { id: string }) => r.id);
  const { error: delErr } = await admin.from(table).delete().in('id', ids);
  return delErr ? { moved: 0, error: delErr.message } : { moved: ids.length };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const key = req.headers.get('X-Worker-Key') ?? '';
  if (!(await allowed(key))) return new Response('Forbidden', { status: 403 });

  // A dry run for one closing: write its file under test/ and read it back,
  // leaving the row untouched. Proves the round trip without moving anything.
  const body = await req.json().catch(() => ({})) as { test_session_id?: string };
  if (body.test_session_id) {
    const { data: r } = await admin.from('stock_sessions').select('id, business_id, session_date, lines, counts').eq('id', body.test_session_id).maybeSingle();
    if (!r) return new Response('Not found', { status: 404 });
    const path = `test/${r.id}.json.gz`;
    const failed = await put(path, r);
    if (failed) return new Response(JSON.stringify({ error: failed }), { status: 500 });
    const { data: blob } = await admin.storage.from(BUCKET).download(path);
    const back = JSON.parse(await new Response(blob!.stream().pipeThrough(new DecompressionStream('gzip'))).text());
    await admin.storage.from(BUCKET).remove([path]);
    return new Response(JSON.stringify({ path, gz_bytes: blob!.size, json_bytes: JSON.stringify(r).length, same: JSON.stringify(back) === JSON.stringify(r) }), { headers: { 'Content-Type': 'application/json' } });
  }

  const out = {
    closings: await archiveClosings(),
    action_log: await archiveLog('action_log', 180),
    webhook_events: await archiveLog('webhook_events', 90),
    notifications: await archiveLog('notifications', 90, (q) => q.in('status', ['sent', 'failed', 'skipped'])),
  };
  return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
