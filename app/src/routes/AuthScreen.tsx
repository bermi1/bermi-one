import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { T } from '../lib/i18n';
import { Icon } from '../lib/icons';

export function AuthScreen() {
  const { signIn, signUp, sendReset } = useAuth();
  const [lang, setLang] = useState<'en' | 'sw'>('en');
  const L = T[lang];
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const err = mode === 'login' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (err) setError(err);
  }

  /*
    Forgotten passwords.

    Without this the only way back into an account is to write to support, which
    is a poor experience on the web and an outright rejection risk in a store:
    a reviewer who creates an account, signs out, and finds no way back is
    looking at an app that traps people.
  */
  async function forgot() {
    setError('');
    setNotice('');
    if (!email.trim()) { setError(L.resetNeedEmail); return; }
    setBusy(true);
    const err = await sendReset(email.trim());
    setBusy(false);
    if (err) setError(err);
    else setNotice(L.resetSent);
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 30 }}>
          <div style={{ width: 44, height: 44, borderRadius: 15, background: 'var(--grad)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 19 }}>B</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>{T.en.appName}</div>
            <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 500 }}>{L.tagline}</div>
          </div>
          <button
            className="chip tap"
            style={{ marginLeft: 'auto' }}
            onClick={() => setLang(lang === 'en' ? 'sw' : 'en')}
            type="button"
          >
            {lang === 'en' ? 'EN / SW' : 'SW / EN'}
          </button>
        </div>

        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, marginBottom: 6 }}>{mode === 'login' ? L.welcomeBack : L.createAccount}</div>
        <div style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 24 }}>{L.welcomeSub}</div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
            <Icon name="mail" style={{ color: 'var(--ink3)' }} />
            <input
              type="email"
              required
              placeholder={L.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 15 }}
            />
          </label>
          <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
            <Icon name="lock" style={{ color: 'var(--ink3)' }} />
            <input
              type="password"
              required
              minLength={6}
              placeholder={L.password}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 15 }}
            />
          </label>
          {error && <div style={{ color: 'var(--bad)', fontSize: 13, fontWeight: 600 }}>{error}</div>}
          {notice && <div style={{ color: 'var(--ok)', fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>{notice}</div>}
          <button className="btn-primary tap" type="submit" disabled={busy} style={{ marginTop: 6, border: 'none' }}>
            {busy ? L.loading : mode === 'login' ? L.login : L.signup}
          </button>
        </form>

        <div
          className="tap"
          style={{ textAlign: 'center', marginTop: 18, fontSize: 13.5, color: 'var(--brand)', fontWeight: 700 }}
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError('');
          }}
        >
          {mode === 'login' ? L.noAccount : L.haveAccount}
        </div>

        {mode === 'login' && (
          <button
            className="tap"
            type="button"
            onClick={() => void forgot()}
            style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', fontSize: 13, color: 'var(--ink3)', fontWeight: 600 }}
          >
            {L.forgotPassword}
          </button>
        )}

        {/* A store reviewer looks for these here, before they have an account. */}
        <div style={{ textAlign: 'center', marginTop: 26, fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>
          <Link to="/legal/privacy" style={{ color: 'inherit' }}>
            {lang === 'sw' ? 'Sera ya faragha' : 'Privacy policy'}
          </Link>
          <span style={{ margin: '0 8px', opacity: 0.5 }}>·</span>
          <Link to="/legal/terms" style={{ color: 'inherit' }}>
            {lang === 'sw' ? 'Masharti' : 'Terms'}
          </Link>
        </div>
      </div>
    </div>
  );
}
