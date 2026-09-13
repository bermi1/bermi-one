// Shared Payme Africa plumbing. The App Secret signs every request and verifies
// every callback, so it never leaves the server.

const enc = new TextEncoder();

async function hmacBase64(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}


/** Callbacks are signed the same way, over the raw body we received. */
export async function verifyCallback(
  rawBody: string,
  timestamp: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expected = await hmacBase64(rawBody + timestamp, secret);
  if (expected.length !== signature.length) return false;
  // Constant time: compare every character, no early exit on mismatch.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

/**
 * The gateway reports outcome in two fields that do not always agree: `result`
 * is the verdict, `payment_status` the state of the money. A transaction only
 * counts as done when both say so — otherwise it stays pending and gets
 * re-queried, which is the safe direction to be wrong in.
 */
export function normaliseStatus(
  result?: string,
  paymentStatus?: string,
): 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' {
  const r = (result || '').toUpperCase();
  const p = (paymentStatus || '').toUpperCase();
  if (p === 'COMPLETED' && r !== 'FAILED') return 'COMPLETED';
  if (p === 'FAILED' || r === 'FAILED') return 'FAILED';
  if (p === 'CANCELLED') return 'CANCELLED';
  return 'PENDING';
}
