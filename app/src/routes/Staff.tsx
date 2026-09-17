import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { tintVars } from '../lib/types';

export function Staff() {
  const nav = useNavigate();
  const { L, lang } = useSettings();
  const { staffMembers, addStaffMember, removeStaffMember } = useData();
  const { flash } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  function openAdd() {
    setName('');
    setPhone('');
    setTitle('');
    setAddOpen(true);
  }

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const problem = await addStaffMember({ name, phone, title });
    if (problem === 'PLAN_LIMIT_STAFF') { flash(L.planLimitStaff); nav('/pricing'); return; }
    if (problem) { flash(problem); return; }
    setBusy(false);
    setAddOpen(false);
    flash(lang === 'sw' ? 'Mfanyakazi ameongezwa' : 'Staff member added');
  }

  async function remove(id: string) {
    await removeStaffMember(id);
    flash(lang === 'sw' ? 'Ameondolewa' : 'Removed');
  }

  return (
    <div className="screen sb">
      <ScreenHeader title={L.staffCount} back sub={`${staffMembers.length} ${lang === 'sw' ? 'wafanyakazi' : 'staff'}`} />

      {staffMembers.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, margin: '0 auto 14px', background: 'var(--card2)', display: 'grid', placeItems: 'center', color: 'var(--ink3)' }}>
            <Icon name="user" size={20} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{L.noStaffYet}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink2)' }}>{L.noStaffYetSub}</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 6, marginBottom: 16 }}>
          {staffMembers.map((m, i) => {
            const tv = tintVars(i);
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px', borderBottom: i === staffMembers.length - 1 ? 'none' : '1px solid var(--line)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 11, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Icon name="user" size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600 }}>{[m.title, m.phone].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <button className="icon-btn tap" style={{ width: 32, height: 32 }} onClick={() => remove(m.id)} aria-label={L.removeLine}>
                  <Icon name="x" size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button className="btn-ghost tap" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={openAdd}>
        <Icon name="plus" size={15} />
        {L.addStaffMember}
      </button>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={L.addStaffMember}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            autoFocus
            placeholder={lang === 'sw' ? 'Jina' : 'Name'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="card"
            style={{ padding: '12px 14px', border: 'none', fontSize: 14 }}
          />
          <input
            placeholder={lang === 'sw' ? 'Cheo (hiari) — mfano Mhudumu' : 'Title (optional) — e.g. Cashier'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="card"
            style={{ padding: '12px 14px', border: 'none', fontSize: 14 }}
          />
          <input
            placeholder={lang === 'sw' ? 'Simu (hiari)' : 'Phone (optional)'}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="card"
            style={{ padding: '12px 14px', border: 'none', fontSize: 14 }}
          />
          <button className="btn-primary tap" style={{ width: '100%', marginTop: 4 }} data-disabled={!name.trim() || busy} onClick={save}>
            {L.save}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
