import { useMemo, useState } from 'react';
import { Sheet } from './Sheet';
import { QtyInput } from './QtyInput';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { groupByCategory, roundQty } from '../lib/calc';
import type { Product } from '../lib/types';

/**
 * Send stock to another business in the same account: the bar that ran out
 * borrows from the one that has plenty. It leaves this shelf and lands on the
 * other in one step — the database does both or neither — and each side's
 * cash book notes the movement. A business whose day is waiting for
 * verification holds it for its next day, like any delivery.
 */
export function TransferStock({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useSettings();
  const { products, businesses, activeBusiness, session, transferStock } = useData();
  const { flash } = useToast();
  const sw = lang === 'sw';

  const targets = useMemo(
    () => businesses.filter((b) => b.id !== activeBusiness?.id && b.type !== 'barber'),
    [businesses, activeBusiness?.id],
  );
  const [to, setTo] = useState('');
  const [query, setQuery] = useState('');
  const [qty, setQty] = useState<Record<string, number | null>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const target = targets.find((b) => b.id === to) || null;

  /** What can leave the shelf now — the same figure the database checks. */
  const shelf = (p: Product) => {
    if (session?.status === 'submitted') {
      const c = session.counts[p.id];
      return roundQty((c === undefined || c === null ? p.opening + p.added : Number(c)) + p.incoming);
    }
    return roundQty(p.opening + p.added);
  };

  const filtered = useMemo(() => products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const groups = useMemo(() => groupByCategory(filtered), [filtered]);
  const lines = products.map((p) => ({ p, n: qty[p.id] || 0 })).filter((l) => l.n > 0);
  const units = roundQty(lines.reduce((s, l) => s + l.n, 0));

  function reset() { setQty({}); setNote(''); setQuery(''); setTo(''); }

  function problem(code: string): string {
    const [kind, name, avail] = code.split(':');
    if (kind === 'NOT_ENOUGH') return sw ? `${name}: zipo ${Number(avail)} tu` : `${name}: only ${Number(avail)} available`;
    if (kind === 'NOT_SAME_ACCOUNT') return sw ? 'Biashara hiyo si ya akaunti hii' : 'That business is not on this account';
    if (kind === 'NOT_ALLOWED') return sw ? 'Huna ruhusa ya kuhamisha kutoka biashara hii' : 'You can’t send stock from this business';
    return code;
  }

  async function send() {
    if (!target || !lines.length) return;
    setBusy(true);
    const err = await transferStock(target.id, lines.map((l) => ({ product_id: l.p.id, qty: l.n })), note.trim());
    setBusy(false);
    if (err) { flash(problem(err)); return; }
    flash(sw ? `Vipande ${units} vimehamishiwa ${target.name}` : `${units} units sent to ${target.name}`);
    reset();
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={sw ? 'Hamisha kwenda biashara nyingine' : 'Transfer to another business'}
      sub={sw ? 'Inapunguzwa hapa na kuongezwa huko mara moja.' : 'Taken off here and added there at once.'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
            {sw ? 'Kwenda' : 'Send to'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {targets.map((b) => (
              <button key={b.id} type="button" className="tap" onClick={() => setTo(b.id)}
                style={{ padding: '8px 12px', borderRadius: 11, fontSize: 12.5, fontWeight: 700, border: '1px solid var(--line)', background: to === b.id ? 'var(--brand)' : 'var(--card)', color: to === b.id ? 'var(--brandInk)' : 'var(--ink2)' }}>
                {b.name}
              </button>
            ))}
          </div>
        </div>

        <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px' }}>
          <Icon name="search" size={15} style={{ color: 'var(--ink3)' }} />
          <input placeholder={sw ? 'Tafuta bidhaa' : 'Search product'} value={query} onChange={(e) => setQuery(e.target.value)}
            style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 13.5 }} />
        </label>

        <div className="card sb" style={{ padding: 6, maxHeight: 300, overflowY: 'auto' }}>
          {groups.map(({ cat, items }) => (
            <div key={cat}>
              <div style={{ padding: '8px 8px 4px', fontSize: 10.5, fontWeight: 800, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{cat}</div>
              {items.map((p) => {
                const max = shelf(p);
                const v = qty[p.id];
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderBottom: '1px solid var(--line)', opacity: max > 0 ? 1 : 0.5 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink3)', fontWeight: 600 }}>{max} {p.unit} {sw ? 'zilizopo' : 'on hand'}</div>
                    </div>
                    <QtyInput
                      placeholder="—"
                      value={v ?? null}
                      limit={max}
                      disabled={max <= 0}
                      onValue={(n) => setQty((q) => ({ ...q, [p.id]: n }))}
                      onOverLimit={(m) => flash(sw ? `${p.name}: zipo ${m} tu` : `${p.name}: only ${m} available`)}
                      style={{ width: 58, textAlign: 'center', padding: '7px 0', borderRadius: 9, border: `1px solid ${v ? 'var(--brand)' : 'var(--line)'}`, background: 'var(--card2)', fontSize: 13.5, fontWeight: 700 }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <input className="field" placeholder={sw ? 'Maelezo (si lazima)' : 'Note (optional)'} value={note} onChange={(e) => setNote(e.target.value)} />

        {lines.length > 0 && target && (
          <div className="card" style={{ padding: 12, background: 'var(--brandSoft)', fontSize: 12.5, fontWeight: 800, color: 'var(--brand)' }}>
            {sw ? `Bidhaa ${lines.length} · vipande ${units} → ${target.name}` : `${lines.length} products · ${units} units → ${target.name}`}
          </div>
        )}

        <button id="transfer-send" className="btn-primary tap" style={{ width: '100%' }} data-disabled={!target || !lines.length || busy} onClick={send}>
          {busy ? '…' : target ? (sw ? `Tuma kwenda ${target.name}` : `Send to ${target.name}`) : (sw ? 'Chagua biashara' : 'Choose a business')}
        </button>
      </div>
    </Sheet>
  );
}
