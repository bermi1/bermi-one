import { useState } from 'react';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { setPaymeConfig, testPayme, type PaymeProbe } from '../lib/platform';

const COPY = {
  en: {
    test: 'Test connection',
    testing: 'Asking Payme…',
    liveId: 'Live App ID',
    sandboxId: 'Sandbox App ID',
    accepted: 'Accepted by Payme',
    refused: 'Refused by Payme',
    update: 'Update credentials',
    hideForm: 'Close',
    appId: 'Live App ID (as Payme shows it)',
    sandboxAppId: 'Sandbox App ID',
    secret: 'App secret — leave blank to keep the current one',
    mode: 'Charge in',
    live: 'Live',
    sandbox: 'Sandbox',
    save: 'Save and test',
    saved: 'Saved. Testing…',
    whyTitle: 'Payme is refusing the App ID — what to do',
    steps: [
      'Log in at portal.paymeafrica.com and open your application.',
      'Check it is Active / approved. New accounts must verify the business before live keys work.',
      'Copy the App ID exactly as Payme shows it on the credentials page — the ID Payme issues, not a name typed when creating the app — and the secret. Paste them above and save.',
      'Still refused? Paste the same App ID and secret into paymeafrica.com/labs. If Payme’s own tool gives the same error, only Payme can fix it: WhatsApp +255 767 940 400.',
    ],
    allGood: 'Payme accepts these credentials. Payments will go through.',
  },
  sw: {
    test: 'Jaribu muunganisho',
    testing: 'Tunauliza Payme…',
    liveId: 'App ID halisi',
    sandboxId: 'App ID ya majaribio',
    accepted: 'Payme wamekubali',
    refused: 'Payme wamekataa',
    update: 'Badili taarifa za Payme',
    hideForm: 'Funga',
    appId: 'App ID halisi (kama Payme wanavyoionyesha)',
    sandboxAppId: 'App ID ya majaribio',
    secret: 'Siri ya app — acha wazi kuendelea kutumia iliyopo',
    mode: 'Toza kwa',
    live: 'Halisi',
    sandbox: 'Majaribio',
    save: 'Hifadhi na ujaribu',
    saved: 'Imehifadhiwa. Tunajaribu…',
    whyTitle: 'Payme wanakataa App ID — nini cha kufanya',
    steps: [
      'Ingia portal.paymeafrica.com na ufungue application yako.',
      'Hakikisha iko Active / imeidhinishwa. Akaunti mpya lazima zithibitishe biashara kabla funguo halisi hazijafanya kazi.',
      'Nakili App ID kama Payme wanavyoionyesha kwenye ukurasa wa credentials — ile waliyotoa, si jina ulilotunga — na siri. Weka hapo juu na uhifadhi.',
      'Bado inakataliwa? Weka App ID na siri hizo hizo kwenye paymeafrica.com/labs. Kama zana ya Payme wenyewe inatoa kosa hilo hilo, ni Payme pekee wanaoweza kurekebisha: WhatsApp +255 767 940 400.',
    ],
    allGood: 'Payme wamekubali taarifa hizi. Malipo yatapita.',
  },
};

/**
 * The part of the Payments tab that fixes things rather than describing them.
 *
 * Payme decides whether an App ID is active; nothing in this codebase can.
 * What it can do is let whoever holds the right ID paste it in here, without
 * a developer, a dashboard or a chat in between — and ask Payme, in one tap,
 * which of the two ids it accepts.
 */
export function PaymeTools({ onChanged }: { onChanged: () => void }) {
  const { lang } = useSettings();
  const C = COPY[lang];
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ live: PaymeProbe; sandbox: PaymeProbe } | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [appId, setAppId] = useState('');
  const [sandboxAppId, setSandboxAppId] = useState('');
  const [secret, setSecret] = useState('');
  const [sandboxMode, setSandboxMode] = useState<boolean | null>(null);
  const [notice, setNotice] = useState('');

  async function runTest() {
    setBusy(true);
    setError('');
    try {
      const r = await testPayme();
      setResult({ live: r.live, sandbox: r.sandbox });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  async function save() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await setPaymeConfig({
        app_id: appId.trim() || undefined,
        sandbox_app_id: sandboxAppId.trim() || undefined,
        secret: secret.trim() || undefined,
        sandbox: sandboxMode === null ? undefined : sandboxMode,
      });
      setSecret('');
      setNotice(C.saved);
      onChanged();
      setBusy(false);
      await runTest();
      setNotice('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const refused = result && (!result.live.accepted || !result.sandbox.accepted);
  const allGood = result && result.live.accepted;

  return (
    <div className="hq-card">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          className="hq-nav-item"
          style={{ width: 'auto', flex: 1, justifyContent: 'center', background: 'var(--brand)', color: 'var(--brandInk)', fontWeight: 800 }}
          disabled={busy}
          onClick={() => void runTest()}
        >
          <Icon name="refresh" size={14} /> {busy ? C.testing : C.test}
        </button>
        <button
          className="hq-nav-item"
          style={{ width: 'auto', flex: 1, justifyContent: 'center', border: '1px solid var(--line)' }}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name={open ? 'x' : 'edit'} size={14} /> {open ? C.hideForm : C.update}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {([[C.liveId, result.live], [C.sandboxId, result.sandbox]] as const).map(([label, p]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 11px', borderRadius: 11, background: p.accepted ? 'var(--okSoft)' : 'var(--badSoft)' }}>
              <Icon name={p.accepted ? 'check' : 'alert'} size={15} style={{ color: p.accepted ? 'var(--ok)' : 'var(--bad)', marginTop: 1, flexShrink: 0 }} />
              <div style={{ minWidth: 0, fontSize: 12 }}>
                <div style={{ fontWeight: 800 }}>{label} · <span style={{ fontFamily: 'ui-monospace, monospace' }}>{p.app_id || '—'}</span></div>
                <div style={{ color: p.accepted ? 'var(--ok)' : 'var(--bad)', fontWeight: 700 }}>
                  {p.accepted ? C.accepted : C.refused} — {p.status ? `HTTP ${p.status}: ` : ''}{p.message}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {allGood && <div className="hq-sub" style={{ marginTop: 10, color: 'var(--ok)' }}>{C.allGood}</div>}

      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="hq-input" placeholder={C.appId} value={appId} onChange={(e) => setAppId(e.target.value)} autoComplete="off" />
          <input className="hq-input" placeholder={C.sandboxAppId} value={sandboxAppId} onChange={(e) => setSandboxAppId(e.target.value)} autoComplete="off" />
          <input className="hq-input" type="password" placeholder={C.secret} value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="new-password" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--ink2)' }}>
            {C.mode}
            {([[false, C.live], [true, C.sandbox]] as const).map(([v, label]) => (
              <button
                key={label}
                className="hq-nav-item"
                data-on={sandboxMode === v || undefined}
                style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
                onClick={() => setSandboxMode(v)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="hq-nav-item"
            style={{ justifyContent: 'center', background: 'var(--brand)', color: 'var(--brandInk)', fontWeight: 800 }}
            disabled={busy || (!appId.trim() && !sandboxAppId.trim() && !secret.trim() && sandboxMode === null)}
            onClick={() => void save()}
          >
            {C.save}
          </button>
        </div>
      )}

      {notice && <div className="hq-sub" style={{ marginTop: 8 }}>{notice}</div>}
      {error && <div className="hq-sub" style={{ marginTop: 8, color: 'var(--bad)' }}>{error}</div>}

      {refused && (
        <div style={{ marginTop: 14 }}>
          <div className="hq-k" style={{ marginBottom: 6 }}>{C.whyTitle}</div>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {C.steps.map((s) => <li key={s} style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink2)' }}>{s}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}
