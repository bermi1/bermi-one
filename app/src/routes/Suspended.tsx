import { useEffect, useState } from 'react';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import { fetchMySubscription, type Subscription } from '../lib/platform';
import { formatMoney } from '../lib/countries';
import { countryByCode } from '../lib/countries';

/**
 * What a client sees when their subscription has lapsed.
 *
 * Deliberately not a dead end: their books are still theirs, the screen says
 * exactly why access stopped and what it costs to restore it, and switching to
 * another business they own still works. Nothing is being held hostage — only
 * new writes are blocked, which the database enforces regardless of this screen.
 */
export function Suspended() {
  const { lang } = useSettings();
  const { activeBusiness, businesses, switchBusiness } = useData();
  const { signOut } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);

  useEffect(() => {
    void fetchMySubscription().then(setSub);
  }, []);

  const sw = lang === 'sw';
  const amount = sub?.subscription_plans?.amount ?? 0;
  const money = formatMoney(amount, countryByCode(activeBusiness?.country_code || 'TZ'));

  return (
    <div className="screen sb" style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div className="card" style={{ padding: 26, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 17, margin: '0 auto 16px', background: 'var(--badSoft)', color: 'var(--bad)', display: 'grid', placeItems: 'center' }}>
            <Icon name="lock" size={22} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            {sw ? 'Akaunti imesimamishwa' : 'Access is paused'}
          </div>
          <div style={{ marginTop: 8, fontSize: 13.5, color: 'var(--ink2)', lineHeight: 1.6 }}>
            {activeBusiness?.suspended_reason
              || (sw
                ? 'Malipo ya huduma hayajakamilika. Taarifa zako zote zipo salama — huwezi kuongeza mpya mpaka malipo yakamilike.'
                : 'The subscription for this business has not been settled. Everything you have recorded is safe and still readable — nothing new can be added until the bill is paid.')}
          </div>

          {sub?.subscription_plans && (
            <div className="card" style={{ marginTop: 16, padding: 14, background: 'var(--card2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {sub.subscription_plans.name}
              </div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800 }}>{money}</div>
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.5 }}>
            {sw ? 'Wasiliana na Bermi Techs kurejesha huduma.' : 'Contact Bermi Techs to restore access.'}
          </div>
        </div>

        {businesses.length > 1 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
              {sw ? 'Biashara nyingine' : 'Your other businesses'}
            </div>
            <div className="card" style={{ padding: 6 }}>
              {businesses.filter((b) => b.id !== activeBusiness?.id).map((b, i, arr) => (
                <div
                  key={b.id}
                  className="tap"
                  onClick={() => void switchBusiness(b.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 8px', borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--line)' }}
                >
                  <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{b.name}</div>
                  {b.suspended
                    ? <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--bad)' }}>{sw ? 'Imesimama' : 'Paused'}</span>
                    : <Icon name="right" size={15} style={{ color: 'var(--ink3)' }} />}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          className="btn-ghost tap"
          style={{ width: '100%', marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--bad)' }}
          onClick={() => void signOut()}
        >
          <Icon name="logout" size={15} />
          {sw ? 'Toka' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}
