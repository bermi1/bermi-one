import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';

interface Overview {
  key_saved: boolean;
  url: string | null;
  sender: string | null;
  worker: { sms?: boolean; email?: boolean; checked_at?: string };
  counts: Record<string, number>;
  recent: { kind: string; recipient: string; status: string; attempts: number; provider_message: string | null; created_at: string }[];
}

/**
 * SMS, from the console: is it switched on, what happened to the last
 * messages, and the place to paste the provider's key. The key is write-only —
 * saved to Vault and never shown again — and the worker picks it up within a
 * minute, no redeploy.
 */
export function SmsTools() {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const [o, setO] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [key, setKey] = useState('');
  const [url, setUrl] = useState('');
  const [sender, setSender] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('hq_sms_overview');
    if (e) { setError(e.message); return; }
    setO(data as Overview);
    setError('');
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    setBusy(true);
    setNotice('');
    const { error: e } = await supabase.rpc('hq_set_sms_config', { p_key: key.trim() || null, p_url: url.trim() || null, p_sender: sender.trim() || null });
    setBusy(false);
    if (e) { setError(e.message); return; }
    setKey('');
    setNotice(sw ? 'Imehifadhiwa. Mfanyakazi wa SMS ataitumia ndani ya dakika moja.' : 'Saved. The SMS worker picks it up within a minute.');
    void load();
  }

  const on = !!o?.worker?.sms;
  const tone = (st: string) => (st === 'sent' ? 'var(--ok)' : st === 'failed' ? 'var(--bad)' : st === 'queued' ? 'var(--warn)' : 'var(--ink3)');

  return (
    <div className="hq-card" style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="hq-dot" style={{ background: on ? 'var(--ok)' : 'var(--bad)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800 }}>SMS (BRIQ)</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink2)' }}>
            {!o ? '…' : on ? (sw ? 'Imewashwa — ujumbe unatumwa.' : 'On — messages are going out.')
              : (sw ? 'Imezimwa — hakuna ufunguo wa SMS. Ujumbe unasubiri kwenye foleni.' : 'Off — no SMS key. Messages wait in the queue until one is saved.')}
            {o?.worker?.checked_at ? ` · ${sw ? 'imeangaliwa' : 'checked'} ${new Date(o.worker.checked_at).toLocaleTimeString()}` : ''}
          </div>
        </div>
        <button className="hq-icon-btn" onClick={() => void load()} aria-label="Refresh"><Icon name="refresh" size={14} /></button>
      </div>

      {o && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, fontSize: 12.5, fontWeight: 700 }}>
          {['queued', 'sent', 'failed', 'skipped'].map((k) => (
            <span key={k} style={{ color: tone(k) }}>{o.counts[k] || 0} {k}</span>
          ))}
          <span style={{ color: 'var(--ink3)' }}>· {sw ? 'siku 7' : 'last 7 days'}</span>
        </div>
      )}

      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        <input className="hq-input" type="password" autoComplete="off" placeholder={o?.key_saved ? (sw ? 'Ufunguo umehifadhiwa — weka mpya kubadilisha' : 'Key saved — paste a new one to replace it') : (sw ? 'Ufunguo wa API wa BRIQ' : 'BRIQ API key')} value={key} onChange={(e) => setKey(e.target.value)} />
        <input className="hq-input" placeholder={o?.url || 'https://karibu.briq.tz/v1/message/send-instant'} value={url} onChange={(e) => setUrl(e.target.value)} />
        <input className="hq-input" maxLength={11} placeholder={`${sw ? 'Jina la mtumaji' : 'Sender name'} (${o?.sender || 'Bermi Techs'})`} value={sender} onChange={(e) => setSender(e.target.value)} />
        <button className="hq-nav-item" style={{ justifyContent: 'center', background: 'var(--brand)', color: 'var(--brandInk)', fontWeight: 800 }} disabled={busy || (!key.trim() && !url.trim() && !sender.trim())} onClick={() => void save()}>
          <Icon name="check" size={14} /> {busy ? '…' : (sw ? 'Hifadhi' : 'Save')}
        </button>
      </div>
      {notice && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--ok)' }}>{notice}</div>}
      {error && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--bad)' }}>{error}</div>}

      {o && o.recent.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="hq-section-sub">{sw ? 'Ujumbe wa karibuni' : 'Recent messages'}</div>
          {o.recent.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
              <span style={{ width: 64, fontWeight: 800, color: tone(r.status) }}>{r.status}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{r.kind}</b> → {r.recipient || '—'}
                {r.provider_message && <span style={{ display: 'block', color: 'var(--ink3)', wordBreak: 'break-word' }}>{r.provider_message}</span>}
              </span>
              <span style={{ color: 'var(--ink3)', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
