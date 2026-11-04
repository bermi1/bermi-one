-- Bermi One — everything waiting to be run, in one go.
-- Supabase → SQL Editor → New query → paste all of this → Run.
-- Safe to run more than once.

-- =========================================================================
-- 1. Closings: reopen / delete / restart a verified day
--    (the app does the work; reopening clears who approved it, so these
--    two columns must accept empty values — harmless if they already do)
-- =========================================================================
alter table public.stock_sessions alter column approved_by_name drop not null;
alter table public.stock_sessions alter column approved_at drop not null;

-- =========================================================================
-- 2. Bermi AI (Claude) — usage counter and key storage
-- =========================================================================

create table if not exists public.ai_usage (
  owner_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  questions integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  primary key (owner_id, day)
);
alter table public.ai_usage enable row level security;
drop policy if exists ai_usage_own on public.ai_usage;
create policy ai_usage_own on public.ai_usage for select using (owner_id = (select auth.uid()) or (select public.is_platform_admin()));

-- One more question for this account today (called by the ask-ai function).
create or replace function public.ai_count(p_owner uuid, p_day date, p_in bigint, p_out bigint)
returns void language sql security definer set search_path = public as $$
  insert into public.ai_usage (owner_id, day, questions, input_tokens, output_tokens)
  values (p_owner, p_day, 1, p_in, p_out)
  on conflict (owner_id, day) do update
    set questions = ai_usage.questions + 1,
        input_tokens = ai_usage.input_tokens + excluded.input_tokens,
        output_tokens = ai_usage.output_tokens + excluded.output_tokens;
$$;
revoke all on function public.ai_count(uuid, date, bigint, bigint) from public, anon, authenticated;

-- The key, for the function only (service role).
create or replace function public.ai_config() returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object('api_key', (select decrypted_secret from vault.decrypted_secrets where name = 'ai_api_key'));
$$;
revoke all on function public.ai_config() from public, anon, authenticated;

-- HQ saves the key (write-only: nothing comes back but whether one is set).
create or replace function public.hq_set_ai_config(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'NOT_ALLOWED'; end if;
  if coalesce(btrim(p_key), '') = '' then raise exception 'EMPTY_KEY'; end if;
  select id into v_id from vault.secrets where name = 'ai_api_key';
  if v_id is null then perform vault.create_secret(btrim(p_key), 'ai_api_key');
  else perform vault.update_secret(v_id, btrim(p_key)); end if;
  return jsonb_build_object('key_set', true);
end $$;
revoke all on function public.hq_set_ai_config(text) from public, anon;
grant execute on function public.hq_set_ai_config(text) to authenticated;

-- HQ: is a key set, and who used how much in the last 7 days.
create or replace function public.hq_ai_overview() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'NOT_ALLOWED'; end if;
  return jsonb_build_object(
    'key_set', exists (select 1 from vault.secrets where name = 'ai_api_key'),
    'usage', coalesce((select jsonb_agg(row_to_json(t) order by t.day desc, t.questions desc) from (
      select u.day, u.questions, u.input_tokens, u.output_tokens, coalesce(p.full_name, '') as owner_name
      from public.ai_usage u left join public.profiles p on p.id = u.owner_id
      where u.day >= current_date - 7) t), '[]'::jsonb));
end $$;
revoke all on function public.hq_ai_overview() from public, anon;
grant execute on function public.hq_ai_overview() to authenticated;

-- =========================================================================
-- 3. Undo a stock transfer between businesses
-- =========================================================================

alter table public.stock_transfers add column if not exists undone_at timestamptz;
alter table public.stock_transfers add column if not exists undone_by text;

create or replace function public.undo_stock_transfer(p_id uuid, p_by text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  t public.stock_transfers;
  it jsonb;
  qty numeric;
  rp public.products;      -- the receiver's product
  sp public.products;      -- the sender's product
  r_sub public.stock_sessions;
  s_sub public.stock_sessions;
  shelf numeric;
  c jsonb;
  from_name text;
  to_name text;
  summary text := '';
begin
  select * into t from public.stock_transfers where id = p_id for update;
  if t.id is null then raise exception 'NOT_FOUND'; end if;
  if t.undone_at is not null then raise exception 'ALREADY_UNDONE'; end if;
  if not (public.can_work_in(t.from_business) or public.can_work_in(t.to_business)) then raise exception 'NOT_ALLOWED'; end if;

  select name into from_name from public.businesses where id = t.from_business;
  select name into to_name from public.businesses where id = t.to_business;
  -- A day waiting for review is frozen: movements park in `incoming`, as transfer_stock does.
  select * into r_sub from public.stock_sessions where business_id = t.to_business and status = 'submitted' order by session_date desc limit 1;
  select * into s_sub from public.stock_sessions where business_id = t.from_business and status = 'submitted' order by session_date desc limit 1;

  -- First check the receiver still has every item; change nothing unless all can go back.
  for it in select * from jsonb_array_elements(t.items) loop
    qty := (it->>'qty')::numeric;
    select * into rp from public.products where id = (it->>'to_product_id')::uuid and business_id = t.to_business;
    if rp.id is null then raise exception 'NOT_ENOUGH:%:0', it->>'name'; end if;
    if r_sub.id is not null then
      c := r_sub.counts -> rp.id::text;
      shelf := (case when c is null or c = 'null'::jsonb then rp.opening + rp.added else (c #>> '{}')::numeric end) + coalesce(rp.incoming, 0);
    else
      shelf := rp.opening + rp.added;
    end if;
    if shelf < qty then raise exception 'NOT_ENOUGH:%:%', rp.name, greatest(shelf, 0); end if;
  end loop;

  for it in select * from jsonb_array_elements(t.items) loop
    qty := (it->>'qty')::numeric;
    if r_sub.id is not null then
      update public.products set incoming = coalesce(incoming, 0) - qty where id = (it->>'to_product_id')::uuid;
    else
      update public.products set added = added - qty where id = (it->>'to_product_id')::uuid;
    end if;
    select * into sp from public.products where id = (it->>'product_id')::uuid and business_id = t.from_business;
    if sp.id is not null then
      if s_sub.id is not null then
        update public.products set incoming = coalesce(incoming, 0) + qty where id = sp.id;
      else
        update public.products set added = added + qty where id = sp.id;
      end if;
    end if;
    summary := summary || case when summary = '' then '' else ', ' end || qty::text || ' × ' || (it->>'name');
  end loop;

  insert into public.ledger_entries (business_id, kind, label, amount, account, who_name)
  values (t.from_business, 'stock', 'Transfer undone — ' || summary || ' back from ' || coalesce(to_name, 'other business'), 0, 'cash', p_by),
         (t.to_business, 'stock', 'Transfer undone — ' || summary || ' returned to ' || coalesce(from_name, 'other business'), 0, 'cash', p_by);

  update public.stock_transfers set undone_at = now(), undone_by = p_by where id = t.id;
end $$;

revoke all on function public.undo_stock_transfer(uuid, text) from public, anon;
grant execute on function public.undo_stock_transfer(uuid, text) to authenticated;

-- =========================================================================
-- Check: both values below should be filled in (not null).
-- =========================================================================
select to_regclass('public.ai_usage') as ai_usage_table,
       to_regprocedure('public.undo_stock_transfer(uuid,text)') as undo_transfer_function;

-- Optional, separate files (they delete old data, run only if you want):
--   free_tier_cleanup.sql   — frees database space (old logs, duplicate indexes)
--   remove_shop_module.sql  — drops the empty shop tables
