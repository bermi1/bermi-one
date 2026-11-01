import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';

interface Overview {
  key_set: boolean;
  usage: { day: string; questions: number; input_tokens: number; output_tokens: number; owner_name: string }[];
}

// Claude Haiku 5.5, per million tokens. Shown as a rough running cost.
const USD_IN = 0.10, USD_OUT = 0.50;

/**
 * Bermi AI, from the console: the Anthropic key (saved to Vault, write-only)
 * and who asked how much this week, with an approximate cost.
 */
export function AiTools() {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const [o, setO] = useState<Overview | null>(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('hq_ai_overview');
    if (e) { setError(e.message); return; }
    setO(data as Overview);
    setError('');
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!key.trim()) return;
    setBusy(true);
    setNotice('');
    const { error: e } = await supabase.rpc('hq_set_ai_config', { p_key: key.trim() });
    setBusy(false);
    if (e) { setError(e.message); return; }
    setKey('');
    setNotice(sw ? 'Imehifadhiwa. Bermi AI imewashwa kwa Premium.' : 'Saved. Bermi AI is on for Premium accounts.');
    void load();
  }

  const usage = o?.usage || [];
  const cost = usage.reduce((t, u) => t + (u.input_tokens / 1e6) * USD_IN + (u.output_tokens / 1e6) * USD_OUT, 0);
  const questions = usage.reduce((t, u) => t + u.questions, 0);

  return (
    <div id="ai-tools" className="hq-card" style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800 }}>Bermi AI (Claude Haiku 5.5)</div>
          <div style={{ fontSize: 12.5, color: o?.key_set ? 'var(--ok)' : 'var(--ink3)', fontWeight: 700 }}>
            {!o ? '…' : o.key_set ? (sw ? 'Imewashwa — Premium na trial' : 'On — Premium and trials') : (sw ? 'Imezimwa — hakuna key. Jibu la kawaida linatumika.' : 'Off — no key yet. The basic assistant answers.')}
          </div>
        </div>
        <button className="hq-icon-btn" onClick={() => void load()} aria-label="Refresh"><Icon name="refresh" size={14} /></button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <input className="hq-input" type="password" autoComplete="off" style={{ flex: 1 }} placeholder={o?.key_set ? (sw ? 'Weka key mpya kubadilisha' : 'Paste a new key to replace it') : 'sk-ant-…'} value={key} onChange={(e) => setKey(e.target.value)} />
        <button className="hq-nav-item" style={{ justifyContent: 'center', background: 'var(--brand)', color: 'var(--brandInk)', fontWeight: 800 }} disabled={busy || !key.trim()} onClick={() => void save()}>
          {sw ? 'Hifadhi' : 'Save'}
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 6 }}>
        {sw ? 'Pata key: console.anthropic.com → API Keys. Weka kiwango cha matumizi huko pia.' : 'Get a key at console.anthropic.com → API Keys, and set a monthly spend limit there.'}
      </div>
      <div className="hq-section-sub" style={{ marginTop: 14 }}>
        {sw ? `Siku 7: maswali ${questions} · ~$${cost.toFixed(2)}` : `Last 7 days: ${questions} questions · ~$${cost.toFixed(2)}`}
      </div>
      {usage.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{sw ? 'Bado hakuna maswali.' : 'No questions yet.'}</div>}
      {usage.map((u) => (
        <div key={u.day + u.owner_name} style={{ display: 'flex', gap: 10, padding: '6px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
          <span style={{ width: 84, color: 'var(--ink3)' }}>{u.day}</span>
          <span style={{ flex: 1, fontWeight: 700 }}>{u.owner_name || '—'}</span>
          <span>{u.questions} {sw ? 'maswali' : 'questions'}</span>
        </div>
      ))}
      {notice && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--ok)' }}>{notice}</div>}
      {error && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--bad)' }}>{error}</div>}
    </div>
  );
}
