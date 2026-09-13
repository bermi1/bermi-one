import { useMemo, useState } from 'react';
import { Sheet } from './Sheet';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { groupByCategory } from '../lib/calc';

/**
 * Receiving a delivery: pick what arrived, how many, and optionally what it
 * cost. This is the only way stock goes up between closings — the person on
 * shift never touches it, they only count what is left at the end of the day.
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

  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
    [products, query],
  );
  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  const lines = products
    .map((p) => ({ p, n: Number(qty[p.id] || 0) }))
    .filter((l) => l.n > 0);
  const totalUnits = lines.reduce((s, l) => s + l.n, 0);

  function reset() {
    setQty({});
    setSupplier('');
    setSpend('');
    setQuery('');
  }

  async function confirm() {
    if (!lines.length) return;
    setBusy(true);
    for (const l of lines) await addStock(l.p.id, l.n);

    // A delivery that was paid for is also money leaving the business.
    const cost = Number(spend || 0);
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
    flash(`${totalUnits} ${lang === 'sw' ? 'zimeongezwa' : 'units received'}`);
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
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink3)', fontWeight: 600 }}>
                        {p.opening + p.added + p.incoming} {p.unit} {lang === 'sw' ? 'zilizopo' : 'on hand'}
                      </div>
                    </div>
                    <input
                      inputMode="numeric"
                      placeholder="—"
                      value={v}
                      onChange={(e) => setQty((q) => ({ ...q, [p.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                      style={{ width: 56, textAlign: 'center', padding: '7px 0', borderRadius: 9, border: `1px solid ${v ? 'var(--brand)' : 'var(--line)'}`, background: 'var(--card2)', fontSize: 13.5, fontWeight: 700 }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <input
          placeholder={L.supplierOptional}
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="card"
          style={{ padding: '12px 14px', border: 'none', fontSize: 13.5 }}
        />
        <input
          inputMode="numeric"
          placeholder={L.amountPaidOptional}
          value={spend}
          onChange={(e) => setSpend(e.target.value.replace(/[^0-9]/g, ''))}
          className="card"
          style={{ padding: '12px 14px', border: 'none', fontSize: 13.5 }}
        />

        {lines.length > 0 && (
          <div className="card" style={{ padding: 12, background: 'var(--brandSoft)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand)' }}>
              {lines.length} {lang === 'sw' ? 'bidhaa' : 'products'} · {totalUnits} {lang === 'sw' ? 'vipande' : 'units'}
              {Number(spend) > 0 ? ` · ${fmt(Number(spend))}` : ''}
            </div>
          </div>
        )}

        <button className="btn-primary tap" style={{ width: '100%' }} data-disabled={!lines.length || busy} onClick={confirm}>
          {L.confirmReceive}
        </button>
      </div>
    </Sheet>
  );
}
