# Bermi One — server side

Three edge functions and the secrets they need. Nothing here reads a secret from
the repository; they are set once in **Supabase → Edge Functions → Secrets** and
live only in the function runtime.

## Functions

| Function | JWT | Who calls it |
|---|---|---|
| `admin` | required | The Bermi Techs console, for the two things that need elevated rights: minting a password recovery link, and charging a subscription. |
| `payme-webhook` | **off** | Payme Africa. Authenticated by the `X-Middleware-Signature` HMAC, checked before any field of the body is trusted. |
| `notify` | **off** | A schedule. Authenticated by the `X-Worker-Key` header. |

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
