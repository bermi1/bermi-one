import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';

interface Health {
  db_bytes: number; limit_bytes: number;
  top: { name: string; bytes: number; rows: number }[] | null;
  cron_log_rows: number; cold_waiting: number; closings_archived: number; edge_calls_today: number;
}

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

/**
 * How full the database is. The free tier stops at 500 MB, so this shows how
 * close we are, what is taking the room, and whether the nightly jobs that
 * move cold data to Storage are keeping up.
 */
export function DbHealth() {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const [h, setH] = useState<Health | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('hq_db_health');
    if (e) { setError(e.message); return; }
    setH(data as Health); setError('');
  }, []);
  useEffect(() => { void load(); }, [load]);

  const pct = h ? Math.min(100, (h.db_bytes / h.limit_bytes) * 100) : 0;
  const tone = pct >= 70 ? 'var(--bad)' : pct >= 50 ? 'var(--warn)' : 'var(--ok)';

  return (
    <div id="db-health" className="hq-card" style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, fontWeight: 800 }}>{sw ? 'Database' : 'Database'}</div>
        <button className="hq-icon-btn" onClick={() => void load()} aria-label="Refresh"><Icon name="refresh" size={14} /></button>
      </div>
      {h && (
        <>
          <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800 }}>{mb(h.db_bytes)} <span style={{ fontSize: 12, color: 'var(--ink3)' }}>/ {mb(h.limit_bytes)} ({pct.toFixed(0)}%)</span></div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', marginTop: 6 }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: tone }} />
          </div>
          {pct >= 70 && <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--bad)' }}>{sw ? 'Inakaribia kujaa — angalia meza kubwa hapa chini.' : 'Getting full — check the largest tables below.'}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10, fontSize: 12 }}>
            <div>{sw ? 'Closings zilizohamishwa' : 'Closings in cold storage'}: <b>{h.closings_archived}</b></div>
            <div>{sw ? 'Zinasubiri kuhamishwa' : 'Waiting to move'}: <b>{h.cold_waiting}</b></div>
            <div>{sw ? 'Rekodi za cron' : 'Cron log rows'}: <b>{h.cron_log_rows.toLocaleString('en-US')}</b></div>
            <div>{sw ? 'Simu za functions (saa 24)' : 'Function calls (24h)'}: <b>{h.edge_calls_today}</b></div>
          </div>
          <div className="hq-section-sub" style={{ marginTop: 12 }}>{sw ? 'Meza kubwa' : 'Largest tables'}</div>
          {(h.top || []).map((t) => (
            <div key={t.name} style={{ display: 'flex', gap: 10, padding: '5px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
              <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{t.name}</span>
              <span style={{ color: 'var(--ink3)' }}>{Math.max(0, t.rows).toLocaleString('en-US')} rows</span>
              <b style={{ width: 70, textAlign: 'right' }}>{mb(t.bytes)}</b>
            </div>
          ))}
        </>
      )}
      {error && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--bad)' }}>{error}</div>}
    </div>
  );
}
