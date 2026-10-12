import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { tintVars } from '../lib/types';
import { ChoosePin } from '../components/StaffAccess';
import { PIN_LENGTH } from '../components/PinPad';

export function Staff() {
  const nav = useNavigate();
  const { L, lang } = useSettings();
  const { staffMembers, addStaffMember, removeStaffMember, setStaffPin, fetchStaffWithPins, ownerPinSet, setOwnerPin, lockToStaff, activeBusiness } = useData();
  const salon = activeBusiness?.type === 'barber';
  const [salonRole, setSalonRole] = useState<'barber' | 'cashier' | 'both'>('barber');
  const roleLabel = (r?: string) => (r === 'cashier' ? (sw ? 'Keshia' : 'Cashier') : r === 'both' ? (sw ? 'Kinyozi na keshia' : 'Barber & cashier') : (sw ? 'Kinyozi' : 'Barber'));
  const sw = lang === 'sw';
  const { flash } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [withPin, setWithPin] = useState<Set<string>>(new Set());
  const [pinFor, setPinFor] = useState<{ id: string; name: string } | null>(null);
  const [ownerPinOpen, setOwnerPinOpen] = useState(false);

  useEffect(() => { void fetchStaffWithPins().then(setWithPin); }, [fetchStaffWithPins, staffMembers]);

  function openAdd() {
    setName('');
    setPhone('');
    setTitle('');
    setPin('');
    setSalonRole('barber');
    setAddOpen(true);
  }

  async function save() {
    if (!name.trim() || pin.length !== PIN_LENGTH) return;
    setBusy(true);
    const problem = await addStaffMember({ name, phone, title: salon && !title.trim() ? roleLabel(salonRole) : title, pin, ...(salon ? { salonRole } : {}) });
    if (problem === 'PLAN_LIMIT_STAFF') { setBusy(false); flash(L.planLimitStaff); nav('/pricing'); return; }
    if (problem) { setBusy(false); flash(problem); return; }
    setWithPin(await fetchStaffWithPins());
    setBusy(false);
    setAddOpen(false);
    flash(lang === 'sw' ? 'Mfanyakazi ameongezwa' : 'Staff member added');
  }

  async function remove(id: string) {
    await removeStaffMember(id);
    flash(lang === 'sw' ? 'Ameondolewa' : 'Removed');
  }

  return (
    <div className="screen sb desk-wide">
      <ScreenHeader title={L.staffCount} back sub={`${staffMembers.length} ${lang === 'sw' ? 'wafanyakazi' : 'staff'}`} />

      <div className="desk">
      <aside className="desk-side">
      {/* How it works, said once, where the owner sets it up. */}
      <div className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--brandSoft)', color: 'var(--brand)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name="users" size={16} />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5, fontWeight: 600 }}>
          {sw
            ? 'Njia mbili: kwenye simu yao wenyewe — skrini ya kuingia → "Mfanyakazi" → namba ya simu na PIN. Au kwenye simu ya biashara — gusa "Mmiliki" juu kisha "Badili kwenda hali ya wafanyakazi". Hawaoni faida wala hawabadilishi bei.'
            : 'Two ways in: on their own phone — login screen → “Staff” → phone number and PIN. Or on the business’s phone — tap “Owner” at the top, then “Switch to staff mode”. Either way they never see profit or change prices.'}
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 11, background: ownerPinSet ? 'var(--okSoft)' : 'var(--warnSoft)', color: ownerPinSet ? 'var(--ok)' : 'var(--warn)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name="shield" size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800 }}>{sw ? 'PIN ya mmiliki' : 'Owner PIN'}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600 }}>
            {ownerPinSet ? (sw ? 'Imewekwa — inahitajika kutoka hali ya wafanyakazi' : 'Set — needed to leave staff mode') : (sw ? 'Haijawekwa' : 'Not set yet')}
          </div>
        </div>
        <button className="chip tap" onClick={() => setOwnerPinOpen(true)}>{ownerPinSet ? (sw ? 'Badili' : 'Change') : (sw ? 'Weka' : 'Set')}</button>
      </div>

      </aside>

      <div className="desk-main">
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
                  <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600 }}>{[salon ? roleLabel(m.salon_role) : m.title, m.phone].filter(Boolean).join(' · ') || '—'}</div>
                  <div style={{ marginTop: 3, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: withPin.has(m.id) ? 'var(--ok)' : 'var(--warn)' }}>
                    {!withPin.has(m.id) ? (sw ? 'Hana PIN — hawezi kuingia' : 'No PIN — cannot sign in')
                      : hasPhone(m.phone) ? (sw ? 'Anaingia kwenye simu yake pia' : 'Can sign in on their own phone')
                      : (sw ? 'Simu ya biashara tu — weka namba yake' : 'Shared phone only — add their number')}
                  </div>
                </div>
                {withPin.has(m.id) && hasPhone(m.phone) && (
                  <a className="icon-btn tap" style={{ width: 32, height: 32 }} target="_blank" rel="noreferrer" aria-label={sw ? 'Tuma maelekezo' : 'Send sign-in steps'}
                    href={`https://wa.me/${intl(m.phone!)}?text=${encodeURIComponent(sw
                      ? `Habari ${m.name.split(' ')[0]}! Ingia ${activeBusiness?.name} kwenye Bermi One: fungua ${window.location.origin}, gusa "Mfanyakazi", weka namba hii ya simu na PIN yako.`
                      : `Hi ${m.name.split(' ')[0]}! To sign in to ${activeBusiness?.name} on Bermi One: open ${window.location.origin}, tap "Staff", then enter this phone number and your PIN.`)}`}>
                    <Icon name="chat" size={14} />
                  </a>
                )}
                <button className="chip tap" style={{ padding: '6px 10px', fontSize: 11.5 }} onClick={() => setPinFor({ id: m.id, name: m.name })}>
                  {withPin.has(m.id) ? (sw ? 'Badili PIN' : 'Change PIN') : (sw ? 'Weka PIN' : 'Set PIN')}
                </button>
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
      </div>
      </div>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={L.addStaffMember}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            autoFocus
            placeholder={lang === 'sw' ? 'Jina' : 'Name'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field"
            
          />
          {salon && (
            <div className="s-seg">
              {(['barber', 'cashier', 'both'] as const).map((r) => (
                <button key={r} type="button" aria-pressed={salonRole === r} onClick={() => setSalonRole(r)}>{r === 'both' ? (sw ? 'Wote wawili' : 'Both') : roleLabel(r)}</button>
              ))}
            </div>
          )}
          {!salon && <input
            placeholder={lang === 'sw' ? 'Cheo (hiari) — mfano Mhudumu' : 'Title (optional) — e.g. Cashier'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="field"
            
          />}
          <input
            placeholder={lang === 'sw' ? 'Simu (hiari)' : 'Phone (optional)'}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="field"
            
          />
          <input
            placeholder={sw ? `PIN ya tarakimu ${PIN_LENGTH} (ya kuingia)` : `${PIN_LENGTH}-digit PIN (to sign in)`}
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH))}
            className="field"
            style={{ letterSpacing: pin ? 6 : 0 }}
          />
          <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600, marginTop: -2 }}>
            {sw ? 'Mpe mfanyakazi PIN hii kwa siri. Wataitumia kuingia kwenye kifaa cha biashara.' : 'Give this PIN to them privately. They use it to sign in on the business device.'}
          </div>
          <button className="btn-primary tap" style={{ width: '100%', marginTop: 4 }} data-disabled={!name.trim() || pin.length !== PIN_LENGTH || busy} onClick={save}>
            {L.save}
          </button>
        </div>
      </Sheet>

      <Sheet open={!!pinFor} onClose={() => setPinFor(null)} title={pinFor ? `${sw ? 'PIN ya' : 'PIN for'} ${pinFor.name}` : ''}>
        {pinFor && (
          <ChoosePin
            title={sw ? 'Chagua PIN mpya' : 'Choose a new PIN'}
            subtitle={sw ? 'Mpe kwa siri.' : 'Give it to them privately.'}
            onSet={async (p) => {
              const err = await setStaffPin(pinFor.id, p);
              if (err) return err;
              setWithPin(await fetchStaffWithPins());
              setPinFor(null);
              flash(sw ? 'PIN imewekwa' : 'PIN saved');
              return null;
            }}
          />
        )}
      </Sheet>

      <Sheet open={ownerPinOpen} onClose={() => setOwnerPinOpen(false)} title={sw ? 'PIN ya mmiliki' : 'Owner PIN'}>
        <ChoosePin
          title={sw ? 'Chagua PIN ya mmiliki' : 'Choose your owner PIN'}
          subtitle={sw ? 'Usiwape wafanyakazi.' : 'Do not share it with staff.'}
          onSet={async (p) => {
            const err = await setOwnerPin(p);
            if (err) return err;
            setOwnerPinOpen(false);
            flash(sw ? 'PIN ya mmiliki imewekwa' : 'Owner PIN saved');
            return null;
          }}
        />
      </Sheet>

      {staffMembers.length > 0 && ownerPinSet && (
        <button className="btn-primary tap" style={{ width: '100%', marginTop: 10, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => { lockToStaff(); nav('/home'); }}>
          <Icon name="users" size={15} />
          {sw ? 'Anza hali ya wafanyakazi kwenye kifaa hiki' : 'Start staff mode on this device'}
        </button>
      )}
    </div>
  );
}

function hasPhone(p: string | null | undefined) {
  return (p || '').replace(/\D/g, '').length >= 9;
}

function intl(p: string) {
  const d = p.replace(/\D/g, '');
  return d.startsWith('0') ? '255' + d.slice(1) : d;
}
