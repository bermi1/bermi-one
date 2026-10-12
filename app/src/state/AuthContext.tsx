import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { invokeFunction } from '../lib/functions';
import { isNative } from '../lib/native';
import { COMPANY } from '../lib/company';

interface AuthCtx {
  session: Session | null;
  loading: boolean;
  /** True while the session came from a recovery link and a new password is owed. */
  recovering: boolean;
  /** Called by the deep-link handler when the opened link was a recovery one. */
  beginRecovery: () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  /** Staff on their own phone: phone and PIN. May come back asking which business, when one phone is on two teams. */
  signInStaff: (phone: string, pin: string, memberId?: string) => Promise<StaffSignInResult>;
  signOut: () => Promise<void>;
  sendReset: (email: string) => Promise<string | null>;
  setPassword: (password: string) => Promise<string | null>;
}

export type StaffSignInResult =
  | { ok: true }
  | { ok: false; error: string; code?: string }
  | { ok: false; choose: { member_id: string; business: string; name: string }[] };

const Ctx = createContext<AuthCtx | null>(null);

/**
 * Where a recovery link comes back to.
 *
 * On the web that is wherever the app is served from. In the downloaded app it
 * is the same https address, claimed as an Android App Link — the OS hands the
 * link to Bermi One instead of opening a browser, and the deep-link listener
 * exchanges the code. Both need this to match SITE_URL in Supabase.
 */
export function recoveryRedirect(): string {
  if (isNative()) return `${COMPANY.site}/auth/callback`;
  return `${window.location.origin}/auth/callback`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Supabase fires this once when a recovery link is opened. The session is
      // real, but it exists to let someone set a password, not to drop them into
      // their books with one they still cannot remember.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signInStaff(phone: string, pin: string, memberId?: string): Promise<StaffSignInResult> {
    let out: { token_hash?: string; code?: string; choices?: { member_id: string; business: string; name: string }[] };
    try {
      out = await invokeFunction('staff-login', { phone, pin, ...(memberId ? { member_id: memberId } : {}) });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (out.code === 'CHOOSE' && out.choices) return { ok: false, choose: out.choices };
    if (!out.token_hash) return { ok: false, error: 'Could not sign in. Try again.' };
    const { error } = await supabase.auth.verifyOtp({ token_hash: out.token_hash, type: 'magiclink' });
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }
  /*
    Sign up and go straight in.

    Accounts are confirmed by the database the moment they are created
    (auth_autoconfirm), so there is no email to wait for. If Supabase still
    answers without a session — its "Confirm email" switch is on — the account
    is already usable, so sign in with the same details rather than leave the
    screen sitting there. An address that already has an account gets the same
    treatment: right password, you are in; wrong one, you are told to sign in.
  */
  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (data?.session) return null;
    if (error && !/already registered|already exists|rate limit|security purposes/i.test(error.message)) return error.message;
    const { error: inErr } = await supabase.auth.signInWithPassword({ email, password });
    if (!inErr) return null;
    return /invalid login credentials/i.test(inErr.message) ? 'ALREADY_REGISTERED' : inErr.message;
  }
  async function signOut() {
    await supabase.auth.signOut();
  }
  async function sendReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: recoveryRedirect() });
    return error ? error.message : null;
  }
  async function setPassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return error.message;
    setRecovering(false);
    return null;
  }

  return (
    <Ctx.Provider value={{ session, loading, recovering, beginRecovery: () => setRecovering(true), signIn, signUp, signInStaff, signOut, sendReset, setPassword }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
