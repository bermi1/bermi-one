import { useState } from 'react';
import { Sheet } from './Sheet';
import { Icon } from '../lib/icons';
import { useData } from '../state/DataContext';
import { useSettings } from '../lib/useSettings';
import { bizMeta, BUSINESS_TYPES, tintVars } from '../lib/types';
import { COUNTRIES } from '../lib/countries';
import { useToast } from '../state/ToastContext';

export function BusinessSwitchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { L } = useSettings();
  const { businesses, activeBusiness, switchBusiness, addBusiness } = useData();
  const { flash } = useToast();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('retail');
  const [countryIx, setCountryIx] = useState(0);

  async function submitAdd() {
    if (!name.trim()) return;
    await addBusiness({ name: name.trim(), type, city: '', countryCode: COUNTRIES[countryIx].code });
    setAdding(false);
    setName('');
    flash(L.addBusiness);
  }

  return (
    <Sheet open={open} onClose={onClose} title={adding ? L.addBusiness : L.switchBusiness} sub={adding ? undefined : L.switchSub}>
      {!adding ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {businesses.map((b, i) => {
              const meta = bizMeta(b.type);
              const tv = tintVars(i);
              const active = b.id === activeBusiness?.id;
              return (
                <div
                  key={b.id}
                  className="tap"
                  onClick={async () => {
                    await switchBusiness(b.id);
                    onClose();
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, background: active ? 'var(--brandSoft)' : 'var(--card2)', border: `1.5px solid ${active ? 'var(--brand)' : 'transparent'}` }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon name={meta.icon} size={17} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{[b.city, meta.name].filter(Boolean).join(' · ')}</div>
                  </div>
                  {active && <Icon name="check" size={16} style={{ color: 'var(--brand)' }} />}
                </div>
              );
            })}
          </div>
          <button className="btn-ghost tap" style={{ width: '100%', marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} />
            {L.addBusiness}
          </button>
        </>
      ) : (
        <>
          <input
            autoFocus
            placeholder={L.businessProfile}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="card"
            style={{ width: '100%', padding: '14px 16px', border: 'none', fontSize: 15, fontWeight: 600, marginBottom: 12 }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {BUSINESS_TYPES.map((b) => (
              <div
                key={b.id}
                className="tap"
                onClick={() => setType(b.id)}
                style={{ padding: '10px 12px', borderRadius: 14, background: type === b.id ? 'var(--brandSoft)' : 'var(--card2)', border: `1.5px solid ${type === b.id ? 'var(--brand)' : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Icon name={b.icon} size={14} />
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{b.name}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{L.country}</div>
              <div style={{ marginTop: 3, fontSize: 14, fontWeight: 700 }}>{COUNTRIES[countryIx].name} · {COUNTRIES[countryIx].cur}</div>
            </div>
            <button className="chip tap" type="button" onClick={() => setCountryIx((countryIx + 1) % COUNTRIES.length)}>
              {L.change}
            </button>
          </div>
          <button className="btn-primary tap" style={{ width: '100%' }} onClick={submitAdd}>
            {L.save}
          </button>
        </>
      )}
    </Sheet>
  );
}
