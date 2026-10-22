-- Removes the Shop module's database objects. Every shop table is empty.
-- Run in Supabase → SQL Editor when you are sure; it cannot be undone.
-- (The app no longer uses any of this.)

select cron.unschedule('shop-expire-unpaid');

drop function if exists public.hq_shop_payouts cascade;
drop function if exists public.shop_adjust_stock cascade;
drop function if exists public.shop_audience cascade;
drop function if exists public.shop_biz_by_slug cascade;
drop function if exists public.shop_campaign_preview cascade;
drop function if exists public.shop_customer_upsert cascade;
drop function if exists public.shop_expire_unpaid cascade;
drop function if exists public.shop_gift_apply cascade;
drop function if exists public.shop_gift_balance cascade;
drop function if exists public.shop_issue_gift_card cascade;
drop function if exists public.shop_loyalty cascade;
drop function if exists public.shop_move_order_stock cascade;
drop function if exists public.shop_next_number cascade;
drop function if exists public.shop_order_public cascade;
drop function if exists public.shop_place_order cascade;
drop function if exists public.shop_pos_sale cascade;
drop function if exists public.shop_price_cart cascade;
drop function if exists public.shop_product_public cascade;
drop function if exists public.shop_product_slug cascade;
drop function if exists public.shop_public cascade;
drop function if exists public.shop_quote cascade;
drop function if exists public.shop_quote_owner cascade;
drop function if exists public.shop_request_payout cascade;
drop function if exists public.shop_send_campaign cascade;
drop function if exists public.shop_set_order_status cascade;
drop function if exists public.shop_settle_paid cascade;

drop table if exists public.shop_gift_txns cascade;
drop table if exists public.shop_gift_cards cascade;
drop table if exists public.shop_campaigns cascade;
drop table if exists public.shop_stock_moves cascade;
drop table if exists public.shop_orders cascade;
drop table if exists public.shop_promotions cascade;
drop table if exists public.shop_customers cascade;
drop table if exists public.shop_products cascade;
drop table if exists public.shop_payouts cascade;
drop table if exists public.shop_wallets cascade;

-- Also delete the "shop-pay" edge function in Supabase → Edge Functions,
-- and the empty "shop-media" storage bucket if you want it gone.
