import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { HQ } from './hq-i18n';
import {
  chargeSubscription, fetchClient, resetPassword, setBusinessSuspended, updateSubscription,
  type ClientDetail, type Plan, type SubscriptionStatus,
} from '../lib/platform';

const tzs = (n: number) => 'TSh ' + Math.round(n).toLocaleString('en-US');

/**
 * One ACCOUNT, and the levers support actually needs.
 *
 * Billing is the account's — one plan, one phone number, one subscription —
 * so it sits at the top. Blocking is per business: suspending one bar out of
 * three is a support action, not a billing event, so each business gets its
 * own block/unblock rather than one switch for the whole account.
 *
 * The blocking and billing controls write straight to the database as the
 * signed-in administrator, which is what lets the audit triggers record who
 * did it. Only the two things that genuinely need elevated rights — minting a
 * password recovery link and talking to the payment gateway — go through the
 * admin function.
 */
export function ClientDrawer({ ownerId, plans, onClose, onChanged, onFlash }: {
  ownerId: string | null;
  plans: Plan[];
  onClose: () => void;
  onChanged: () => void;
  onFlash: (msg: string) => void;
}) {
  const { lang } = useSettings();
  const T = HQ[lang];

  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [phone, setPhone] = useState('');

  const load = useCallback(async () => {
    if (!ownerId) { setDetail(null); return; }
    const d = await fetchClient(ownerId);
    setDetail(d);
    setReasons(Object.fromEntries(d.businesses.map((b) => [b.id, b.suspended_reason || ''])));
    setPhone(d.subscription?.billing_phone || '');
  }, [ownerId]);

  useEffect(() => { void load(); }, [load]);

  if (!ownerId) return null;

  async function act(fn: () => Promise<string | null | void>, done: string) {
    setBusy(true);
    try {
      const problem = await fn();
      if (typeof problem === 'string' && problem) onFlash(problem);
      else onFlash(done);
      await load();
      onChanged();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  const owner = detail?.owner;
  const sub = detail?.subscription;
  const businesses = detail?.businesses ?? [];
  const status = (sub?.status || 'trialing') as SubscriptionStatus;
  const statusLabel: Record<SubscriptionStatus, string> = {
    active: T.statusActive, trialing: T.statusTrial, past_due: T.statusPastDue,
    suspended: T.statusSuspended, cancelled: T.statusCancelled,
  };
  const sessions = detail?.sessions ?? [];
  const verified = sessions.filter((s) => s.status === 'verified').length;
  const turnover = sessions.reduce((s, r) => s + Number(r.total_calculated_sales || 0), 0);
  const lastClosingByBiz = new Map<string, string>();
  for (const s of sessions) if (!lastClosingByBiz.has(s.business_id)) lastClosingByBiz.set(s.business_id, s.session_date);

  return (
    <>
      <div className="hq-scrim" style={{ display: 'block' }} onClick={onClose} />
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 40,
          width: 'min(420px, 100vw)', background: 'var(--bg)', borderLeft: '1px solid var(--line)',
          overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        {!detail ? (
          <div className="hq-empty">{T.loading}…</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>
                  {owner?.full_name || businesses[0]?.name || T.owner}
                </div>
                <div style={{ marginTop: 3, fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>
                  {[owner?.email, businesses.length > 1 ? `${businesses.length} ${T.businesses.toLowerCase()}` : businesses[0]?.name]
                    .filter(Boolean).join(' · ')}
                </div>
              </div>
              <button className="hq-icon-btn" onClick={onClose} aria-label={T.cancel}><Icon name="x" size={14} /></button>
            </div>

            {/* Billing: one row per account, above the businesses it covers. */}
            <div className="hq-list">
              {[
                [T.status, statusLabel[status]],
                [T.plan, sub?.subscription_plans ? `${sub.subscription_plans.name} · $${sub.subscription_plans.amount}/mo` : '—'],
                [T.renews, sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '—'],
                [T.businessesOnAccount, String(businesses.length)],
                [T.lastSignIn, owner?.last_sign_in_at ? new Date(owner.last_sign_in_at).toLocaleDateString() : '—'],
                [T.closingsOnFile, `${sessions.length} · ${verified} ${T.verified.toLowerCase()}`],
                [T.turnover30, tzs(turnover)],
              ].map(([k, v]) => (
                <div key={k} className="hq-row">
                  <div className="hq-row-main"><div className="hq-row-meta" style={{ margin: 0 }}>{k}</div></div>
                  <div className="hq-row-num">{v}</div>
                </div>
              ))}
            </div>

            <div>
              <div className="hq-k" style={{ marginBottom: 7 }}>{T.plan}</div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {plans.map((p) => (
                  <button
                    key={p.id}
                    className="hq-nav-item"
                    data-on={sub?.plan_id === p.id || undefined}
                    style={{ width: 'auto', padding: '7px 12px', fontSize: 12 }}
                    disabled={busy}
                    onClick={() => owner && act(() => updateSubscription(owner.id, { plan_id: p.id }), T.save)}
                  >
                    {p.name} · ${p.amount}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="hq-nav-item"
                style={{ justifyContent: 'center', border: '1px solid var(--line)', fontSize: 12.5 }}
                disabled={busy}
                onClick={() => owner && act(() => updateSubscription(owner.id, { status: 'active', period_days: 30 }), T.markPaid)}
              >
                {T.markPaid}
              </button>
              <button
                className="hq-nav-item"
                style={{ justifyContent: 'center', border: '1px solid var(--line)', fontSize: 12.5 }}
                disabled={busy}
                onClick={() => owner && act(() => updateSubscription(owner.id, { status: 'past_due' }), T.markPastDue)}
              >
                {T.markPastDue}
              </button>
            </div>

            <div className="hq-card">
              <div className="hq-k">{T.billingNumber}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 7 }}>
                <input className="hq-input" inputMode="tel" placeholder="0754 000 000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <button
                  className="hq-nav-item"
                  style={{ width: 'auto', border: '1px solid var(--line)', fontSize: 12.5 }}
                  disabled={busy}
                  onClick={() => owner && act(() => updateSubscription(owner.id, { billing_phone: phone }), T.save)}
                >
                  {T.save}
                </button>
              </div>
              <button
                className="hq-nav-item"
                style={{ justifyContent: 'center', marginTop: 10, background: 'var(--brand)', color: 'var(--brandInk)', fontWeight: 800 }}
                disabled={busy || !phone || !owner}
                onClick={() => owner && act(async () => { await chargeSubscription(owner.id); }, T.sendPrompt)}
              >
                {T.sendPrompt}
              </button>
              <div className="hq-sub" style={{ marginTop: 7 }}>{T.chargesAccount}</div>
            </div>

            <button
              className="hq-nav-item"
              style={{ justifyContent: 'center', border: '1px solid var(--line)', fontSize: 12.5 }}
              disabled={busy || !owner?.email}
              onClick={() => owner?.email && act(async () => { await resetPassword(owner.email!); }, T.sendReset)}
            >
              <Icon name="lock" size={14} />
              {T.sendReset}
            </button>

            {/* Blocking is per business — one bar out of three going dark is a
                support action, not a billing event. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="hq-k">{T.businessesOnAccount}</div>
              {businesses.map((b) => (
                <div key={b.id} className="hq-card" style={{ borderColor: b.suspended ? 'var(--bad)' : 'var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 13.5 }}>{b.name}</div>
                    {b.suspended && <span className="hq-tag" style={{ color: 'var(--bad)', background: 'var(--badSoft)' }}>{T.blockedTag}</span>}
                  </div>
                  <div className="hq-sub" style={{ marginTop: 3 }}>
                    {[b.city, lastClosingByBiz.get(b.id) ? `${T.lastClosing} ${lastClosingByBiz.get(b.id)}` : T.noClosingYet]
                      .filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, marginTop: 9, color: b.suspended ? 'var(--bad)' : 'var(--ink2)' }}>
                    {b.suspended ? T.accessBlocked : T.blockAccess}
                  </div>
                  <div className="hq-sub" style={{ marginTop: 5, lineHeight: 1.5 }}>{T.blockNote}</div>
                  {!b.suspended && (
                    <input
                      className="hq-input"
                      style={{ marginTop: 9 }}
                      placeholder={T.blockReason}
                      value={reasons[b.id] ?? ''}
                      onChange={(e) => setReasons((r) => ({ ...r, [b.id]: e.target.value }))}
                    />
                  )}
                  <button
                    className="hq-nav-item"
                    style={{
                      justifyContent: 'center', marginTop: 10, fontWeight: 800,
                      background: b.suspended ? 'var(--ok)' : 'var(--bad)', color: '#fff',
                    }}
                    disabled={busy}
                    onClick={() => act(
                      () => setBusinessSuspended(b.id, !b.suspended, reasons[b.id]),
                      b.suspended ? T.restoreAccess : T.blockAccess,
                    )}
                  >
                    {b.suspended ? T.restoreAccess : T.blockAccess}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
