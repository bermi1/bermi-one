import { useCallback, useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { useSettings } from '../lib/useSettings';
import { supabase } from '../lib/supabase';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';

interface TransferRow {
  id: string; from_business: string; to_business: string; created_at: string; note: string | null; by_name: string | null;
  items: { name: string; unit?: string; qty: number }[]; undone_at?: string | null; undone_by?: string | null;
}

/**
 * Transfers in and out of this business, newest first. A transfer sent by
 * mistake is undone here: the units go back to the business that sent them
 * and come off the one that received them, both in one step.
 */
export function TransferHistory({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const { activeBusiness, businesses, undoTransfer } = useData();
  const { flash } = useToast();
  const [rows, setRows] = useState<TransferRow[] | null>(null);
  const [confirm, setConfirm] = useState<TransferRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!activeBusiness) return;
    const id = activeBusiness.id;
    const { data } = await supabase.from('stock_transfers').select('*')
      .or(`from_business.eq.${id},to_business.eq.${id}`).order('created_at', { ascending: false }).limit(20);
    setRows((data || []) as TransferRow[]);
  }, [activeBusiness]);
  useEffect(() => { if (open) void load(); }, [open, load]);

  const nameOf = (id: string) => businesses.find((b) => b.id === id)?.name || (sw ? 'biashara nyingine' : 'another business');

  async function undo() {
    if (!confirm) return;
    setBusy(true);
    const err = await undoTransfer(confirm.id);
    setBusy(false);
    if (err) {
      const [kind, name, avail] = err.split(':');
      flash(kind === 'NOT_ENOUGH'
        ? (sw ? `${name}: biashara iliyopokea ina ${Number(avail)} tu — haiwezi kurudisha zote` : `${name}: the receiving business only has ${Number(avail)} left — can't send them all back`)
        : kind === 'ALREADY_UNDONE' ? (sw ? 'Uhamisho huu umesharudishwa' : 'This transfer was already undone') : err);
      return;
    }
    flash(sw ? 'Uhamisho umerudishwa' : 'Transfer undone');
    setConfirm(null);
    void load();
  }

  return (
    <>
      <Sheet open={open && !confirm} onClose={onClose} title={sw ? 'Uhamisho wa stock' : 'Stock transfers'} sub={sw ? 'Uliotuma na uliopokea' : 'Sent and received'}>
        {rows === null ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink3)' }}>…</div>
          : rows.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>{sw ? 'Bado hakuna uhamisho.' : 'No transfers yet.'}</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {rows.map((r) => {
                const out = r.from_business === activeBusiness?.id;
                return (
                  <div key={r.id} className="transfer-row" style={{ padding: '10px 0', borderTop: '1px solid var(--line)', opacity: r.undone_at ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800 }}>
                        {out ? (sw ? `Kwenda ${nameOf(r.to_business)}` : `To ${nameOf(r.to_business)}`) : (sw ? `Kutoka ${nameOf(r.from_business)}` : `From ${nameOf(r.from_business)}`)}
                      </div>
                      {r.undone_at
                        ? <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink3)' }}>{sw ? 'Imerudishwa' : 'Undone'}{r.undone_by ? ` · ${r.undone_by}` : ''}</span>
                        : <button type="button" className="chip tap undo-transfer" onClick={() => setConfirm(r)} style={{ padding: '5px 10px', fontSize: 11.5, fontWeight: 800, color: 'var(--bad)' }}>{sw ? 'Rudisha' : 'Undo'}</button>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 3 }}>
                      {r.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
                      {new Date(r.created_at).toLocaleString(sw ? 'sw-TZ' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {r.by_name ? ` · ${r.by_name}` : ''}{r.note ? ` · ${r.note}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </Sheet>
      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={sw ? 'Rudisha uhamisho huu?' : 'Undo this transfer?'}>
        {confirm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--ink2)' }}>
              {sw
                ? `${confirm.items.map((i) => `${i.qty} × ${i.name}`).join(', ')} zitarudi ${nameOf(confirm.from_business)} na kuondolewa ${nameOf(confirm.to_business)}.`
                : `${confirm.items.map((i) => `${i.qty} × ${i.name}`).join(', ')} go back to ${nameOf(confirm.from_business)} and come off ${nameOf(confirm.to_business)}.`}
            </div>
            <button id="undo-confirm" type="button" className="btn-primary tap" style={{ background: 'var(--bad)' }} data-disabled={busy} onClick={() => void undo()}>
              {busy ? '…' : (sw ? 'Ndiyo, rudisha' : 'Yes, undo it')}
            </button>
            <button type="button" className="btn-ghost tap" onClick={() => setConfirm(null)}>{sw ? 'Ghairi' : 'Cancel'}</button>
          </div>
        )}
      </Sheet>
    </>
  );
}
