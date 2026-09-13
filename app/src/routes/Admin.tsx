import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useToast } from '../state/ToastContext';
import { countryByCode, formatMoney } from '../lib/countries';
import {
  chargeSubscription, fetchClient, fetchClients, fetchOverview, fetchPlans, fetchAllPayments,
  resetPassword, setSubscription, setSuspended,
  type ClientDetail, type ClientRow, type Overview, type Plan, type PlatformPayment, type SubscriptionStatus,
} from '../lib/platform';

const STATUS_TONE: Record<SubscriptionStatus, { ink: string; soft: string }> = {
  active: { ink: 'var(--ok)', soft: 'var(--okSoft)' },
  trialing: { ink: 'var(--brand)', soft: 'var(--brandSoft)' },
  past_due: { ink: 'var(--warn)', soft: 'var(--warnSoft)' },
  suspended: { ink: 'var(--bad)', soft: 'var(--badSoft)' },
  cancelled: { ink: 'var(--ink3)', soft: 'var(--card2)' },
};

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: 'Active', trialing: 'Trial', past_due: 'Past due', suspended: 'Suspended', cancelled: 'Cancelled',
};

/** Platform money is always TSh — this is Bermi Techs' own book, not a client's. */
const TZ = countryByCode('TZ');
const tsh = (n: number) => formatMoney(n, TZ);

/**
 * The Bermi Techs console: every client on the platform, what they pay, whether
 * they are still using it, and the two levers support actually needs — send a
 * password reset, and switch access off when a subscription lapses.
 */
export function Admin() {
  const { lang } = useSettings();
  const { flash } = useToast();

  const [tab, setTab] = useState<'overview' | 'clients' | 'payments'>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [payments, setPayments] = useState<PlatformPayment[] | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [o, c, p] = await Promise.all([fetchOverview(), fetchClients(), fetchPlans()]);
      setOverview(o);
      setClients(c);
      setPlans(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (tab !== 'payments' || payments) return;
    void fetchAllPayments().then(setPayments).catch((e) => setError(String(e)));
  }, [tab, payments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !clients) return clients || [];
    return clients.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.owner_name || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q));
  }, [clients, query]);

  async function open(businessId: string) {
    setBusy(true);
    try {
      setDetail(await fetchClient(businessId));
    } catch (e) {
      flash(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await fn();
      flash(done);
      await load();
      if (detail) setDetail(await fetchClient(detail.business.id));
    } catch (e) {
      flash(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  const kpi = (k: string, v: string, tone?: string) => (
    <div key={k} className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 10.5, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{k}</div>
      <div style={{ marginTop: 5, fontSize: 18, fontWeight: 800, color: tone || 'var(--ink)' }}>{v}</div>
    </div>
  );

  return (
    <div className="screen sb">
      <ScreenHeader
        title="Bermi Techs"
        sub={lang === 'sw' ? 'Usimamizi wa wateja wote' : 'Every client on the platform'}
        right={<button className="icon-btn tap" onClick={() => void load()} aria-label="Refresh"><Icon name="swap" size={16} /></button>}
      />

      {error && (
        <div className="card" style={{ padding: 14, marginBottom: 14, background: 'var(--badSoft)', color: 'var(--bad)', fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 4, marginBottom: 14 }}>
        {([['overview', 'Overview'], ['clients', 'Clients'], ['payments', 'Payments']] as const).map(([id, label]) => (
          <button
            key={id}
            className="tap"
            onClick={() => setTab(id)}
            style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: tab === id ? 'var(--card2)' : 'transparent', color: tab === id ? 'var(--ink)' : 'var(--ink3)' }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && overview && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            {kpi('Monthly recurring', tsh(overview.mrr), 'var(--ok)')}
            {kpi('Collected, 30 days', tsh(overview.collectedLast30))}
            {kpi('Clients', String(overview.businesses))}
            {kpi('Active, 30 days', `${overview.activeLast30} / ${overview.businesses}`)}
            {kpi('Closings, 30 days', String(overview.closingsLast30))}
            {kpi('Verified', String(overview.verifiedLast30))}
          </div>

          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4, margin: '18px 0 10px' }}>
            Subscriptions
          </div>
          <div className="card" style={{ padding: 14 }}>
            {(Object.keys(STATUS_LABEL) as SubscriptionStatus[]).map((s) => (
              <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13.5 }}>
                <span style={{ color: 'var(--ink2)', fontWeight: 600 }}>{STATUS_LABEL[s]}</span>
                <span style={{ fontWeight: 800, color: STATUS_TONE[s].ink }}>
                  {s === 'past_due' ? overview.subscriptions.pastDue : overview.subscriptions[s as 'active' | 'trialing' | 'suspended' | 'cancelled']}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'clients' && (
        <>
          <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', marginBottom: 12 }}>
            <Icon name="search" size={16} style={{ color: 'var(--ink3)' }} />
            <input
              placeholder="Search client, owner or city"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 14 }}
            />
          </label>

          {clients === null ? (
            <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>Loading…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map((c) => {
                const status = (c.subscription?.status || 'trialing') as SubscriptionStatus;
                const tone = STATUS_TONE[status];
                return (
                  <div key={c.id} className="card tap" onClick={() => void open(c.id)} style={{ padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14.5, fontWeight: 800 }}>{c.name}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase', color: tone.ink, background: tone.soft, padding: '3px 7px', borderRadius: 6 }}>
                            {STATUS_LABEL[status]}
                          </span>
                          {c.suspended && (
                            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--bad)', background: 'var(--badSoft)', padding: '3px 7px', borderRadius: 6 }}>
                              Blocked
                            </span>
                          )}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600 }}>
                          {[c.owner_name, c.city, c.subscription?.subscription_plans?.name].filter(Boolean).join(' · ') || '—'}
                        </div>
                        <div style={{ marginTop: 3, fontSize: 11, color: 'var(--ink3)' }}>
                          {c.last_closing ? `Last closing ${c.last_closing}` : 'No closing yet'}
                        </div>
                      </div>
                      <Icon name="right" size={16} style={{ color: 'var(--ink3)', flexShrink: 0, marginTop: 4 }} />
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>No clients match that.</div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'payments' && (
        <div className="card" style={{ padding: 6 }}>
          {payments === null && <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>Loading…</div>}
          {payments?.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>No subscription payments yet.</div>}
          {payments?.map((p, i) => {
            const ink = p.status === 'COMPLETED' ? 'var(--ok)' : p.status === 'PENDING' ? 'var(--warn)' : 'var(--bad)';
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 8px', borderBottom: i === payments.length - 1 ? 'none' : '1px solid var(--line)' }}>
                <div style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--card2)', color: ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Icon name={p.status === 'COMPLETED' ? 'check' : p.status === 'PENDING' ? 'clock' : 'alert'} size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.businesses?.name || p.reference}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink3)', fontWeight: 600 }}>
                    {new Date(p.created_at).toLocaleDateString()} · {p.msisdn || '—'}{p.sandbox ? ' · sandbox' : ''}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: ink }}>{tsh(p.amount)}</div>
              </div>
            );
          })}
        </div>
      )}

      <ClientSheet
        detail={detail}
        plans={plans}
        busy={busy}
        onClose={() => setDetail(null)}
        onSuspend={(on, reason) => act(() => setSuspended(detail!.business.id, on, reason), on ? 'Access blocked' : 'Access restored')}
        onPlan={(planId) => act(() => setSubscription(detail!.business.id, { plan_id: planId }), 'Plan updated')}
        onStatus={(status, days) => act(() => setSubscription(detail!.business.id, { status, period_days: days }), 'Subscription updated')}
        onPhone={(phone) => act(() => setSubscription(detail!.business.id, { billing_phone: phone }), 'Billing number saved')}
        onReset={(email) => act(async () => { await resetPassword(email); }, 'Recovery email sent')}
        onCharge={() => act(() => chargeSubscription(detail!.business.id), 'Prompt sent to the client')}
      />
    </div>
  );
}

function ClientSheet({ detail, plans, busy, onClose, onSuspend, onPlan, onStatus, onPhone, onReset, onCharge }: {
  detail: ClientDetail | null;
  plans: Plan[];
  busy: boolean;
  onClose: () => void;
  onSuspend: (on: boolean, reason?: string) => void;
  onPlan: (planId: string) => void;
  onStatus: (status: SubscriptionStatus, days?: number) => void;
  onPhone: (phone: string) => void;
  onReset: (email: string) => void;
  onCharge: () => void;
}) {
  const [reason, setReason] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    setReason(detail?.business.suspended_reason || '');
    setPhone(detail?.subscription?.billing_phone || '');
  }, [detail]);

  if (!detail) return null;

  const { business, owner, subscription, sessions } = detail;
  const status = (subscription?.status || 'trialing') as SubscriptionStatus;
  const verified = sessions.filter((s) => s.status === 'verified').length;
  const turnover = sessions.reduce((s, r) => s + Number(r.total_calculated_sales || 0), 0);

  return (
    <Sheet open onClose={onClose} title={business.name} sub={[owner.full_name, owner.email].filter(Boolean).join(' · ')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card" style={{ padding: 14 }}>
          {[
            ['Subscription', STATUS_LABEL[status]],
            ['Plan', subscription?.subscription_plans?.name || '—'],
            ['Renews', subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : '—'],
            ['Last sign in', owner.last_sign_in_at ? new Date(owner.last_sign_in_at).toLocaleDateString() : '—'],
            ['Closings on file', `${sessions.length} · ${verified} verified`],
            ['Turnover, last 30', tsh(turnover)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
              <span style={{ color: 'var(--ink2)', fontWeight: 600 }}>{k}</span>
              <span style={{ fontWeight: 800 }}>{v}</span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Plan</div>
          <div className="sb" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {plans.map((p) => {
              const on = subscription?.plan_id === p.id;
              return (
                <button
                  key={p.id}
                  className="tap"
                  data-disabled={busy}
                  onClick={() => onPlan(p.id)}
                  style={{ flexShrink: 0, padding: '9px 14px', borderRadius: 12, fontSize: 12.5, fontWeight: 700, background: on ? 'var(--brand)' : 'var(--card2)', color: on ? 'var(--brandInk)' : 'var(--ink2)', border: '1px solid var(--line)' }}
                >
                  {p.name} · {tsh(p.amount)}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost tap" style={{ flex: 1, fontSize: 12.5 }} data-disabled={busy} onClick={() => onStatus('active', 30)}>
            Mark paid · 30 days
          </button>
          <button className="btn-ghost tap" style={{ flex: 1, fontSize: 12.5 }} data-disabled={busy} onClick={() => onStatus('past_due')}>
            Mark past due
          </button>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Billing number</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input
              inputMode="tel"
              placeholder="0754 000 000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ flex: 1, padding: '9px 11px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card2)', fontSize: 13.5, fontWeight: 600 }}
            />
            <button className="chip tap" data-disabled={busy} onClick={() => onPhone(phone)}>Save</button>
          </div>
          <button
            className="btn-primary tap"
            style={{ width: '100%', marginTop: 10, fontSize: 13 }}
            data-disabled={busy || !phone}
            onClick={onCharge}
          >
            Send payment prompt
          </button>
        </div>

        <button
          className="btn-ghost tap"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          data-disabled={busy || !owner.email}
          onClick={() => owner.email && onReset(owner.email)}
        >
          <Icon name="lock" size={15} />
          Send password reset
        </button>

        <div className="card" style={{ padding: 12, background: business.suspended ? 'var(--badSoft)' : 'var(--card2)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: business.suspended ? 'var(--bad)' : 'var(--ink2)' }}>
            {business.suspended ? 'Access is blocked' : 'Block access'}
          </div>
          <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--ink2)', lineHeight: 1.5 }}>
            A blocked client can still read and export everything they own. They cannot record anything new until this is lifted.
          </div>
          {!business.suspended && (
            <input
              placeholder="Reason the client will see"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ width: '100%', marginTop: 8, padding: '9px 11px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', fontSize: 13 }}
            />
          )}
          <button
            className="btn-primary tap"
            style={{ width: '100%', marginTop: 10, fontSize: 13, background: business.suspended ? 'var(--ok)' : 'var(--bad)' }}
            data-disabled={busy}
            onClick={() => onSuspend(!business.suspended, reason)}
          >
            {business.suspended ? 'Restore access' : 'Block access'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
