import { useEffect, useState } from 'react';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { tintVars } from '../lib/types';
import { PinPad, pinMessage } from './PinPad';

/**
 * How the business's own device changes hands.
 *
 * Staff do not get accounts of their own: they work on the bar's phone or
 * tablet, which is signed into the owner's account. What separates the two
 * sides is PINs. A staff member signs in with theirs and everything they do is
 * stamped with their name; getting back to the owner's side — prices, profit,
 * reports — takes the owner's PIN, or the account password until one is set.
 */

/** Back to owner mode. The owner PIN if there is one, else the account password. */
export function OwnerUnlock({ onDone }: { onDone?: () => void }) {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const { unlockOwner, ownerPinSet } = useData();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (ownerPinSet) {
    return (
      <PinPad
        title={sw ? 'PIN ya mmiliki' : 'Owner PIN'}
        subtitle={sw ? 'Weka PIN yako kurudi upande wa mmiliki.' : 'Enter your PIN to get back to the owner side.'}
        onComplete={async (pin) => {
          const r = await unlockOwner(pin);
          if (r === 'ok') onDone?.();
          return pinMessage(r, sw);
        }}
      />
    );
  }

  return (
    <form
      className="pin"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const r = await unlockOwner(password);
        setBusy(false);
        if (r === 'ok') onDone?.();
        else setError(r === 'wrong' ? (sw ? 'Nenosiri si sahihi.' : 'That password is not right.') : (pinMessage(r, sw) || ''));
      }}
    >
      <div className="pin-title">{sw ? 'Wewe ni mmiliki?' : 'Are you the owner?'}</div>
      <div className="pin-sub">
        {sw ? 'Weka nenosiri la akaunti. Kisha weka PIN ya mmiliki ili iwe haraka zaidi.' : 'Enter the account password. Set an owner PIN afterwards to make this quicker.'}
      </div>
      <input
        type="password"
        className="card"
        autoFocus
        autoComplete="current-password"
        placeholder={sw ? 'Nenosiri' : 'Password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: '100%', padding: '14px 16px', border: 'none', marginTop: 14 }}
      />
      <div className="pin-error" role="alert">{error}</div>
      <button className="btn-primary tap" type="submit" data-disabled={!password || busy} style={{ width: '100%', border: 'none' }}>
        {sw ? 'Fungua' : 'Unlock'}
      </button>
    </form>
  );
}

/** Choose a PIN, then type it again. Resolves via onSet with the PIN both times agreed on. */
export function ChoosePin({ title, subtitle, onSet }: {
  title: string;
  subtitle?: string;
  onSet: (pin: string) => Promise<string | null>;
}) {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const [first, setFirst] = useState<string | null>(null);

  if (first === null) {
    return (
      <PinPad
        key="first"
        title={title}
        subtitle={subtitle}
        onComplete={async (pin) => {
          if (/^(\d)\1{3}$/.test(pin) || pin === '1234') {
            return sw ? 'Rahisi mno kukisia. Chagua nyingine.' : 'Too easy to guess. Pick another.';
          }
          setFirst(pin);
          return null;
        }}
      />
    );
  }
  return (
    <PinPad
      key="second"
      title={sw ? 'Rudia PIN' : 'Type it again'}
      subtitle={sw ? 'Kuhakikisha hukukosea.' : 'To make sure it was what you meant.'}
      onComplete={async (pin) => {
        if (pin !== first) {
          setFirst(null);
          return sw ? 'Hazilingani. Anza upya.' : 'Those did not match. Start again.';
        }
        return onSet(pin);
      }}
    />
  );
}

/**
 * "Who's working?" — what staff mode shows until someone signs in.
 *
 * Stands in front of every screen, so nothing is recorded under nobody's name.
 */
export function StaffSignIn() {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const { activeBusiness, staffMembers, signInStaff, fetchStaffWithPins } = useData();
  const [withPin, setWithPin] = useState<Set<string> | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [owner, setOwner] = useState(false);

  useEffect(() => { void fetchStaffWithPins().then(setWithPin); }, [fetchStaffWithPins, staffMembers]);

  const member = staffMembers.find((m) => m.id === picked);

  return (
    <div className="staff-gate">
      <div className="staff-gate-card">
        <div className="staff-gate-head">
          <img src="/icons/bermi-mark.svg" alt="" width={40} height={40} />
          <div style={{ minWidth: 0 }}>
            <div className="staff-gate-biz">{activeBusiness?.name || 'Bermi One'}</div>
            <div className="staff-gate-mode">{sw ? 'Hali ya wafanyakazi' : 'Staff mode'}</div>
          </div>
        </div>

        {owner ? (
          <>
            <OwnerUnlock />
            <button type="button" className="staff-gate-back tap" onClick={() => setOwner(false)}>
              <Icon name="left" size={14} /> {sw ? 'Rudi' : 'Back'}
            </button>
          </>
        ) : member ? (
          <>
            <PinPad
              title={member.name}
              subtitle={sw ? 'Weka PIN yako kuanza zamu.' : 'Enter your PIN to start your shift.'}
              onComplete={async (pin) => pinMessage(await signInStaff(member.id, pin), sw)}
            />
            <button type="button" className="staff-gate-back tap" onClick={() => setPicked(null)}>
              <Icon name="left" size={14} /> {sw ? 'Si mimi' : 'Not me'}
            </button>
          </>
        ) : (
          <>
            <div className="staff-gate-title">{sw ? 'Nani anafanya kazi?' : 'Who’s working?'}</div>
            <div className="staff-gate-sub">{sw ? 'Gusa jina lako.' : 'Tap your name.'}</div>
            {staffMembers.length === 0 ? (
              <div className="staff-gate-empty">
                {sw
                  ? 'Hakuna mfanyakazi bado. Mmiliki anaweza kuongeza wafanyakazi kwenye Simamia → Wafanyakazi.'
                  : 'No staff yet. The owner adds staff in Manage → Staff, each with their own PIN.'}
              </div>
            ) : (
              <div className="staff-gate-grid">
                {staffMembers.map((m, i) => {
                  const tv = tintVars(i);
                  const ready = withPin?.has(m.id) ?? true;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="staff-gate-person tap"
                      data-disabled={!ready || undefined}
                      style={{ animationDelay: `${i * 0.04}s` }}
                      onClick={() => ready && setPicked(m.id)}
                    >
                      <span className="staff-gate-avatar" style={{ background: tv.soft, color: tv.ink }}>
                        {m.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                      <span className="staff-gate-name">{m.name}</span>
                      <span className="staff-gate-role">{ready ? (m.title || (sw ? 'Mfanyakazi' : 'Staff')) : (sw ? 'Hana PIN' : 'No PIN yet')}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <button type="button" className="staff-gate-owner tap" onClick={() => setOwner(true)}>
              <Icon name="shield" size={15} /> {sw ? 'Mimi ni mmiliki' : 'I’m the owner'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The header chip's sheet body. Owner side: hand the device to staff (setting
 * an owner PIN first if there is none — otherwise the switch locks nothing).
 * Staff side: end your shift, or owner access.
 */
export function RolePanel({ onClose }: { onClose: () => void }) {
  const { lang, owner } = useSettings();
  const sw = lang === 'sw';
  const { lockToStaff, ownerPinSet, setOwnerPin, activeStaff, signOutStaff } = useData();
  const [step, setStep] = useState<'menu' | 'setpin' | 'unlock'>('menu');

  if (owner) {
    if (step === 'setpin' || !ownerPinSet) {
      return (
        <ChoosePin
          title={sw ? 'Weka PIN ya mmiliki' : 'Set an owner PIN'}
          subtitle={sw
            ? 'Wafanyakazi hawataweza kurudi upande wa mmiliki bila PIN hii.'
            : 'Staff will not be able to get back to the owner side — or see profit — without it.'}
          onSet={async (pin) => {
            const err = await setOwnerPin(pin);
            if (err) return err;
            lockToStaff();
            onClose();
            return null;
          }}
        />
      );
    }
    return (
      <div className="role-panel">
        <p>{sw
          ? 'Kifaa kitaonyesha skrini ya kuingia kwa wafanyakazi. Faida, bei na ripoti zitafichwa mpaka PIN ya mmiliki iwekwe.'
          : 'This device will show the staff sign-in. Profit, prices and reports stay hidden until the owner PIN is entered.'}</p>
        <button className="btn-primary tap" style={{ width: '100%', border: 'none' }} onClick={() => { lockToStaff(); onClose(); }}>
          {sw ? 'Badili kwenda hali ya wafanyakazi' : 'Switch to staff mode'}
        </button>
        <button className="btn-ghost tap" style={{ width: '100%', marginTop: 8 }} onClick={() => setStep('setpin')}>
          {sw ? 'Badili PIN ya mmiliki' : 'Change owner PIN'}
        </button>
      </div>
    );
  }

  if (step === 'unlock') return <OwnerUnlock onDone={onClose} />;

  return (
    <div className="role-panel">
      {activeStaff && (
        <div className="role-who">
          <Icon name="user" size={16} />
          <span>{sw ? 'Umeingia kama' : 'Signed in as'} <strong>{activeStaff.name}</strong></span>
        </div>
      )}
      <button className="btn-primary tap" style={{ width: '100%', border: 'none' }} onClick={() => { signOutStaff(); onClose(); }}>
        {sw ? 'Maliza zamu / badili mtu' : 'End shift / switch person'}
      </button>
      <button className="btn-ghost tap" style={{ width: '100%', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setStep('unlock')}>
        <Icon name="shield" size={15} /> {sw ? 'Upande wa mmiliki' : 'Owner access'}
      </button>
    </div>
  );
}
