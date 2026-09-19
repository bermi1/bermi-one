import { useState } from 'react';
import { Icon } from '../lib/icons';
import { T } from '../lib/i18n';
import { useAuth } from '../state/AuthContext';

/**
 * The screen a recovery link lands on.
 *
 * A recovery link signs someone in — which is not the same as giving them their
 * account back. Without this screen they are in today and locked out tomorrow,
 * still not knowing the password. So the app stops here until one is set, and
 * offers a way out for anyone who opened the link by accident.
 */
export function SetPassword() {
  const { setPassword, signOut } = useAuth();
  const [lang, setLang] = useState<'en' | 'sw'>('en');
  const L = T[lang];

  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (pw.length < 6) { setError(L.passwordTooShort); return; }
    if (pw !== again) { setError(L.passwordsDiffer); return; }
    setBusy(true);
    const err = await setPassword(pw);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 30 }}>
          <div style={{ width: 44, height: 44, borderRadius: 15, background: 'var(--grad)', display: 'grid', placeItems: 'center', color: '#fff' }}>
            <Icon name="lock" size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{T.en.appName}</div>
            <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 500 }}>{L.security}</div>
          </div>
          <button className="chip tap" type="button" onClick={() => setLang(lang === 'en' ? 'sw' : 'en')}>
            {lang === 'en' ? 'EN / SW' : 'SW / EN'}
          </button>
        </div>

        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, marginBottom: 6 }}>{L.setNewPassword}</div>
        <div style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 24, lineHeight: 1.55 }}>{L.setNewPasswordSub}</div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
            <Icon name="lock" style={{ color: 'var(--ink3)' }} />
            <input
              type="password"
              required
              minLength={6}
              autoFocus
              placeholder={L.newPassword}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 15 }}
            />
          </label>
          <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
            <Icon name="check" style={{ color: 'var(--ink3)' }} />
            <input
              type="password"
              required
              minLength={6}
              placeholder={L.confirmPassword}
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 15 }}
            />
          </label>
          {error && <div style={{ color: 'var(--bad)', fontSize: 13, fontWeight: 600 }}>{error}</div>}
          <button className="btn-primary tap" type="submit" disabled={busy} style={{ marginTop: 6, border: 'none' }}>
            {busy ? L.loading : L.save}
          </button>
        </form>

        <button
          className="tap"
          type="button"
          onClick={() => void signOut()}
          style={{ width: '100%', marginTop: 18, background: 'none', border: 'none', fontSize: 13, color: 'var(--ink3)', fontWeight: 600 }}
        >
          {L.signOut}
        </button>
      </div>
    </div>
  );
}
