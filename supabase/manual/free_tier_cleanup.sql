-- Free-tier cleanup. Run once in Supabase → SQL Editor (it needs the owner's
-- confirmation because it deletes and drops). Safe to run more than once.

-- 1. Keep only two days of scheduler logs and one day of pg_net responses.
--    These were 30 MB of a 49 MB database and grew ~1.3 MB a day.
create or replace function public.purge_logs() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from cron.job_run_details where runid in (
    select runid from cron.job_run_details where end_time < now() - interval '2 days' limit 20000);
  delete from net._http_response where id in (
    select id from net._http_response where created < now() - interval '1 day' limit 20000);
end $$;
revoke all on function public.purge_logs() from public, anon, authenticated;
select cron.schedule('purge-logs', '41 2 * * *', 'select public.purge_logs()');

-- First clean-up now (run this line a few times until it deletes nothing).
select public.purge_logs();

-- 2. Identical indexes: each costs space and a write on every insert.
drop index if exists public.action_log_business_recent_idx;
drop index if exists public.subscriptions_owner_key;
create index if not exists payouts_requested_by_idx on public.payouts (requested_by);

-- 3. One read policy per table instead of an admin one plus an owner one,
--    so each row is checked once.
drop policy if exists ledger_admin_read on public.ledger_entries;
drop policy if exists ledger_owner_read on public.ledger_entries;
create policy ledger_read on public.ledger_entries for select
  using (business_id = any ((select public.my_business_ids())::uuid[]) or (select public.is_platform_admin()));

drop policy if exists products_admin_read on public.products;
drop policy if exists products_owner_read on public.products;
create policy products_read on public.products for select
  using (business_id = any ((select public.my_business_ids())::uuid[]) or (select public.is_platform_admin()));

drop policy if exists sessions_admin_read on public.stock_sessions;
drop policy if exists sessions_owner_read on public.stock_sessions;
create policy sessions_read on public.stock_sessions for select
  using (business_id = any ((select public.my_business_ids())::uuid[]) or (select public.is_platform_admin()));

-- notifications_read already lets admins in.
drop policy if exists notifications_admin_read on public.notifications;

-- 4. The old in-database "archive" kept rows in the same database, saving
--    nothing. Both tables are empty; cold rows now go to Storage (archive-cold).
select cron.unschedule('archive-old-rows');
drop table if exists archive.action_log;
drop table if exists archive.webhook_events;
drop function if exists archive.move_old_rows();

-- 5. Give the space back to the free tier's 500 MB.
vacuum full cron.job_run_details;
vacuum full net._http_response;
