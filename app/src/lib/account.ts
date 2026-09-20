// Closing the account, from the client's side.
//
// The browser sends one thing: the word the person typed to confirm. It does
// not send an account id, because the function does not read one — whose
// account goes is decided by the JWT, on the server, where it cannot be edited.

import { invokeFunction } from './functions';

export interface Deleted {
  businesses: number;
  products: number;
  sessions: number;
  entries: number;
}

/** The word that has to be typed. Not translated: it is a key, not a sentence. */
export const DELETE_WORD = 'DELETE';

export async function deleteAccount(confirm: string): Promise<Deleted> {
  const out = await invokeFunction<{ ok?: boolean; deleted?: Deleted }>('delete-account', { confirm });
  if (!out?.ok) throw new Error('The account was not deleted.');
  return out.deleted ?? { businesses: 0, products: 0, sessions: 0, entries: 0 };
}
