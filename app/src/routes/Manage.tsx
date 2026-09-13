import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import { useToast } from '../state/ToastContext';
import { BUSINESS_TYPES, bizMeta, tintVars } from '../lib/types';

export function Manage() {
  const nav = useNavigate();
  const { L, lang, theme, country, countries } = useSettings();
  const { businesses, activeBusiness, switchBusiness, addBusiness, updateBusiness, setLang, setTheme, setCountryCode, displayName } = useData();
  const { signOut } = useAuth();
  const { flash } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('retail');

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(activeBusiness?.name || '');
  const [editCity, setEditCity] = useState(activeBusiness?.city || '');

  const meta = activeBusiness ? bizMeta(activeBusiness.type) : null;

  async function submitAdd() {
    if (!newName.trim()) return;
    await addBusiness({ name: newName.trim(), type: newType, city: '' });
    setAddOpen(false);
    setNewName('');
    flash(L.addBusiness);
  }

  async function saveEdit() {
    await updateBusiness({ name: editName.trim() || activeBusiness?.name, city: editCity.trim() });
    setEditOpen(false);
    flash(L.save);
  }

  const groups: { title: string; items: { name: string; meta: string; icon: string }[] }[] = [
    {
      title: L.people,
      items: [
        { name: L.staffCount, meta: '1', icon: 'user' },
        { name: L.roles, meta: '2', icon: 'shield' },
      ],
    },
    {
      title: L.partners,
      items: [
        { name: L.suppliers, meta: '—', icon: 'truck' },
        { name: L.customers, meta: '—', icon: 'user' },
      ],
    },
  ];

  return (
    <div className="screen sb">
      <ScreenHeader title={L.manage} sub={displayName} />

      <div className="card tap" onClick={() => nav('/ai')} style={{ padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, background: 'var(--grad)' }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,.2)', display: 'grid', placeItems: 'center', color: '#fff' }}>
          <Icon name="spark" size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#fff' }}>{L.bermiAI}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.85)', fontWeight: 600 }}>{L.askAnything}</div>
        </div>
        <Icon name="right" size={16} style={{ color: '#fff' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {L.portfolio} · {businesses.length} {L.businesses}
        </div>
      </div>
      <div className="card" style={{ padding: 6, marginBottom: 10 }}>
        {businesses.map((b, i) => {
          const bm = bizMeta(b.type);
          const tv = tintVars(i);
          const active = b.id === activeBusiness?.id;
          return (
            <div
              key={b.id}
              className="tap"
              onClick={() => switchBusiness(b.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 8px', borderBottom: i === businesses.length - 1 ? 'none' : '1px solid var(--line)', background: active ? 'var(--brandSoft)' : 'transparent', borderRadius: 12 }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 10, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name={bm.icon} size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{b.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>{[b.city, bm.name].filter(Boolean).join(' · ')}</div>
              </div>
              {active && <Icon name="check" size={15} style={{ color: 'var(--brand)' }} />}
            </div>
          );
        })}
      </div>
      <button className="btn-ghost tap" style={{ width: '100%', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setAddOpen(true)}>
        <Icon name="plus" size={15} />
        {L.addBusiness}
      </button>

      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>{L.wholeBusiness}</div>
      <div className="card" style={{ padding: 6, marginBottom: 18 }}>
        <div className="tap" onClick={() => setEditOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 8px' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--brandSoft)', color: 'var(--brand)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name={meta?.icon || 'building'} size={15} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{L.businessProfile}</div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>{activeBusiness?.name}{activeBusiness?.city ? ` · ${activeBusiness.city}` : ''}</div>
          </div>
          <Icon name="edit" size={14} style={{ color: 'var(--ink3)' }} />
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.title} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>{g.title}</div>
          <div className="card" style={{ padding: 6 }}>
            {g.items.map((it, i) => (
              <div key={it.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 8px', borderBottom: i === g.items.length - 1 ? 'none' : '1px solid var(--line)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--card2)', color: 'var(--ink2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Icon name={it.icon} size={15} />
                </div>
                <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{it.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink3)', fontWeight: 700 }}>{it.meta}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>{L.settings}</div>
      <div className="card" style={{ padding: 6, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 8px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--card2)', color: 'var(--ink2)', display: 'grid', placeItems: 'center' }}>
            <Icon name="globe" size={15} />
          </div>
          <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{L.language}</div>
          <button className="chip tap" onClick={() => setLang(lang === 'en' ? 'sw' : 'en')} style={{ padding: '6px 12px', fontSize: 12 }}>
            {lang === 'en' ? 'English' : 'Kiswahili'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 8px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--card2)', color: 'var(--ink2)', display: 'grid', placeItems: 'center' }}>
            <Icon name={theme === 'light' ? 'sun' : 'moon'} size={15} />
          </div>
          <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{lang === 'sw' ? 'Mwonekano' : 'Appearance'}</div>
          <button className="chip tap" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} style={{ padding: '6px 12px', fontSize: 12 }}>
            {theme === 'light' ? (lang === 'sw' ? 'Nyeupe' : 'Light') : lang === 'sw' ? 'Giza' : 'Dark'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 8px' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--card2)', color: 'var(--ink2)', display: 'grid', placeItems: 'center' }}>
            <Icon name="swap" size={15} />
          </div>
          <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{L.country}</div>
          <select
            value={country.code}
            onChange={(e) => setCountryCode(e.target.value)}
            style={{ border: 'none', background: 'var(--card2)', borderRadius: 10, padding: '6px 10px', fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} · {c.cur}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button className="btn-ghost tap" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--bad)' }} onClick={() => signOut()}>
        <Icon name="logout" size={15} />
        {L.signOut}
      </button>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={L.addBusiness}>
        <input autoFocus placeholder={L.businessProfile} value={newName} onChange={(e) => setNewName(e.target.value)} className="card" style={{ width: '100%', padding: '14px 16px', border: 'none', fontSize: 15, fontWeight: 600, marginBottom: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {BUSINESS_TYPES.map((b) => (
            <div key={b.id} className="tap" onClick={() => setNewType(b.id)} style={{ padding: '10px 12px', borderRadius: 14, background: newType === b.id ? 'var(--brandSoft)' : 'var(--card2)', border: `1.5px solid ${newType === b.id ? 'var(--brand)' : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name={b.icon} size={14} />
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{b.name}</span>
            </div>
          ))}
        </div>
        <button className="btn-primary tap" style={{ width: '100%' }} onClick={submitAdd}>
          {L.save}
        </button>
      </Sheet>

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title={L.businessProfile}>
        <input value={editName} onChange={(e) => setEditName(e.target.value)} className="card" style={{ width: '100%', padding: '14px 16px', border: 'none', fontSize: 15, fontWeight: 600, marginBottom: 10 }} />
        <input value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder={L.locations} className="card" style={{ width: '100%', padding: '14px 16px', border: 'none', fontSize: 15, fontWeight: 600, marginBottom: 16 }} />
        <button className="btn-primary tap" style={{ width: '100%' }} onClick={saveEdit}>
          {L.save}
        </button>
      </Sheet>
    </div>
  );
}
