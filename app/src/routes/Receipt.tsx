import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface R {
  receipt_no: string; paid_at: string; amount: number; currency: string; label: string | null; plan: string | null;
  period: string | null; period_days: number | null; valid_until: string | null; payer: string | null; phone: string | null;
  network: string | null; reference: string; transaction_id: string | null; businesses: string[];
  seller: { name: string; product: string; site: string; email: string };
}

/**
 * A subscription receipt, opened from the link in the payment SMS. No sign-in:
 * the link itself is the key, and it shows that one receipt only. "Download"
 * is the browser's own Save as PDF, which every phone has.
 */
export function Receipt() {
  const { token = '' } = useParams();
  const [sw, setSw] = useState(() => typeof navigator !== 'undefined' && /^sw/i.test(navigator.language || ''));
  const [r, setR] = useState<R | null | undefined>(undefined);
  const t = (en: string, w: string) => (sw ? w : en);

  useEffect(() => {
    window.__bermiReady?.();
    void supabase.rpc('subscription_receipt', { p_token: token }).then(({ data }) => setR((data as R | null) ?? null));
  }, [token]);

  if (r === undefined) return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><div className="skeleton" style={{ width: 300, height: 360 }} /></div>;
  if (r === null) return <div className="empty" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>{t('This receipt was not found.', 'Risiti hii haipo.')}</div>;

  const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(sw ? 'sw-TZ' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
  const money = `${r.currency === 'TZS' ? 'TSh' : r.currency} ${Number(r.amount).toLocaleString('en-US')}`;
  const period = r.period === 'annual' ? t('1 year', 'Mwaka 1') : r.period === 'quarterly' ? t('3 months', 'Miezi 3') : t('1 month', 'Mwezi 1');
  const rows: [string, string][] = [
    [t('Receipt no.', 'Namba ya risiti'), r.receipt_no],
    [t('Date paid', 'Tarehe ya malipo'), d(r.paid_at)],
    [t('Billed to', 'Kwa'), r.payer || r.businesses[0] || '—'],
    [t('Businesses covered', 'Biashara zinazohusika'), r.businesses.join(', ') || '—'],
    [t('Plan', 'Kifurushi'), `${r.plan || '—'} · ${period}`],
    [t('Active until', 'Hai hadi'), d(r.valid_until)],
    [t('Paid from', 'Imelipwa kutoka'), [r.phone, r.network].filter(Boolean).join(' · ') || '—'],
    [t('Payment reference', 'Kumbukumbu ya malipo'), r.reference],
    ...(r.transaction_id ? [[t('Transaction ID', 'Namba ya muamala'), r.transaction_id] as [string, string]] : []),
  ];

  return (
    <div className="receipt-page" style={{ minHeight: '100dvh', background: 'var(--bg)', padding: 'calc(20px + env(safe-area-inset-top)) 16px 40px' }}>
      <style>{`@media print { .no-print { display: none !important } .receipt-page { background: #fff !important; padding: 0 !important } .receipt-card { box-shadow: none !important; border: 1px solid #ddd } }`}</style>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button type="button" className="btn-ghost tap" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => setSw(!sw)}>{sw ? 'English' : 'Kiswahili'}</button>
        </div>
        <div className="card receipt-card" style={{ padding: 22, background: '#fff', color: '#111' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/icons/bermi-mark.svg" alt="" width={40} height={40} style={{ borderRadius: 10 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{r.seller.product}</div>
              <div style={{ fontSize: 11.5, color: '#666' }}>{r.seller.name} · {r.seller.site.replace(/^https?:\/\//, '')}</div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0a7d3e', border: '1.5px solid #0a7d3e', borderRadius: 8, padding: '4px 8px' }}>{t('PAID', 'IMELIPWA')}</div>
          </div>
          <div style={{ marginTop: 18, fontSize: 12, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{t('Receipt', 'Risiti')}</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>{money}</div>
          <div style={{ fontSize: 12.5, color: '#444' }}>{r.label || ''}</div>
          <div style={{ marginTop: 14, borderTop: '1px solid #eee' }}>
            {rows.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                <span style={{ color: '#666' }}>{k}</span>
                <span style={{ fontWeight: 700, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 11.5, color: '#666', lineHeight: 1.5 }}>
            {t('Thank you for using Bermi One. Questions about this payment: ', 'Asante kwa kutumia Bermi One. Maswali kuhusu malipo haya: ')}{r.seller.email}
          </div>
        </div>
        <button id="receipt-download" type="button" className="btn-primary tap no-print" style={{ width: '100%', marginTop: 14 }} onClick={() => window.print()}>
          {t('Download receipt (PDF)', 'Pakua risiti (PDF)')}
        </button>
        <div className="no-print" style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink3)', textAlign: 'center' }}>
          {t('Choose "Save as PDF" in the print window.', 'Chagua "Save as PDF" kwenye dirisha la kuchapisha.')}
        </div>
      </div>
    </div>
  );
}
