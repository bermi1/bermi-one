import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';

interface Overview {
  key_saved: boolean;
  from: string | null;
  counts: Record<string, number>;
  recent: { kind: string; recipient: string; status: string; attempts: number; provider_message: string | null; created_at: string }[];
}

/**
 * Email, from the console: the Resend key and the From address, saved to
 * Vault (write-only — never shown again) and picked up by the worker within a
 * minute. Weekly summaries and closing summaries go out through this.
 */
export function EmailTools() {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const [o, setO] = useState<Overview | null>(null);
  const [key, setKey] = useState('');
  const [from, setFrom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('hq_email_overview');
    if (e) { setError(e.message); return; }
    setO(data as Overview);
    setError('');
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    setBusy(true);
    setNotice('');
    const { error: e } = await supabase.rpc('hq_set_email_config', { p_key: key.trim() || null, p_from: from.trim() || null });
    setBusy(false);
    if (e) { setError(e.message); return; }
    setKey('');
    setNotice(sw ? 'Imehifadhiwa. Barua pepe zitaanza kutumwa ndani ya dakika moja.' : 'Saved. Emails start going out within a minute.');
    void load();
  }

  const on = !!o?.key_saved;
  const tone = (st: string) => (st === 'sent' ? 'var(--ok)' : st === 'failed' ? 'var(--bad)' : st === 'queued' ? 'var(--warn)' : 'var(--ink3)');

  return (
    <div className="hq-card" style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="hq-dot" style={{ background: on ? 'var(--ok)' : 'var(--bad)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800 }}>{sw ? 'Barua pepe (Resend)' : 'Email (Resend)'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink2)' }}>
            {!o ? '…' : on ? (sw ? `Imewashwa — kutoka ${o.from || 'Bermi One <noreply@bermi.one>'}` : `On — sending from ${o.from || 'Bermi One <noreply@bermi.one>'}`)
              : (sw ? 'Imezimwa — hakuna ufunguo. Barua pepe zinasubiri kwenye foleni.' : 'Off — no key yet. Emails wait in the queue until one is saved.')}
          </div>
        </div>
        <button className="hq-icon-btn" onClick={() => void load()} aria-label="Refresh"><Icon name="refresh" size={14} /></button>
      </div>

      {!on && (
        <ol style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.6 }}>
          <li>{sw ? 'Fungua akaunti resend.com' : 'Create an account at resend.com'}</li>
          <li>{sw ? 'Domains → ongeza bermi.one, weka rekodi za DNS (SPF, DKIM) kwa msajili wa domain, subiri "Verified"' : 'Domains → add bermi.one, add the DNS records (SPF, DKIM) at your domain registrar, wait for "Verified"'}</li>
          <li>{sw ? 'API Keys → tengeneza ufunguo (Sending access), ubandike hapa' : 'API Keys → create a key (Sending access) and paste it here'}</li>
        </ol>
      )}

      {o && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, fontSize: 12.5, fontWeight: 700 }}>
          {['queued', 'sent', 'failed', 'skipped'].map((k) => <span key={k} style={{ color: tone(k) }}>{o.counts[k] || 0} {k}</span>)}
          <span style={{ color: 'var(--ink3)' }}>· {sw ? 'siku 7' : 'last 7 days'}</span>
        </div>
      )}

      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        <input className="hq-input" type="password" autoComplete="off" placeholder={on ? (sw ? 'Ufunguo umehifadhiwa — weka mpya kubadilisha' : 'Key saved — paste a new one to replace it') : 'Resend API key (re_…)'} value={key} onChange={(e) => setKey(e.target.value)} />
        <input className="hq-input" placeholder={`${sw ? 'Kutoka' : 'From'}: ${o?.from || 'Bermi One <reports@bermi.one>'}`} value={from} onChange={(e) => setFrom(e.target.value)} />
        <button className="hq-nav-item" style={{ justifyContent: 'center', background: 'var(--brand)', color: 'var(--brandInk)', fontWeight: 800 }} disabled={busy || (!key.trim() && !from.trim())} onClick={() => void save()}>
          <Icon name="check" size={14} /> {busy ? '…' : (sw ? 'Hifadhi' : 'Save')}
        </button>
      </div>
      {notice && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--ok)' }}>{notice}</div>}
      {error && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--bad)' }}>{error}</div>}

      {o && o.recent.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="hq-section-sub">{sw ? 'Barua pepe za karibuni' : 'Recent emails'}</div>
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
