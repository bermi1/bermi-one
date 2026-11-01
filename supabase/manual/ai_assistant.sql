-- Bermi AI (real model) — run once in Supabase → SQL Editor.
-- Stores the Anthropic key in Vault, counts questions per account per day,
-- and gives HQ a view of usage. Safe to run more than once.

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
