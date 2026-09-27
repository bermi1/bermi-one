import { useEffect, useState } from 'react';
import { Icon } from '../lib/icons';

export const PIN_LENGTH = 4;

/**
 * A four-digit PIN pad.
 *
 * Big keys, because it is used standing at a counter with wet hands, and it
 * submits itself on the fourth digit — one fewer tap, and no "OK" button to
 * miss. `onComplete` resolves to null when the PIN was accepted, or to the
 * message to show; a rejection shakes the dots and clears them.
 */
export function PinPad({ title, subtitle, onComplete, footer }: {
  title: string;
  subtitle?: string;
  onComplete: (pin: string) => Promise<string | null>;
  footer?: React.ReactNode;
}) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);

  async function press(d: string) {
    if (busy || pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length === PIN_LENGTH) {
      setBusy(true);
      const problem = await onComplete(next);
      setBusy(false);
      if (problem) {
        setError(problem);
        setShake((n) => n + 1);
        setTimeout(() => setPin(''), 380);
      }
    }
  }

  const back = () => { if (!busy) { setPin((p) => p.slice(0, -1)); setError(''); } };

  // A hardware keyboard works too — tablets on a stand often have one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) void press(e.key);
      else if (e.key === 'Backspace') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="pin">
      <div className="pin-title">{title}</div>
      {subtitle && <div className="pin-sub">{subtitle}</div>}
      <div className="pin-dots" key={shake} data-shake={shake > 0 || undefined} data-busy={busy || undefined}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span key={i} data-on={i < pin.length || undefined} />
        ))}
      </div>
      <div className="pin-error" role="alert">{error}</div>
      <div className="pin-keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="pin-key" onClick={() => void press(d)} disabled={busy}>{d}</button>
        ))}
        <span />
        <button type="button" className="pin-key" onClick={() => void press('0')} disabled={busy}>0</button>
        <button type="button" className="pin-key pin-key-ghost" onClick={back} disabled={busy} aria-label="Delete">
          <Icon name="left" size={20} />
        </button>
      </div>
      {footer}
    </div>
  );
}

/** What the server said, in words a person at a counter can act on. */
export function pinMessage(result: string, sw: boolean): string | null {
  switch (result) {
    case 'ok': return null;
    case 'wrong': return sw ? 'PIN si sahihi. Jaribu tena.' : 'Wrong PIN. Try again.';
    case 'locked': return sw ? 'Majaribio mengi mno. Subiri dakika 5.' : 'Too many tries. Wait 5 minutes.';
    case 'no_pin': return sw ? 'Hakuna PIN bado — muulize mmiliki aiweke.' : 'No PIN yet — ask the owner to set one.';
    default: return sw ? 'Imeshindikana kukagua. Jaribu tena.' : 'Could not check that. Try again.';
  }
}
