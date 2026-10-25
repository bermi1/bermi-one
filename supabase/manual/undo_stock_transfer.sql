-- Undo a stock transfer: the units go back to the business that sent them and
-- come off the business that received them, in one step. Run once in
-- Supabase → SQL Editor (the app's "Undo" button calls this function).

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
