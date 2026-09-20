import { supabase } from './supabase';

/*
  Calling an edge function, and finding out what it actually said.

  `supabase.functions.invoke` rejects any non-2xx response with a
  FunctionsHttpError whose `message` is the fixed string "Edge Function returned
  a non-2xx status code". That sentence describes the transport and tells the
  person holding the phone nothing. The response body — which is where our
  functions put "Payments are not configured yet", "Enter a valid phone number",
  "Not a platform administrator" — is on `error.context`, a Response that nobody
  was reading. Every one of those messages was being thrown away and replaced by
  the placeholder.
*/

interface HttpErrorish {
  name?: string;
  message?: string;
  context?: unknown;
}

function isResponse(v: unknown): v is Response {
  return typeof v === 'object' && v !== null && typeof (v as Response).status === 'number' && 'headers' in (v as Response);
}

/** The best sentence available about why a call failed. */
async function reasonFor(error: HttpErrorish): Promise<string> {
  const ctx = error.context;

  if (isResponse(ctx)) {
    // Read it as text first: a 500 from the platform is not always JSON, and a
    // failed .json() would lose the only clue there is.
    let raw = '';
    try { raw = await ctx.clone().text(); } catch { /* body already consumed or unreadable */ }

    if (raw) {
      try {
        const body = JSON.parse(raw) as { error?: string; message?: string; msg?: string };
        const named = body.error || body.message || body.msg;
        if (named) return named;
      } catch { /* not JSON — the raw text is still better than nothing */ }
      if (raw.length <= 300) return raw;
    }

    if (ctx.status === 401) return 'Your session has expired. Sign in again.';
    if (ctx.status === 403) return 'You do not have permission to do that.';
    if (ctx.status === 404) return 'Not found.';
    return `The server returned ${ctx.status}${ctx.statusText ? ` ${ctx.statusText}` : ''}.`;
  }

  // FunctionsFetchError: the request never arrived at all.
  if (error.name === 'FunctionsFetchError') return 'Could not reach the server. Check your connection and try again.';

  return error.message || 'Something went wrong.';
}

/**
 * Invoke an edge function and return its JSON, throwing an Error whose message
 * is the reason the function itself gave.
 */
export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(await reasonFor(error as HttpErrorish));

  // A 200 can still carry a refusal; the functions use this for soft failures.
  const out = data as T & { error?: string };
  if (out?.error) throw new Error(out.error);
  return out;
}
