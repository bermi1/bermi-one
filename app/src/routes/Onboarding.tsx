import { useState } from 'react';
import { Icon } from '../lib/icons';
import { useData } from '../state/DataContext';
import { T } from '../lib/i18n';
import { COUNTRIES } from '../lib/countries';
import { BUSINESS_TYPES, tintVars } from '../lib/types';
import { ComingSoonType } from '../components/ComingSoonType';

type Answers = { products: boolean | null; suppliers: boolean | null; credit: boolean | null; staff: boolean | null };

const STEPS = ['welcome', 'setup', 'questions'] as const;

export function Onboarding() {
  const { completeOnboarding } = useData();
  const [lang, setLang] = useState<'en' | 'sw'>('en');
  const L = T[lang];
  const [step, setStep] = useState<(typeof STEPS)[number]>('welcome');

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState('bar');
  const [countryIx, setCountryIx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ products: true, suppliers: true, credit: null, staff: true });
  const [busy, setBusy] = useState(false);

  const stepIx = STEPS.indexOf(step);
  const country = COUNTRIES[countryIx];

  const welcomePoints = [
    { t: lang === 'sw' ? 'Rekodi kinachotokea' : 'Record what happens', icon: 'receipt', tint: 0 },
    { t: lang === 'sw' ? 'Dhibiti bidhaa na fedha' : 'Control stock and money', icon: 'box', tint: 1 },
    { t: lang === 'sw' ? 'Elewa biashara yako' : 'Understand your business', icon: 'chart', tint: 2 },
    { t: lang === 'sw' ? 'Amua kwa uhakika' : 'Decide with confidence', icon: 'spark', tint: 3 },
  ];

  const questions = [
    { k: 'products' as const, text: lang === 'sw' ? 'Unauza bidhaa halisi?' : 'Do you sell physical products?' },
    { k: 'suppliers' as const, text: lang === 'sw' ? 'Unanunua kutoka kwa wasambazaji?' : 'Do you buy stock from suppliers?' },
    { k: 'credit' as const, text: lang === 'sw' ? 'Unauza kwa mkopo?' : 'Do you sell on credit?' },
    { k: 'staff' as const, text: lang === 'sw' ? 'Una wafanyakazi?' : 'Do you have employees?' },
  ];

  async function finish() {
    setBusy(true);
    await completeOnboarding({ name: name.trim() || 'My Business', type, city: city.trim(), countryCode: country.code, answers });
    setBusy(false);
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 20px 0' }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= stepIx ? 'var(--brand)' : 'var(--line)', transition: 'background .2s' }} />
        ))}
        <button className="chip tap" style={{ marginLeft: 10, flexShrink: 0 }} onClick={() => setLang(lang === 'en' ? 'sw' : 'en')} type="button">
          {lang === 'en' ? 'EN/SW' : 'SW/EN'}
        </button>
      </div>

      <div className="screen sb" style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
        {step === 'welcome' && (
          <div style={{ animation: 'slideIn .3s ease' }}>
            <div style={{ marginTop: 18, height: 240, borderRadius: 30, background: 'var(--grad)', position: 'relative', overflow: 'hidden', boxShadow: '0 24px 50px rgba(47,91,255,.35)' }}>
              <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,.12)', top: -60, right: -60 }} />
              <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,.09)', bottom: -50, left: -30 }} />
              <div style={{ position: 'absolute', inset: 0, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,.2)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 18 }}>B</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, padding: '12px 13px', borderRadius: 16, background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(8px)' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 750, color: 'rgba(255,255,255,.75)' }}>{L.sales}</div>
                    <div style={{ marginTop: 3, fontSize: 16, fontWeight: 800, color: '#fff' }}>{country.sym} 1.2M</div>
                  </div>
                  <div style={{ flex: 1, padding: '12px 13px', borderRadius: 16, background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(8px)' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 750, color: 'rgba(255,255,255,.75)' }}>{L.profit}</div>
                    <div style={{ marginTop: 3, fontSize: 16, fontWeight: 800, color: '#fff' }}>{country.sym} 410k</div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 26 }}>
              <div style={{ fontSize: 32, lineHeight: 1.1, fontWeight: 800, letterSpacing: -1.2 }}>
                {L.welcomeTo}
                <br />
                {T.en.appName}
              </div>
              <div style={{ marginTop: 12, fontSize: 15, lineHeight: 1.5, color: 'var(--ink2)', fontWeight: 500 }}>{L.welcomeSub}</div>
              <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {welcomePoints.map((p) => {
                  const tv = tintVars(p.tint);
                  return (
                    <div key={p.t} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 12, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Icon name={p.icon} size={17} />
                      </div>
                      <div style={{ fontSize: 14.5, fontWeight: 700 }}>{p.t}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 'setup' && (
          <div style={{ animation: 'slideIn .3s ease' }}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, marginTop: 20 }}>{L.whatBusiness}</div>
            <div style={{ marginTop: 6, fontSize: 14, color: 'var(--ink2)' }}>{L.whatBusinessSub}</div>

            <input
              placeholder={lang === 'sw' ? 'Jina la biashara' : 'Business name'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="card"
              style={{ width: '100%', marginTop: 20, padding: '14px 16px', border: 'none', fontSize: 15, fontWeight: 600 }}
            />
            <input
              placeholder={lang === 'sw' ? 'Mji (hiari)' : 'City (optional)'}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="card"
              style={{ width: '100%', marginTop: 10, padding: '14px 16px', border: 'none', fontSize: 15, fontWeight: 600 }}
            />

            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {BUSINESS_TYPES.map((b, i) => {
                const tv = tintVars(i);
                const active = type === b.id;
                if (!b.live) return <ComingSoonType key={b.id} name={b.name} icon={b.icon} label={L.comingSoon} />;
                return (
                  <div
                    key={b.id}
                    className="tap"
                    onClick={() => setType(b.id)}
                    style={{
                      padding: '14px 14px',
                      borderRadius: 18,
                      background: active ? 'var(--brandSoft)' : 'var(--card)',
                      border: `1.5px solid ${active ? 'var(--brand)' : 'var(--line)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 10, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Icon name={b.icon} size={15} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{b.name}</div>
                  </div>
                );
              })}
            </div>

            <div className="card" style={{ marginTop: 18, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{L.country}</div>
                <div style={{ marginTop: 3, fontSize: 15, fontWeight: 700 }}>{country.name} · {country.cur}</div>
              </div>
              <button className="chip tap" type="button" onClick={() => setCountryIx((countryIx + 1) % COUNTRIES.length)}>
                {L.change}
              </button>
            </div>
          </div>
        )}

        {step === 'questions' && (
          <div style={{ animation: 'slideIn .3s ease' }}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, marginTop: 20 }}>{L.howOperate}</div>
            <div style={{ marginTop: 6, fontSize: 14, color: 'var(--ink2)' }}>{L.howOperateSub}</div>

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {questions.map((q) => {
                const v = answers[q.k];
                return (
                  <div key={q.k} className="card" style={{ padding: 16 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 12 }}>{q.text}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="tap"
                        onClick={() => setAnswers((a) => ({ ...a, [q.k]: true }))}
                        style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontWeight: 700, fontSize: 13.5, background: v === true ? 'var(--brand)' : 'var(--card2)', color: v === true ? 'var(--brandInk)' : 'var(--ink2)' }}
                      >
                        {L.yes}
                      </button>
                      <button
                        type="button"
                        className="tap"
                        onClick={() => setAnswers((a) => ({ ...a, [q.k]: false }))}
                        style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontWeight: 700, fontSize: 13.5, background: v === false ? 'var(--ink)' : 'var(--card2)', color: v === false ? 'var(--bg)' : 'var(--ink2)' }}
                      >
                        {L.no}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.5 }}>{L.configNote}</div>
          </div>
        )}
      </div>

      <div style={{ padding: '10px 20px calc(20px + env(safe-area-inset-bottom))', maxWidth: 480, margin: '0 auto', width: '100%' }}>
        <button
          className="btn-primary tap"
          style={{ width: '100%', border: 'none' }}
          disabled={busy}
          onClick={() => {
            if (step === 'welcome') setStep('setup');
            else if (step === 'setup') setStep('questions');
            else void finish();
          }}
        >
          {step === 'welcome' ? L.getStarted : step === 'setup' ? L.continue : busy ? L.loading : L.openWorkspace}
        </button>
        {step !== 'welcome' && (
          <div
            className="tap"
            style={{ textAlign: 'center', marginTop: 12, fontSize: 13.5, fontWeight: 700, color: 'var(--ink2)' }}
            onClick={() => setStep(step === 'setup' ? 'welcome' : 'setup')}
          >
            {L.back}
          </div>
        )}
      </div>
    </div>
  );
}
