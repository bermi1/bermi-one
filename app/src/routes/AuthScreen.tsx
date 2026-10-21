import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { T } from '../lib/i18n';
import { Icon } from '../lib/icons';

const STAFF_ERR_SW: Record<string, string> = {
  NOT_FOUND: 'Hakuna mfanyakazi mwenye namba hiyo na PIN. Mwombe mmiliki aweke namba yako kwenye Simamia → Wafanyakazi na akuwekee PIN.',
  WRONG: 'PIN si sahihi.',
  LOCKED: 'Umekosea PIN mara nyingi. Jaribu baadaye au mwombe mmiliki abadilishe PIN yako.',
  SUSPENDED: 'Biashara hii imesitishwa. Mwombe mmiliki alipie Bermi One.',
  PHONE_REQUIRED: 'Weka namba yako ya simu.',
  PIN_REQUIRED: 'Weka PIN yako.',
};

type Mode = 'login' | 'signup' | 'staff';

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

/**
 * Types a word, holds it, deletes it, types the next. Under reduced motion it
 * simply shows each word in turn.
 */
function TypeCycle({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const word = words[i % words.length];
    if (reduced) {
      setText(word);
      const t = setTimeout(() => setI((n) => n + 1), 2400);
      return () => clearTimeout(t);
    }
    let delay = deleting ? 38 : 72;
    if (!deleting && text === word) delay = 1500;
    if (deleting && text === '') delay = 220;
    const t = setTimeout(() => {
      if (!deleting && text === word) setDeleting(true);
      else if (deleting && text === '') { setDeleting(false); setI((n) => n + 1); }
      else setText(deleting ? word.slice(0, text.length - 1) : word.slice(0, text.length + 1));
    }, delay);
    return () => clearTimeout(t);
  }, [text, deleting, i, words, reduced]);

  return <span className="auth-type">{text}<span className="auth-caret" aria-hidden="true" /></span>;
}

const COPY = {
  en: {
    heroPrefix: 'Run your ',
    heroWords: ['bar', 'barbershop', 'restaurant', 'pharmacy', 'shop', 'salon', 'business'],
    heroSuffix: ' from one system.',
    heroSub: 'Bermi One is one system for every business you run — stock, cash, staff and reports, across every branch, on any phone.',
    props: [
      { icon: 'box', t: 'Stock or services', d: 'Bottles counted nightly, or every cut recorded with its price.' },
      { icon: 'wallet', t: 'Cash, mobile money & bank', d: 'Every shilling in and out, reconciled every day.' },
      { icon: 'users', t: 'Staff with their own PIN', d: 'They record the work; you keep prices and profit.' },
      { icon: 'chart', t: 'Every branch, one account', d: 'Reports and insights across all your businesses.' },
    ],
    types: ['Bars & lounges', 'Barbershops & salons', 'Restaurants', 'Pharmacies', 'Shops', 'Hardware'],
    rolling: 'Live today for bars & lounges and barbershops — more business types coming.',
    loginSub: 'Sign in to pick up where you left off.',
    signupSub: '7 days free. No card needed.',
    show: 'Show password', hide: 'Hide password',
    strength: ['Too short', 'Weak', 'Fair', 'Good', 'Strong'],
    trust: 'Encrypted end to end · Your data stays yours',
    staffHint: 'Staff? Sign in with your phone number and PIN →',
    staffTab: 'Staff',
    staffTitle: 'Staff sign-in',
    staffSub: 'Use the phone number your manager saved for you and your PIN.',
    staffPhone: 'Your phone number',
    staffGo: 'Start my shift',
    staffWhich: 'You work at more than one place. Which one?',
  },
  sw: {
    heroPrefix: 'Endesha ',
    heroWords: ['baa', 'kinyozi', 'mgahawa', 'famasia', 'duka', 'saluni', 'biashara'],
    heroSuffix: ' yako kwa mfumo mmoja.',
    heroSub: 'Bermi One ni mfumo mmoja kwa kila biashara unayoendesha — bidhaa, fedha, wafanyakazi na ripoti, kwa kila tawi, kwenye simu yoyote.',
    props: [
      { icon: 'box', t: 'Stoo au huduma', d: 'Chupa zinahesabiwa kila usiku, au kila huduma inarekodiwa na bei yake.' },
      { icon: 'wallet', t: 'Cash, pesa ya simu na benki', d: 'Kila shilingi inayoingia na kutoka, kila siku.' },
      { icon: 'users', t: 'Wafanyakazi wenye PIN zao', d: 'Wanarekodi kazi; wewe unabaki na bei na faida.' },
      { icon: 'chart', t: 'Kila tawi, akaunti moja', d: 'Ripoti na uchambuzi kwa biashara zako zote.' },
    ],
    types: ['Baa na lounge', 'Vinyozi na saluni', 'Migahawa', 'Famasia', 'Maduka', 'Vifaa'],
    rolling: 'Inafanya kazi leo kwa baa, lounge na vinyozi — aina nyingine za biashara zinakuja.',
    loginSub: 'Ingia uendelee ulipoishia.',
    signupSub: 'Siku 7 bure. Hakuna kadi.',
    show: 'Onyesha password', hide: 'Ficha password',
    strength: ['Fupi mno', 'Dhaifu', 'Wastani', 'Nzuri', 'Imara'],
    trust: 'Imesimbwa kikamilifu · Data yako ni yako',
    staffHint: 'Mfanyakazi? Ingia kwa namba ya simu na PIN yako →',
    staffTab: 'Mfanyakazi',
    staffTitle: 'Kuingia kwa mfanyakazi',
    staffSub: 'Tumia namba ya simu aliyohifadhi meneja wako na PIN yako.',
    staffPhone: 'Namba yako ya simu',
    staffGo: 'Anza zamu yangu',
    staffWhich: 'Unafanya kazi sehemu zaidi ya moja. Ipi?',
  },
};

export function AuthScreen() {
  const { signIn, signUp, sendReset, signInStaff } = useAuth();
  const [lang, setLang] = useState<'en' | 'sw'>(() => {
    try { return (localStorage.getItem('bermi:lang') as 'en' | 'sw') || 'en'; } catch { return 'en'; }
  });
  const L = T[lang];
  const C = COPY[lang];
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [phone, setPhone] = useState(() => { try { return localStorage.getItem('bermi:staff-phone') || ''; } catch { return ''; } });
  const [pin, setPin] = useState('');
  const [choices, setChoices] = useState<{ member_id: string; business: string; name: string }[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  // Bumped on every failure so the shake animation replays each time.
  const [shake, setShake] = useState(0);
  // The very first screen on a new device asks the language, before anything else.
  const [picked, setPicked] = useState(() => { try { return !!localStorage.getItem('bermi:lang'); } catch { return true; } });

  useEffect(() => {
    try { localStorage.setItem('bermi:lang', lang); } catch { /* per-device nicety only */ }
  }, [lang]);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setError('');
    setNotice('');
  }

  async function staffSubmit(memberId?: string) {
    setBusy(true);
    setError('');
    const r = await signInStaff(phone.trim(), pin, memberId);
    setBusy(false);
    if (r.ok) {
      try { localStorage.setItem('bermi:staff-phone', phone.trim()); } catch { /* convenience only */ }
      return;
    }
    if ('choose' in r) { setChoices(r.choose); return; }
    setPin('');
    setError(lang === 'sw' ? STAFF_ERR_SW[r.code || ''] || r.error : r.error);
    setShake((n) => n + 1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'staff') { setChoices(null); await staffSubmit(); return; }
    setBusy(true);
    setError('');
    setNotice('');
    const err = mode === 'login' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setBusy(false);
    if (err === 'ALREADY_REGISTERED') {
      setMode('login');
      setError(lang === 'sw' ? 'Email hii tayari ina account — ingia kwa password yako.' : 'This email already has an account — sign in with your password.');
      setShake((n) => n + 1);
      return;
    }
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

  if (!picked) {
    const choose = (l: 'en' | 'sw') => { setLang(l); setPicked(true); };
    return (
      <div className="auth-shell" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
        <div id="lang-pick" className="auth-card" style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>
          <img src="/icons/bermi-mark.svg" alt="Bermi One" width={48} height={48} style={{ margin: '0 auto 14px' }} />
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Chagua lugha</h2>
          <p style={{ margin: '4px 0 20px', color: 'var(--ink3)', fontWeight: 600 }}>Choose your language</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" className="btn-primary tap" data-lang="sw" onClick={() => choose('sw')} style={{ width: '100%' }}>Kiswahili</button>
            <button type="button" className="btn-ghost tap" data-lang="en" onClick={() => choose('en')} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: '1px solid var(--line)', fontWeight: 800 }}>English</button>
          </div>
          <p style={{ marginTop: 16, fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600 }}>Unaweza kubadilisha baadaye · You can change it later</p>
        </div>
      </div>
    );
  }

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
          <h1 className="auth-hero-title">
            {C.heroPrefix}<TypeCycle key={lang} words={C.heroWords} />{C.heroSuffix}
          </h1>
          <p className="auth-hero-sub">{C.heroSub}</p>
          <div className="auth-types">
            {C.types.map((t, i) => (
              <span key={t} style={{ animationDelay: `${0.3 + i * 0.07}s` }} data-live={i < 2 || undefined}>{i < 2 ? '✓ ' : ''}{t}</span>
            ))}
          </div>
          <p className="auth-rolling">{C.rolling}</p>
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
            <h2>{mode === 'login' ? L.welcomeBack : mode === 'staff' ? C.staffTitle : L.createAccount}</h2>
            <p>{mode === 'login' ? C.loginSub : mode === 'staff' ? C.staffSub : C.signupSub}</p>
          </div>

          <div className="auth-tabs" role="tablist" data-mode={mode}>
            <span className="auth-tabs-pill" />
            <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => switchMode('login')}>{L.login}</button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => switchMode('signup')}>{L.signup}</button>
            <button type="button" role="tab" aria-selected={mode === 'staff'} onClick={() => switchMode('staff')}>{C.staffTab}</button>
          </div>

          <form onSubmit={submit} className="auth-form" key={`f-${shake}`} data-shake={shake > 0 || undefined}>
            {mode === 'staff' ? (
              <>
                <label className="auth-field">
                  <Icon name="phone" size={17} className="auth-field-icon" />
                  <input type="tel" required autoComplete="tel" inputMode="tel" placeholder=" " value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <span className="auth-float">{C.staffPhone}</span>
                </label>
                <label className="auth-field">
                  <Icon name="lock" size={17} className="auth-field-icon" />
                  <input type="password" required inputMode="numeric" pattern="[0-9]*" minLength={4} maxLength={8} autoComplete="one-time-code" placeholder=" "
                    value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
                  <span className="auth-float">PIN</span>
                </label>
                {choices && (
                  <div className="auth-choices" role="group" aria-label={C.staffWhich}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink2)' }}>{C.staffWhich}</div>
                    {choices.map((c) => (
                      <button key={c.member_id} type="button" className="btn-ghost tap" disabled={busy} onClick={() => void staffSubmit(c.member_id)}>
                        {c.business} · {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (<>
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
            </>)}

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
                  <span>{mode === 'signup' ? L.signup : mode === 'staff' ? C.staffGo : L.login}</span>
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

          {mode !== 'staff' && (
            <button type="button" className="auth-staff tap" onClick={() => switchMode('staff')}>
              <Icon name="users" size={15} />
              <span>{C.staffHint}</span>
            </button>
          )}

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
