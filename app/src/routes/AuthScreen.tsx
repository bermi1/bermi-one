import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { T } from '../lib/i18n';
import { Icon } from '../lib/icons';

type Mode = 'login' | 'signup';

/** 0–4, from length and variety. A nudge, not a gate — the server sets the rule. */
function strengthOf(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) s++;
  return Math.min(4, s);
}

const COPY = {
  en: {
    heroTitle: 'Run the whole bar from one screen.',
    heroSub: 'Count stock, close the day and see where every shilling went — on any phone.',
    props: [
      { icon: 'box', t: 'Stock that adds up', d: 'Opening, deliveries and the closing count, per product.' },
      { icon: 'wallet', t: 'Cash you can trust', d: 'Cash, mobile money and bank, reconciled every night.' },
      { icon: 'chart', t: 'Reports in a tap', d: 'Sales and profit by day, product and branch.' },
    ],
    loginSub: 'Sign in to pick up where you left off.',
    signupSub: '14 days free. No card needed.',
    show: 'Show password', hide: 'Hide password',
    strength: ['Too short', 'Weak', 'Fair', 'Good', 'Strong'],
    trust: 'Encrypted end to end · Your data stays yours',
    staffHint: 'Staff? Sign in on your business’s phone or tablet and pick your name.',
  },
  sw: {
    heroTitle: 'Endesha baa nzima kwenye skrini moja.',
    heroSub: 'Hesabu bidhaa, funga siku na uone kila shilingi ilipokwenda — kwenye simu yoyote.',
    props: [
      { icon: 'box', t: 'Bidhaa zinazolingana', d: 'Mwanzo, mizigo na hesabu ya kufunga, kwa kila bidhaa.' },
      { icon: 'wallet', t: 'Fedha za kuaminika', d: 'Taslimu, pesa ya simu na benki, kila usiku.' },
      { icon: 'chart', t: 'Ripoti kwa mguso', d: 'Mauzo na faida kwa siku, bidhaa na tawi.' },
    ],
    loginSub: 'Ingia uendelee ulipoishia.',
    signupSub: 'Siku 14 bure. Hakuna kadi.',
    show: 'Onyesha nenosiri', hide: 'Ficha nenosiri',
    strength: ['Fupi mno', 'Dhaifu', 'Wastani', 'Nzuri', 'Imara'],
    trust: 'Imesimbwa kikamilifu · Data yako ni yako',
    staffHint: 'Mfanyakazi? Ingia kwenye simu au tablet ya biashara kisha chagua jina lako.',
  },
};

export function AuthScreen() {
  const { signIn, signUp, sendReset } = useAuth();
  const [lang, setLang] = useState<'en' | 'sw'>(() => {
    try { return (localStorage.getItem('bermi:lang') as 'en' | 'sw') || 'en'; } catch { return 'en'; }
  });
  const L = T[lang];
  const C = COPY[lang];
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  // Bumped on every failure so the shake animation replays each time.
  const [shake, setShake] = useState(0);

  useEffect(() => {
    try { localStorage.setItem('bermi:lang', lang); } catch { /* per-device nicety only */ }
  }, [lang]);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setError('');
    setNotice('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const err = mode === 'login' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setBusy(false);
    if (err) { setError(err); setShake((n) => n + 1); }
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
    if (!email.trim()) { setError(L.resetNeedEmail); setShake((n) => n + 1); return; }
    setBusy(true);
    const err = await sendReset(email.trim());
    setBusy(false);
    if (err) { setError(err); setShake((n) => n + 1); }
    else setNotice(L.resetSent);
  }

  const strength = strengthOf(password);
  const strengthTone = ['var(--bad)', 'var(--bad)', 'var(--warn)', 'var(--ok)', 'var(--ok)'][strength];

  return (
    <div className="auth">
      {/* The brand side. Full panel on a wide screen, a compact band on a phone. */}
      <aside className="auth-hero" aria-hidden="true">
        <span className="auth-blob auth-blob-a" />
        <span className="auth-blob auth-blob-b" />
        <span className="auth-blob auth-blob-c" />
        <div className="auth-hero-inner">
          <div className="auth-brand">
            <img src="/icons/bermi-mark.svg" alt="" width={44} height={44} />
            <div>
              <div className="auth-brand-name">{T.en.appName}</div>
              <div className="auth-brand-tag">{L.tagline}</div>
            </div>
          </div>
          <h1 className="auth-hero-title">{C.heroTitle}</h1>
          <p className="auth-hero-sub">{C.heroSub}</p>
          <ul className="auth-props">
            {C.props.map((p, i) => (
              <li key={p.t} style={{ animationDelay: `${0.25 + i * 0.08}s` }}>
                <span className="auth-prop-icon"><Icon name={p.icon} size={17} /></span>
                <span>
                  <strong>{p.t}</strong>
                  <span>{p.d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-top">
            <img className="auth-mobile-mark" src="/icons/bermi-mark.svg" alt="Bermi One" width={36} height={36} />
            <div className="auth-lang" role="group" aria-label="Language">
              {(['en', 'sw'] as const).map((l) => (
                <button key={l} type="button" data-on={lang === l || undefined} onClick={() => setLang(l)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Keyed on mode so the heading re-enters on every switch. */}
          <div key={mode} className="auth-heading">
            <h2>{mode === 'login' ? L.welcomeBack : L.createAccount}</h2>
            <p>{mode === 'login' ? C.loginSub : C.signupSub}</p>
          </div>

          <div className="auth-tabs" role="tablist" data-mode={mode}>
            <span className="auth-tabs-pill" />
            <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => switchMode('login')}>{L.login}</button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => switchMode('signup')}>{L.signup}</button>
          </div>

          <form onSubmit={submit} className="auth-form" key={`f-${shake}`} data-shake={shake > 0 || undefined}>
            <label className="auth-field">
              <Icon name="mail" size={17} className="auth-field-icon" />
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder=" "
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <span className="auth-float">{L.email}</span>
            </label>

            <label className="auth-field">
              <Icon name="lock" size={17} className="auth-field-icon" />
              <input
                type={reveal ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder=" "
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="auth-float">{L.password}</span>
              <button
                type="button"
                className="auth-reveal"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? C.hide : C.show}
              >
                <Icon name={reveal ? 'eyeOff' : 'eye'} size={17} />
              </button>
            </label>

            {mode === 'signup' && password && (
              <div className="auth-strength" aria-live="polite">
                <div className="auth-strength-bars">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} style={{ background: i < strength ? strengthTone : undefined }} />
                  ))}
                </div>
                <span style={{ color: strengthTone }}>{C.strength[strength]}</span>
              </div>
            )}

            {error && (
              <div className="auth-msg auth-msg-bad" role="alert">
                <Icon name="alert" size={15} />
                <span>{error}</span>
              </div>
            )}
            {notice && (
              <div className="auth-msg auth-msg-ok" role="status">
                <Icon name="check" size={15} />
                <span>{notice}</span>
              </div>
            )}

            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? <span className="auth-spinner" aria-label={L.loading} /> : (
                <>
                  <span>{mode === 'login' ? L.login : L.signup}</span>
                  <Icon name="right" size={17} />
                </>
              )}
            </button>

            {mode === 'login' && (
              <button type="button" className="auth-link" onClick={() => void forgot()} disabled={busy}>
                {L.forgotPassword}
              </button>
            )}
          </form>

          <div className="auth-staff">
            <Icon name="users" size={15} />
            <span>{C.staffHint}</span>
          </div>

          <div className="auth-foot">
            <div className="auth-trust"><Icon name="shield" size={13} /> {C.trust}</div>
            {/* A store reviewer looks for these here, before they have an account. */}
            <div className="auth-legal">
              <Link to="/legal/privacy">{lang === 'sw' ? 'Sera ya faragha' : 'Privacy policy'}</Link>
              <span>·</span>
              <Link to="/legal/terms">{lang === 'sw' ? 'Masharti' : 'Terms'}</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
