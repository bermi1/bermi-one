import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useAuth } from '../state/AuthContext';
import { listReceipts, type PaidReceipt } from '../lib/billing';

/**
 * The account's subscription receipts, one tap from Manage. Each opens the
 * public receipt page, whose button saves it as a PDF — the same page the
 * receipt SMS links to, so there is one receipt and one way to keep it.
 */
export function MyReceipts() {
  const nav = useNavigate();
  const { lang } = useSettings();
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  const sw = lang === 'sw';
  const [rows, setRows] = useState<PaidReceipt[] | null>(null);

  useEffect(() => {
    if (!uid) return;
    let live = true;
    listReceipts(uid).then((r) => { if (live) setRows(r); }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [uid]);

  const day = (iso: string) => new Date(iso).toLocaleDateString(sw ? 'sw-TZ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div id="my-receipts" className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Icon name="receipt" size={16} style={{ color: 'var(--ink3)' }} />
        <div style={{ fontSize: 14.5, fontWeight: 800, flex: 1 }}>{sw ? 'Risiti' : 'Receipts'}</div>
      </div>
      {rows === null ? (
        <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>
          {sw ? 'Bado hakuna risiti. ' : 'No receipts yet. '}
          <span className="tap" onClick={() => nav('/pricing')} style={{ color: 'var(--brand)', fontWeight: 800 }}>{sw ? 'Lipia au ongeza muda' : 'Pay or renew'}</span>
        </div>
      ) : (
        rows.map((r) => (
          <div key={r.receipt_token} className="receipt-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--line)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{r.receipt_no}</div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {day(r.updated_at || r.created_at)} · TSh {Math.round(Number(r.amount)).toLocaleString('en-US')}{r.label ? ` · ${r.label}` : ''}
              </div>
            </div>
            <a href={`/r/${r.receipt_token}`} target="_blank" rel="noreferrer" className="tap"
              style={{ padding: '7px 11px', borderRadius: 10, fontSize: 12, fontWeight: 800, background: 'var(--brandSoft)', color: 'var(--brand)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              {sw ? 'Pakua' : 'Download'}
            </a>
          </div>
        ))
      )}
    </div>
  );
}
