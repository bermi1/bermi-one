import { useMemo, useState } from 'react';
import { Sheet } from './Sheet';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { cleanSignedQty, groupByCategory, roundQty } from '../lib/calc';

/**
 * Receiving a delivery: pick what arrived, how many, and optionally what it
 * cost. This is the only way stock goes up between closings, and staff use it
 * too — they are the ones who take the crate in. What they cannot do is change
 * a price, which is what keeps a counted day honest.
 */
export function ReceiveStock({ open, onClose, note, heldForNext }: { open: boolean; onClose: () => void; note: string; heldForNext: boolean }) {
  const { L, fmt, lang } = useSettings();
  const { products, addStock, addLedgerLines } = useData();
  const { flash } = useToast();

  const [query, setQuery] = useState('');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [supplier, setSupplier] = useState('');
  const [spend, setSpend] = useState('');
  const [busy, setBusy] = useState(false);
  // Remove mode: the numbers typed come off the shelf — a wrong entry, a return.
  const [removing, setRemoving] = useState(false);
  const sw = lang === 'sw';

  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
    [products, query],
  );
  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  // A typed "−3" always removes; in remove mode every number does.
  const lines = products
    .map((p) => { const n = Number(qty[p.id] || 0) || 0; return { p, n: removing ? -Math.abs(n) : n }; })
    .filter((l) => l.n !== 0);
  const added = roundQty(lines.filter((l) => l.n > 0).reduce((s, l) => s + l.n, 0));
  const removed = roundQty(lines.filter((l) => l.n < 0).reduce((s, l) => s - l.n, 0));

  function reset() {
    setQty({});
    setSupplier('');
    setSpend('');
    setQuery('');
  }

  async function confirm() {
    if (!lines.length) return;
    setBusy(true);
    // Removals first, each checked against what is there; stop at the first refusal.
    for (const l of [...lines].sort((a, b) => a.n - b.n)) {
      const err = await addStock(l.p.id, l.n);
      if (err) {
        const [, name, avail] = err.split(':');
        setBusy(false);
        flash(sw ? `${name}: zipo ${Number(avail)} tu za kuondoa` : `${name}: only ${Number(avail)} can be removed`);
        return;
      }
    }

    // A delivery that was paid for is also money leaving the business.
    const cost = removing ? 0 : Number(spend || 0);
    if (cost > 0) {
      await addLedgerLines([{
        kind: 'purchase',
        label: supplier.trim() ? `${L.stockReceived} — ${supplier.trim()}` : L.stockReceived,
        amount: -cost,
        account: 'cash',
      }]);
    }

    setBusy(false);
    reset();
    onClose();
    flash(summary());
  }

  function summary() {
    const parts: string[] = [];
    if (added) parts.push(sw ? `+${added} zimeongezwa` : `+${added} added`);
    if (removed) parts.push(sw ? `−${removed} zimeondolewa` : `−${removed} removed`);
    return parts.join(' · ');
  }

  return (
    <Sheet open={open} onClose={onClose} title={L.addStockCta} sub={L.addStockCtaSub}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          className="card"
          style={{ padding: '10px 13px', display: 'flex', alignItems: 'center', gap: 9, background: heldForNext ? 'var(--warnSoft)' : 'var(--brandSoft)' }}
        >
          <Icon name={heldForNext ? 'clock' : 'check'} size={14} style={{ color: heldForNext ? 'var(--warn)' : 'var(--brand)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: heldForNext ? 'var(--warn)' : 'var(--brand)' }}>{note}</span>
        </div>
        <div className="s-seg" role="group" aria-label={sw ? 'Ongeza au ondoa' : 'Add or remove'} style={{ display: 'flex', gap: 6 }}>
          <button id="mode-add" type="button" className="chip tap" aria-pressed={!removing} onClick={() => setRemoving(false)}
            style={{ flex: 1, padding: '9px 0', fontWeight: 800, background: !removing ? 'var(--brand)' : 'var(--card)', color: !removing ? 'var(--brandInk)' : 'var(--ink2)' }}>
            + {sw ? 'Ongeza' : 'Add'}
          </button>
          <button id="mode-remove" type="button" className="chip tap" aria-pressed={removing} onClick={() => setRemoving(true)}
            style={{ flex: 1, padding: '9px 0', fontWeight: 800, background: removing ? 'var(--bad)' : 'var(--card)', color: removing ? '#fff' : 'var(--ink2)' }}>
            − {sw ? 'Ondoa (kosa au kurudisha)' : 'Remove (mistake or return)'}
          </button>
        </div>
        <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px' }}>
          <Icon name="search" size={15} style={{ color: 'var(--ink3)' }} />
          <input
            placeholder={L.searchProduct}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 13.5 }}
          />
        </label>

        <div className="card sb" style={{ padding: 6, maxHeight: 300, overflowY: 'auto' }}>
          {groups.map(({ cat, items }) => (
            <div key={cat}>
              <div style={{ padding: '8px 8px 4px', fontSize: 10.5, fontWeight: 800, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{cat}</div>
              {items.map((p) => {
                const v = qty[p.id] || '';
                const neg = removing || v.startsWith('-');
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink3)', fontWeight: 600 }}>
                        {roundQty(p.opening + p.added + p.incoming)} {p.unit} {lang === 'sw' ? 'zilizopo' : 'on hand'}
                      </div>
                    </div>
                    <input
                      inputMode="decimal"
                      placeholder={removing ? '−' : '—'}
                      value={v}
                      onChange={(e) => setQty((q) => ({ ...q, [p.id]: cleanSignedQty(e.target.value) }))}
                      style={{ width: 56, textAlign: 'center', padding: '7px 0', borderRadius: 9, border: `1px solid ${v ? (neg ? 'var(--bad)' : 'var(--brand)') : 'var(--line)'}`, background: 'var(--card2)', color: v && neg ? 'var(--bad)' : undefined, fontSize: 13.5, fontWeight: 700 }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {!removing && <>
        <input
          placeholder={L.supplierOptional}
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="field"
          
        />
        <input
          inputMode="numeric"
          placeholder={L.amountPaidOptional}
          value={spend}
          onChange={(e) => setSpend(e.target.value.replace(/[^0-9]/g, ''))}
          className="field"
          
        />
        </>}

        {lines.length > 0 && (
          <div className="card" style={{ padding: 12, background: 'var(--brandSoft)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand)' }}>
              {lines.length} {lang === 'sw' ? 'bidhaa' : 'products'} · {summary()}
              {Number(spend) > 0 ? ` · ${fmt(Number(spend))}` : ''}
            </div>
          </div>
        )}

        <button className="btn-primary tap" style={{ width: '100%' }} data-disabled={!lines.length || busy} onClick={confirm}>
          {removed && !added ? (sw ? 'Ondoa kwenye stock' : 'Remove from stock') : L.confirmReceive}
        </button>
      </div>
    </Sheet>
  );
}
