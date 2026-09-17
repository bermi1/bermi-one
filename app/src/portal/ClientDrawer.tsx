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
 * One client account, and the levers support actually needs.
 *
 * The blocking and billing controls write straight to the database as the
 * signed-in administrator, which is what lets the audit triggers record who
 * did it. Only the two things that genuinely need elevated rights — minting a
 * password recovery link and talking to the payment gateway — go through the
 * admin function.
 */
export function ClientDrawer({ businessId, plans, onClose, onChanged, onFlash }: {
  businessId: string | null;
  plans: Plan[];
  onClose: () => void;
  onChanged: () => void;
  onFlash: (msg: string) => void;
}) {
  const { lang } = useSettings();
  const T = HQ[lang];

  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [phone, setPhone] = useState('');

  const load = useCallback(async () => {
    if (!businessId) { setDetail(null); return; }
    const d = await fetchClient(businessId);
    setDetail(d);
    setReason(d.business.suspended_reason || '');
    setPhone(d.subscription?.billing_phone || '');
  }, [businessId]);

  useEffect(() => { void load(); }, [load]);

  if (!businessId) return null;

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
  const status = (sub?.status || 'trialing') as SubscriptionStatus;
  const statusLabel: Record<SubscriptionStatus, string> = {
    active: T.statusActive, trialing: T.statusTrial, past_due: T.statusPastDue,
    suspended: T.statusSuspended, cancelled: T.statusCancelled,
  };
  const sessions = detail?.sessions ?? [];
  const verified = sessions.filter((s) => s.status === 'verified').length;
  const turnover = sessions.reduce((s, r) => s + Number(r.total_calculated_sales || 0), 0);

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
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>{detail.business.name}</div>
                <div style={{ marginTop: 3, fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>
                  {[owner?.full_name, owner?.email].filter(Boolean).join(' · ')}
                </div>
              </div>
              <button className="hq-icon-btn" onClick={onClose} aria-label={T.cancel}><Icon name="x" size={14} /></button>
            </div>

            <div className="hq-list">
              {[
                [T.status, statusLabel[status]],
                [T.plan, sub?.subscription_plans ? `${sub.subscription_plans.name} · $${sub.subscription_plans.amount}/mo` : '—'],
                [T.renews, sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '—'],
                [T.businessesOnAccount, String(detail.account_businesses.length || 1)],
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
                disabled={busy || !phone}
                onClick={() => act(async () => { await chargeSubscription(detail.business.id); }, T.sendPrompt)}
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

            <div className="hq-card" style={{ borderColor: detail.business.suspended ? 'var(--bad)' : 'var(--line)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: detail.business.suspended ? 'var(--bad)' : 'var(--ink2)' }}>
                {detail.business.suspended ? T.accessBlocked : T.blockAccess}
              </div>
              <div className="hq-sub" style={{ marginTop: 5, lineHeight: 1.5 }}>{T.blockNote}</div>
              {!detail.business.suspended && (
                <input className="hq-input" style={{ marginTop: 9 }} placeholder={T.blockReason} value={reason} onChange={(e) => setReason(e.target.value)} />
              )}
              <button
                className="hq-nav-item"
                style={{
                  justifyContent: 'center', marginTop: 10, fontWeight: 800,
                  background: detail.business.suspended ? 'var(--ok)' : 'var(--bad)', color: '#fff',
                }}
                disabled={busy}
                onClick={() => act(
                  () => setBusinessSuspended(detail.business.id, !detail.business.suspended, reason),
                  detail.business.suspended ? T.restoreAccess : T.blockAccess,
                )}
              >
                {detail.business.suspended ? T.restoreAccess : T.blockAccess}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
