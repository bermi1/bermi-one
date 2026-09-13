import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { diffOf, expectedSales, moneyReceived } from '../lib/calc';
import { tintVars } from '../lib/types';

export function Difference() {
  const nav = useNavigate();
  const { L, fmt, owner } = useSettings();
  const { products, session, submitSession } = useData();
  const { flash } = useToast();
  const [reason, setReason] = useState<string | null>(session?.reason || null);
  const [note, setNote] = useState(session?.note || '');
  const [busy, setBusy] = useState(false);

  const counts = session?.counts || {};
  const sessionMoney = { cash: session?.cash || 0, mobile: session?.mobile || 0, bank_in: session?.bank_in || 0, closing_items: session?.closing_items || [] };
  const expected = expectedSales(products, counts);
  const received = moneyReceived(sessionMoney);
  const diff = diffOf(products, counts, sessionMoney);
  const ok = diff === 0;

  const reasons = [
    { id: 'expense', label: L.rExpense, icon: 'receipt' },
    { id: 'loss', label: L.rLoss, icon: 'alert' },
    { id: 'debt', label: L.rDebt, icon: 'user' },
    { id: 'short', label: L.rShort, icon: 'cash' },
    { id: 'other', label: L.rOther, icon: 'doc' },
  ];

  const canSubmit = ok || !!reason;

  async function submit() {
    setBusy(true);
    await submitSession(ok ? null : reason, note);
    setBusy(false);
    flash(L.submitReview);
    nav(owner ? '/approval' : '/home');
  }

  return (
    <div className="screen sb">
      <ScreenHeader title={L.difference} back />

      <div className="card" style={{ padding: 22, textAlign: 'center', background: ok ? 'var(--okSoft)' : diff > 0 ? 'var(--badSoft)' : 'var(--warnSoft)' }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, margin: '0 auto 12px', background: 'rgba(255,255,255,.5)', display: 'grid', placeItems: 'center', color: ok ? 'var(--ok)' : diff > 0 ? 'var(--bad)' : 'var(--warn)' }}>
          <Icon name={ok ? 'check' : 'alert'} size={20} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: ok ? 'var(--ok)' : diff > 0 ? 'var(--bad)' : 'var(--warn)' }}>{ok ? L.diffOk : L.diffBad}</div>
        <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800 }}>{fmt(Math.abs(diff))}</div>
        <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 700, color: 'var(--ink2)' }}>{ok ? L.allMatches : diff > 0 ? L.shortBy : L.overBy}</div>
      </div>

      <div className="card" style={{ marginTop: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
          <span style={{ color: 'var(--ink2)', fontWeight: 600 }}>{L.expected}</span>
          <span style={{ fontWeight: 800 }}>{fmt(expected)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
          <span style={{ color: 'var(--ink2)', fontWeight: 600 }}>{L.received}</span>
          <span style={{ fontWeight: 800 }}>{fmt(received)}</span>
        </div>
      </div>

      {!ok && (
        <>
          <div style={{ marginTop: 20, fontSize: 13, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>{L.why}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reasons.map((r, i) => {
              const tv = tintVars(i);
              const active = reason === r.id;
              return (
                <div
                  key={r.id}
                  className="tap"
                  onClick={() => setReason(r.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, background: active ? 'var(--brandSoft)' : 'var(--card)', border: `1.5px solid ${active ? 'var(--brand)' : 'var(--line)'}` }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon name={r.icon} size={15} />
                  </div>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{r.label}</div>
                  {active && <Icon name="check" size={16} style={{ color: 'var(--brand)' }} />}
                </div>
              );
            })}
          </div>
          <textarea
            placeholder={L.addNote}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="card"
            rows={3}
            style={{ width: '100%', marginTop: 12, padding: 14, border: 'none', fontSize: 14, resize: 'vertical' }}
          />
        </>
      )}

      <div style={{ marginTop: 20, fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5 }}>{L.submitNote}</div>
      <button className="btn-primary tap" style={{ width: '100%', marginTop: 14 }} data-disabled={!canSubmit || busy} onClick={submit}>
        {L.submitReview}
      </button>
    </div>
  );
}
