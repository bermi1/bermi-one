import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { QtyInput } from './QtyInput';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { roundQty } from '../lib/calc';
import type { Product } from '../lib/types';

/**
 * The owner puts right a wrong "added" figure — 20 typed for 2 — by entering
 * what it should have been. Only the live day moves; a verified day is closed.
 */
export function CorrectAdded({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const { session, setAddedStock } = useData();
  const { flash } = useToast();
  const held = session?.status === 'submitted';
  const current = product ? roundQty(held ? product.incoming || 0 : product.added) : 0;
  const [value, setValue] = useState<number | null>(current);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setValue(current); }, [product?.id, current]);

  async function save() {
    if (!product || value === null) return;
    setBusy(true);
    const err = await setAddedStock(product.id, value);
    setBusy(false);
    if (err) {
      const lowest = Number(err.split(':')[2]);
      flash(sw ? `Haiwezi kuwa chini ya ${lowest} — stock ingekuwa chini ya sifuri au chini ya hesabu iliyowekwa` : `Can't go below ${lowest} — the shelf would drop below zero or below what was counted`);
      return;
    }
    flash(sw ? 'Imerekebishwa' : 'Corrected');
    onClose();
  }

  return (
    <Sheet open={!!product} onClose={onClose} title={sw ? 'Rekebisha stock iliyoongezwa' : 'Correct added stock'}
      sub={product ? `${product.name} · ${sw ? 'opening' : 'opening'} ${roundQty(product.opening)} ${product.unit}` : undefined}>
      {product && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12.5, color: 'var(--ink2)', fontWeight: 600 }}>
            {held
              ? (sw ? 'Siku imetumwa kwa ukaguzi, kwa hiyo hii ni stock inayosubiri hesabu ijayo.' : 'The day is waiting for review, so this is the stock held for the next count.')
              : (sw ? 'Weka idadi sahihi iliyoongezwa leo. Tumia minus kama stock ilitoka (mf. −3).' : 'Enter what should have been added today. Use a minus if stock went out (e.g. −3).')}
          </div>
          <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {sw ? `Sasa: ${current}` : `Now: ${current}`}
          </label>
          <QtyInput id="correct-added" allowNegative value={value} onValue={setValue} className="field" style={{ fontSize: 18, fontWeight: 800, textAlign: 'center' }} />
          <button id="correct-save" type="button" className="btn-primary tap" data-disabled={busy || value === null || value === current} onClick={() => void save()}>
            {busy ? '…' : (sw ? 'Hifadhi' : 'Save')}
          </button>
        </div>
      )}
    </Sheet>
  );
}
