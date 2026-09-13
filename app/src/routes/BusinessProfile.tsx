import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { COUNTRIES } from '../lib/countries';
import { BUSINESS_TYPES, tintVars } from '../lib/types';

type Answers = { products: boolean | null; suppliers: boolean | null; credit: boolean | null; staff: boolean | null };

export function BusinessProfile() {
  const nav = useNavigate();
  const { L, lang } = useSettings();
  const { activeBusiness, updateBusiness } = useData();
  const { flash } = useToast();

  const [name, setName] = useState(activeBusiness?.name || '');
  const [city, setCity] = useState(activeBusiness?.city || '');
  const [type, setType] = useState(activeBusiness?.type || 'other');
  const [countryIx, setCountryIx] = useState(() => Math.max(0, COUNTRIES.findIndex((c) => c.code === activeBusiness?.country_code)));
  const [answers, setAnswers] = useState<Answers>({
    products: (activeBusiness?.answers?.products as boolean | null) ?? null,
    suppliers: (activeBusiness?.answers?.suppliers as boolean | null) ?? null,
    credit: (activeBusiness?.answers?.credit as boolean | null) ?? null,
    staff: (activeBusiness?.answers?.staff as boolean | null) ?? null,
  });
  const [busy, setBusy] = useState(false);

  const questions: { k: keyof Answers; text: string }[] = [
    { k: 'products', text: lang === 'sw' ? 'Unauza bidhaa halisi?' : 'Do you sell physical products?' },
    { k: 'suppliers', text: lang === 'sw' ? 'Unanunua kutoka kwa wasambazaji?' : 'Do you buy stock from suppliers?' },
    { k: 'credit', text: lang === 'sw' ? 'Unauza kwa mkopo?' : 'Do you sell on credit?' },
    { k: 'staff', text: lang === 'sw' ? 'Una wafanyakazi?' : 'Do you have employees?' },
  ];

  async function save() {
    if (!name.trim()) {
      flash(lang === 'sw' ? 'Weka jina la biashara' : 'Enter a business name');
      return;
    }
    setBusy(true);
    await updateBusiness({
      name: name.trim(),
      city: city.trim(),
      type,
      country_code: COUNTRIES[countryIx].code,
      answers,
    });
    setBusy(false);
    flash(lang === 'sw' ? 'Imehifadhiwa' : 'Saved');
    nav('/manage');
  }

  if (!activeBusiness) return null;

  return (
    <div className="screen sb">
      <ScreenHeader title={L.businessProfile} back sub={lang === 'sw' ? 'Sasisha taarifa za biashara yako' : 'Keep your business details up to date'} />

      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink3)', marginBottom: 8 }}>
        {lang === 'sw' ? 'Jina la biashara' : 'Business name'}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="card"
        style={{ width: '100%', padding: '14px 16px', border: 'none', fontSize: 15, fontWeight: 600, marginBottom: 16 }}
      />

      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink3)', marginBottom: 8 }}>{L.locations}</div>
      <input
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder={lang === 'sw' ? 'Mji' : 'City'}
        className="card"
        style={{ width: '100%', padding: '14px 16px', border: 'none', fontSize: 15, fontWeight: 600, marginBottom: 16 }}
      />

      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink3)', marginBottom: 8 }}>{L.businessType}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {BUSINESS_TYPES.map((b, i) => {
          const tv = tintVars(i);
          const active = type === b.id;
          return (
            <div
              key={b.id}
              className="tap"
              onClick={() => setType(b.id)}
              style={{ padding: '13px 14px', borderRadius: 16, background: active ? 'var(--brandSoft)' : 'var(--card)', border: `1.5px solid ${active ? 'var(--brand)' : 'var(--line)'}`, display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 9, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name={b.icon} size={14} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{b.name}</div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{L.country}</div>
          <div style={{ marginTop: 3, fontSize: 15, fontWeight: 700 }}>{COUNTRIES[countryIx].name} · {COUNTRIES[countryIx].cur}</div>
        </div>
        <button className="chip tap" type="button" onClick={() => setCountryIx((countryIx + 1) % COUNTRIES.length)}>
          {L.change}
        </button>
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink3)', marginBottom: 8 }}>{L.howOperate}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {questions.map((q) => {
          const v = answers[q.k];
          return (
            <div key={q.k} className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{q.text}</div>
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

      <button className="btn-primary tap" style={{ width: '100%' }} disabled={busy} onClick={save}>
        {busy ? L.loading : L.save}
      </button>
    </div>
  );
}
