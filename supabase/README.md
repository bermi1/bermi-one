# Bermi One — server side

Five edge functions and the secrets they need. Nothing here reads a secret from
the repository; they are set once in **Supabase → Edge Functions → Secrets** and
live only in the function runtime.

## Functions

| Function | JWT | Who calls it |
|---|---|---|
| `admin` | required | The Bermi Techs console, for the two things that need elevated rights: minting a password recovery link, and charging a subscription. |
| `payme-webhook` | **off** | Payme Africa. Authenticated by the `X-Middleware-Signature` HMAC, checked before any field of the body is trusted. |
| `notify` | **off** | A schedule. Authenticated by the `X-Worker-Key` header. |
| `subscribe` | required | The client's own browser, paying for their own subscription. Everything is keyed to `auth.uid()`; the browser names a plan code and a phone number and nothing else. |
| `delete-account` | required | The client, closing their own account. Deletes only the user behind the calling JWT — there is no id in the body to aim elsewhere. |

JWT verification is off on two of them deliberately: neither caller has a
Supabase session, so a JWT would have nothing to verify. Both authenticate by
another means before doing any work.

## Secrets

```
PAYME_APP_ID          BERMI_ONE_PROD_01     (sandbox: BERMI_ONE_TEST_01)
PAYME_APP_SECRET      <the app secret — never commit this>
PAYME_SANDBOX         1 while testing, 0 to go live
PAYME_CALLBACK_URL    https://<project>.supabase.co/functions/v1/payme-webhook
USD_TZS_RATE          2650          # plans are priced in USD, collected in TZS
SITE_URL              https://<your app>   # where password recovery links land

NOTIFY_WORKER_KEY     <a long random string>
TEXTIFY_API_KEY       <from Textify>
TEXTIFY_SENDER_ID     BERMI
TEXTIFY_URL           https://api.textify.africa/v1/send   # override if theirs differs
RESEND_API_KEY        <from Resend, for email>
MAIL_FROM             Bermi One <noreply@yourdomain>
```

## Draining the outbox

`notify` sends what the database has queued. Point a scheduler at it — Supabase
cron, or any uptime pinger:

```
POST https://<project>.supabase.co/functions/v1/notify
X-Worker-Key: <NOTIFY_WORKER_KEY>
```

Every minute is fine; it batches 25 and returns `{picked, sent, failed}`.

## Why an outbox rather than sending inline

A bar's closing must never fail because an SMS gateway is slow. Messages are
queued by a database trigger the moment a closing is verified, and a worker
drains them. A send that fails stays visible in `notifications` with its error
and its attempt count, and retries with backoff up to four times before it is
marked failed — rather than disappearing into a log line nobody reads.

## Running on a 2 GB database (Supabase "Small")

What keeps a small instance fast with a very large number of accounts:

- **Every query is one tenant's rows, through an index.** Each table that grows
  is indexed on `(business_id, <date> desc)`, so a bar with three years of
  history costs the same to open as a new one.
- **RLS is evaluated once per query, not once per row.** Policies call
  `(select auth.uid())`, `(select is_platform_admin())` and
  `(select my_business_ids())`, which Postgres runs once and caches.
- **Reads are bounded.** The app loads the last 100 ledger lines, the open
  session and a date window for reports. The API caps every response at 1,000
  rows on top of that.
- **Hot tables stay small.** `archive.move_old_rows()` runs nightly at 03:17 UTC
  (pg_cron `archive-old-rows`) and moves `action_log` and `webhook_events` rows
  older than 180 days into the `archive` schema — moved, not deleted.

What the size limits is *concurrency*, not accounts. As a rule of thumb a Small
instance (2 GB RAM, 2-core ARM, ~90 pooled connections) handles a few hundred
API requests per second at these query costs — comfortably tens of thousands of
daily active businesses, since a bar makes a few dozen requests a day. A million
registered accounts is storage (a few GB), not load. When sustained CPU stays
above ~70% in Reports → Database, move up one compute size in the dashboard;
no code changes.
