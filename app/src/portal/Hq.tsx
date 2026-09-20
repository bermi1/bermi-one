import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useToast } from '../state/ToastContext';
import { HQ } from './hq-i18n';
import { PortalShell, type HqSection } from './PortalShell';
import { useRealtimeInserts } from './useRealtime';
import { ClientDrawer } from './ClientDrawer';
import { InquiryDrawer } from './InquiryDrawer';
import { Donut, Sparkline, StackBar } from './Sparkline';
import { ACTION_TYPES, OBJECT_TYPES, type ObjectTypeName } from '../ontology/schema';
import { gatewayConfig, type GatewayConfig } from '../lib/billing';
import {
  fetchActivity, fetchAllPayments, fetchAudit, fetchClients, fetchDailySeries, fetchNotifications,
  fetchOntology, fetchOverview, fetchPlans, fetchSupportQueue, fetchWebhookEvents,
  type ActivityRow, type AuditRow, type ClientRow, type NotificationRow, type OntologySnapshot,
  type DailyPoint, type Inquiry, type Overview, type Plan, type PlatformPayment,
  type SubscriptionStatus, type WebhookEventRow,
} from '../lib/platform';

const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

/** The ontology registry carries both languages; pick the one in use. */
const objName = (o: ObjectTypeName, lang: 'en' | 'sw') =>
  lang === 'sw' ? OBJECT_TYPES[o].labelSw : OBJECT_TYPES[o].label;
const verbName = (a: keyof typeof ACTION_TYPES, lang: 'en' | 'sw') =>
  lang === 'sw' ? ACTION_TYPES[a].labelSw : ACTION_TYPES[a].label;
const tzs = (n: number) => 'TSh ' + Math.round(n).toLocaleString('en-US');

function when(iso: string, lang: 'en' | 'sw'): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return lang === 'sw' ? 'sasa hivi' : 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(iso).toLocaleDateString(lang === 'sw' ? 'sw-TZ' : 'en-GB', { day: '2-digit', month: 'short' });
}

/**
 * The Bermi Techs control panel.
 *
 * Six views over one company: what it earns, who is on it, what every tenant is
 * doing right now, the shape of the model underneath, the money coming in, and
 * a record of what staff themselves have done. The activity and payments feeds
 * are live — Realtime pushes new rows in rather than the page polling for them.
 */
export function Hq() {
  const { lang } = useSettings();
  const { flash } = useToast();
  const T = HQ[lang];

  const [section, setSection] = useState<HqSection>('overview');
  const [error, setError] = useState('');

  const [overview, setOverview] = useState<Overview | null>(null);
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
  const [ontology, setOntology] = useState<OntologySnapshot | null>(null);
  const [payments, setPayments] = useState<PlatformPayment[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [messages, setMessages] = useState<NotificationRow[] | null>(null);
  const [hooks, setHooks] = useState<WebhookEventRow[] | null>(null);
  const [gateway, setGateway] = useState<GatewayConfig | null>(null);
  const [gatewayError, setGatewayError] = useState('');
  const [series, setSeries] = useState<DailyPoint[]>([]);
  const [queue, setQueue] = useState<Inquiry[] | null>(null);
  const [openInquiry, setOpenInquiry] = useState<Inquiry | null>(null);

  const [query, setQuery] = useState('');
  const [objectFilter, setObjectFilter] = useState<ObjectTypeName | null>(null);
  const [openClient, setOpenClient] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError('');
    try {
      const [o, c, p, d] = await Promise.all([fetchOverview(), fetchClients(), fetchPlans(), fetchDailySeries(30)]);
      setOverview(o);
      setClients(c);
      setPlans(p);
      setSeries(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Each view fetches once, when it is first opened.
  useEffect(() => {
    if (section === 'activity' && !activity) void fetchActivity({ limit: 100 }).then(setActivity).catch((e) => setError(String(e)));
    if (section === 'ontology' && !ontology) void fetchOntology().then(setOntology).catch((e) => setError(String(e)));
    if (section === 'payments' && !payments) void fetchAllPayments().then(setPayments).catch((e) => setError(String(e)));
    // Configuration, not a payment: a gateway with no callback URL looks
    // exactly like a client who never answered the prompt, and the difference
    // is the whole diagnosis.
    if (section === 'payments' && !gateway && !gatewayError) {
      void gatewayConfig().then(setGateway).catch((e) => setGatewayError(e instanceof Error ? e.message : String(e)));
    }
    if (section === 'audit' && !audit) void fetchAudit().then(setAudit).catch((e) => setError(String(e)));
    if (section === 'messages' && !messages) void fetchNotifications().then(setMessages).catch((e) => setError(String(e)));
    if (section === 'webhooks' && !hooks) void fetchWebhookEvents().then(setHooks).catch((e) => setError(String(e)));
    if (section === 'inquiries' && !queue) void fetchSupportQueue().then(setQueue).catch((e) => setError(String(e)));
  }, [section, activity, ontology, payments, audit, messages, hooks, queue, gateway, gatewayError]);

  useEffect(() => {
    if (section !== 'activity') return;
    void fetchActivity({ limit: 100, objectType: objectFilter }).then(setActivity).catch(() => {});
  }, [objectFilter, section]);

  /** Mark a newly arrived row so it lands with a flash instead of silently. */
  const markFresh = useCallback((id: string) => {
    setFreshIds((s) => new Set(s).add(id));
    setTimeout(() => setFreshIds((s) => { const n = new Set(s); n.delete(id); return n; }), 3000);
  }, []);

  const live = useRealtimeInserts<ActivityRow>('action_log', (row) => {
    markFresh(row.id);
    setActivity((prev) => (prev ? [row, ...prev].slice(0, 200) : prev));
  });

  useRealtimeInserts<Inquiry>('inquiries', (row) => {
    markFresh(row.id);
    setQueue((prev) => (prev ? [row, ...prev] : prev));
  });

  useRealtimeInserts<NotificationRow>('notifications', (row) => {
    markFresh(row.id);
    setMessages((prev) => (prev ? [row, ...prev].slice(0, 200) : prev));
  });

  useRealtimeInserts<PlatformPayment>('payments', (row) => {
    markFresh(row.id);
    setPayments((prev) => (prev ? [row, ...prev].slice(0, 200) : prev));
  });

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !clients) return clients || [];
    return clients.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.owner_name || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q));
  }, [clients, query]);

  const statusCopy: Record<SubscriptionStatus, { label: string; ink: string; soft: string }> = {
    active: { label: T.statusActive, ink: 'var(--ok)', soft: 'var(--okSoft)' },
    trialing: { label: T.statusTrial, ink: 'var(--brand)', soft: 'var(--brandSoft)' },
    past_due: { label: T.statusPastDue, ink: 'var(--warn)', soft: 'var(--warnSoft)' },
    suspended: { label: T.statusSuspended, ink: 'var(--bad)', soft: 'var(--badSoft)' },
    cancelled: { label: T.statusCancelled, ink: 'var(--ink3)', soft: 'var(--card2)' },
  };

  function refresh() {
    void load();
    setActivity(null); setOntology(null); setPayments(null); setAudit(null);
    setMessages(null); setHooks(null); setQueue(null);
  }

  return (
    <PortalShell section={section} onSection={setSection} live={live} onRefresh={refresh}>
      {error && (
        <div className="hq-card" style={{ borderColor: 'var(--bad)', color: 'var(--bad)', fontWeight: 700, fontSize: 13 }}>
          {error}
        </div>
      )}

      {section === 'overview' && (
        overview ? (
          <>
            <div className="hq-grid">
              <div className="hq-card">
                <div className="hq-k">{T.mrr}</div>
                <div className="hq-v" style={{ color: 'var(--ok)' }}>{usd(overview.mrr)}</div>
                <div className="hq-sub">{overview.subscriptions.active} {T.statusActive.toLowerCase()}</div>
              </div>
              <div className="hq-card">
                <div className="hq-k">{T.collected30}</div>
                <div className="hq-v">{tzs(overview.collectedLast30)}</div>
                <div style={{ marginTop: 8 }}>
                  <Sparkline values={series.map((d) => d.collected)} height={34} tone="var(--ok)" label={T.collected30} />
                </div>
              </div>
              <div className="hq-card">
                <div className="hq-k">{T.accounts}</div>
                <div className="hq-v">{overview.accounts}</div>
                <div className="hq-sub">{overview.businesses} {T.businesses.toLowerCase()}</div>
              </div>
              <div className="hq-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Donut value={overview.subscriptions.active} total={Math.max(1, overview.accounts)} />
                <div style={{ minWidth: 0 }}>
                  <div className="hq-k">{T.paying}</div>
                  <div className="hq-v" style={{ fontSize: 17 }}>{overview.subscriptions.active} / {overview.accounts}</div>
                  <div className="hq-sub">{T.ofAccounts}</div>
                </div>
              </div>
            </div>

            <div className="hq-card">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <div className="hq-k">{T.salesTrend}</div>
                <div className="hq-sub" style={{ margin: 0 }}>{T.last30}</div>
              </div>
              <div className="hq-v" style={{ marginBottom: 4 }}>
                {tzs(series.reduce((sum, d) => sum + d.sales, 0))}
              </div>
              <Sparkline values={series.map((d) => d.sales)} height={92} label={T.salesTrend} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 11 }}>
              <div className="hq-card">
                <div className="hq-k">{T.closingsTrend}</div>
                <div className="hq-v" style={{ fontSize: 18 }}>
                  {overview.closingsLast30}
                  <span style={{ fontSize: 12.5, color: 'var(--ink3)', fontWeight: 700 }}> · {overview.verifiedLast30} {T.verified.toLowerCase()}</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Sparkline values={series.map((d) => d.closings)} height={56} tone="var(--brand)" label={T.closingsTrend} />
                </div>
              </div>

              <div className="hq-card">
                <div className="hq-k" style={{ marginBottom: 12 }}>{T.subscriptions}</div>
                <StackBar
                  segments={[
                    { label: T.statusActive, value: overview.subscriptions.active, tone: 'var(--ok)' },
                    { label: T.statusTrial, value: overview.subscriptions.trialing, tone: 'var(--brand)' },
                    { label: T.statusPastDue, value: overview.subscriptions.pastDue, tone: 'var(--warn)' },
                    { label: T.statusSuspended, value: overview.subscriptions.suspended, tone: 'var(--bad)' },
                    { label: T.statusCancelled, value: overview.subscriptions.cancelled, tone: 'var(--ink3)' },
                  ]}
                />
              </div>
            </div>
          </>
        ) : <div className="hq-empty">{T.loading}…</div>
      )}

      {section === 'clients' && (
        <>
          <input className="hq-input" placeholder={T.search} value={query} onChange={(e) => setQuery(e.target.value)} />
          {clients === null ? (
            <div className="hq-empty">{T.loading}…</div>
          ) : filteredClients.length === 0 ? (
            <div className="hq-empty">{T.nothingYet}</div>
          ) : (
            <div className="hq-list">
              {filteredClients.map((c) => {
                const st = statusCopy[(c.subscription?.status || 'trialing') as SubscriptionStatus];
                return (
                  <div key={c.id} className="hq-row" data-tap onClick={() => setOpenClient(c.id)}>
                    <div className="hq-row-main">
                      <div className="hq-row-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {c.name}
                        <span className="hq-tag" style={{ color: st.ink, background: st.soft }}>{st.label}</span>
                        {c.suspended && <span className="hq-tag" style={{ color: 'var(--bad)', background: 'var(--badSoft)' }}>{T.blockedTag}</span>}
                      </div>
                      <div className="hq-row-meta">
                        {[
                          c.owner_name,
                          c.city,
                          c.subscription?.subscription_plans?.name,
                          c.account_businesses > 1 ? `${c.account_businesses} ${T.businesses.toLowerCase()}` : null,
                          c.last_closing ? `${T.lastClosing} ${c.last_closing}` : T.noClosingYet,
                        ].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <Icon name="right" size={15} style={{ color: 'var(--ink3)' }} />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {section === 'activity' && (
        <>
          <div>
            <div className="hq-section-title">{T.activity}</div>
            <div className="hq-section-sub">{T.activitySub}</div>
          </div>
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 3 }}>
            <button
              className="hq-nav-item"
              data-on={objectFilter === null || undefined}
              style={{ width: 'auto', flexShrink: 0, padding: '6px 12px', fontSize: 12 }}
              onClick={() => setObjectFilter(null)}
            >
              {T.allObjects}
            </button>
            {(Object.keys(OBJECT_TYPES) as ObjectTypeName[]).map((o) => (
              <button
                key={o}
                className="hq-nav-item"
                data-on={objectFilter === o || undefined}
                style={{ width: 'auto', flexShrink: 0, padding: '6px 12px', fontSize: 12 }}
                onClick={() => setObjectFilter(o)}
              >
                {objName(o, lang)}
              </button>
            ))}
          </div>
          {activity === null ? (
            <div className="hq-empty">{T.loading}…</div>
          ) : activity.length === 0 ? (
            <div className="hq-empty">{T.nothingYet}</div>
          ) : (
            <div className="hq-list">
              {activity.map((a) => (
                <div key={a.id} className={`hq-row${freshIds.has(a.id) ? ' hq-new' : ''}`}>
                  <div className="hq-row-main">
                    <div className="hq-row-title">{a.summary}</div>
                    <div className="hq-row-meta">
                      {[
                        a.businesses?.name,
                        ACTION_TYPES[a.action_type] ? verbName(a.action_type, lang) : a.action_type,
                        a.actor_name,
                      ].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="hq-row-num" style={{ color: 'var(--ink3)', fontWeight: 600 }}>{when(a.created_at, lang)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {section === 'ontology' && (
        ontology ? (
          <>
            <div>
              <div className="hq-section-title">{T.objects}</div>
              <div className="hq-section-sub">{T.objectsSub}</div>
            </div>
            <div className="hq-grid">
              {(Object.keys(OBJECT_TYPES) as ObjectTypeName[]).map((o) => (
                <div key={o} className="hq-card">
                  <div className="hq-k">{objName(o, lang)}</div>
                  <div className="hq-v">{(ontology.objects[o] ?? 0).toLocaleString('en-US')}</div>
                  <div className="hq-sub">{T.records}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 6 }}>
              <div className="hq-section-title">{T.verbs}</div>
              <div className="hq-section-sub">{T.verbsSub}</div>
            </div>
            <div className="hq-list">
              {(Object.keys(ACTION_TYPES) as (keyof typeof ACTION_TYPES)[]).map((verb) => {
                const hit = ontology.actions.find((a) => a.action_type === verb);
                return (
                  <div key={verb} className="hq-row">
                    <div className="hq-row-main">
                      <div className="hq-row-title">{verbName(verb, lang)}</div>
                      <div className="hq-row-meta">
                        {objName(ACTION_TYPES[verb].objectType, lang)}
                        {hit ? ` · ${T.lastRun} ${when(hit.last_at, lang)}` : ` · ${T.neverRun}`}
                      </div>
                    </div>
                    <div className="hq-row-num" style={{ color: hit ? 'var(--ink)' : 'var(--ink3)' }}>
                      {hit ? Number(hit.n).toLocaleString('en-US') : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : <div className="hq-empty">{T.loading}…</div>
      )}

      {section === 'payments' && <GatewayCard config={gateway} error={gatewayError} T={T} />}

      {section === 'payments' && (
        payments === null ? <div className="hq-empty">{T.loading}…</div>
        : payments.length === 0 ? <div className="hq-empty">{T.nothingYet}</div>
        : (
          <div className="hq-list">
            {payments.map((p) => {
              const ink = p.status === 'COMPLETED' ? 'var(--ok)' : p.status === 'PENDING' ? 'var(--warn)' : 'var(--bad)';
              return (
                <div key={p.id} className={`hq-row${freshIds.has(p.id) ? ' hq-new' : ''}`}>
                  <Icon name={p.status === 'COMPLETED' ? 'check' : p.status === 'PENDING' ? 'clock' : 'alert'} size={15} style={{ color: ink }} />
                  <div className="hq-row-main">
                    <div className="hq-row-title">{p.businesses?.name || p.label || p.reference}</div>
                    <div className="hq-row-meta">
                      {[new Date(p.created_at).toLocaleDateString(), p.msisdn, p.sandbox ? 'sandbox' : null].filter(Boolean).join(' · ')}
                    </div>
                    {/* The reference is what gets quoted to the gateway, and the
                        provider message is usually the actual reason. */}
                    <div className="hq-row-meta" style={{ opacity: 0.75, fontFamily: 'ui-monospace, monospace', fontSize: 10.5 }}>
                      {p.reference}
                    </div>
                    {p.provider_message && (
                      <div className="hq-row-meta" style={{ color: ink }}>{p.provider_message}</div>
                    )}
                  </div>
                  <div className="hq-row-num" style={{ color: ink }}>{tzs(p.amount)}</div>
                </div>
              );
            })}
          </div>
        )
      )}

      {section === 'inquiries' && (
        <>
          <div>
            <div className="hq-section-title">{T.inquiries}</div>
            <div className="hq-section-sub">{T.inquiriesSub}</div>
          </div>
          {queue === null ? <div className="hq-empty">{T.loading}…</div>
          : queue.length === 0 ? <div className="hq-empty">{T.nothingYet}</div>
          : (
            <div className="hq-list">
              {queue.map((q) => {
                const mine = q.awaiting === 'support';
                return (
                  <div key={q.id} className={`hq-row${freshIds.has(q.id) ? ' hq-new' : ''}`} data-tap onClick={() => setOpenInquiry(q)}>
                    <Icon
                      name={q.status === 'resolved' || q.status === 'closed' ? 'check' : mine ? 'alert' : 'clock'}
                      size={15}
                      style={{ color: q.status === 'resolved' || q.status === 'closed' ? 'var(--ok)' : mine ? 'var(--warn)' : 'var(--ink3)' }}
                    />
                    <div className="hq-row-main">
                      <div className="hq-row-title">{q.subject}</div>
                      <div className="hq-row-meta">
                        {[q.business_name, q.owner_name, q.category].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <span
                      className="hq-tag"
                      style={{ color: mine ? 'var(--warn)' : 'var(--ink3)', background: mine ? 'var(--warnSoft)' : 'var(--card2)' }}
                    >
                      {mine ? T.waitingOnUs : T.waitingOnThem}
                    </span>
                    <div className="hq-row-num" style={{ color: 'var(--ink3)', fontWeight: 600 }}>{when(q.last_message_at, lang)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {section === 'messages' && (
        <>
          <div>
            <div className="hq-section-title">{T.messages}</div>
            <div className="hq-section-sub">{T.messagesSub}</div>
          </div>
          {messages === null ? <div className="hq-empty">{T.loading}…</div>
          : messages.length === 0 ? <div className="hq-empty">{T.nothingYet}</div>
          : (
            <div className="hq-list">
              {messages.map((m) => {
                const tone = m.status === 'sent' ? { ink: 'var(--ok)', label: T.sent }
                  : m.status === 'queued' ? { ink: 'var(--warn)', label: T.queued }
                  : m.status === 'skipped' ? { ink: 'var(--ink3)', label: T.skipped }
                  : { ink: 'var(--bad)', label: T.failedLabel };
                return (
                  <div key={m.id} className={`hq-row${freshIds.has(m.id) ? ' hq-new' : ''}`}>
                    <Icon name={m.channel === 'email' ? 'mail' : 'phone'} size={15} style={{ color: tone.ink }} />
                    <div className="hq-row-main">
                      {/* The first line of the summary is the business and the
                          date, which is exactly what identifies the message. */}
                      <div className="hq-row-title">{m.body.split('\n')[0] || m.subject || m.kind}</div>
                      <div className="hq-row-meta">
                        {[m.businesses?.name, m.recipient, m.provider, m.attempts > 1 ? `${m.attempts} tries` : null, m.provider_message]
                          .filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="hq-row-num" style={{ color: tone.ink, fontSize: 11 }}>{tone.label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {section === 'webhooks' && (
        <>
          <div>
            <div className="hq-section-title">{T.webhooks}</div>
            <div className="hq-section-sub">{T.webhooksSub}</div>
          </div>
          {hooks === null ? <div className="hq-empty">{T.loading}…</div>
          : hooks.length === 0 ? <div className="hq-empty">{T.nothingYet}</div>
          : (
            <div className="hq-list">
              {hooks.map((h) => (
                <div key={h.id} className="hq-row">
                  <Icon
                    name={h.signature_ok ? (h.handled ? 'check' : 'clock') : 'alert'}
                    size={15}
                    style={{ color: h.signature_ok ? (h.handled ? 'var(--ok)' : 'var(--warn)') : 'var(--bad)' }}
                  />
                  <div className="hq-row-main">
                    <div className="hq-row-title">{h.outcome || h.reference || h.source}</div>
                    <div className="hq-row-meta">
                      {[h.reference, h.signature_ok ? T.accepted : T.rejected].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="hq-row-num" style={{ color: 'var(--ink3)', fontWeight: 600 }}>{when(h.created_at, lang)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {section === 'audit' && (
        <>
          <div>
            <div className="hq-section-title">{T.whoDidWhat}</div>
            <div className="hq-section-sub">{T.auditSub}</div>
          </div>
          {audit === null ? <div className="hq-empty">{T.loading}…</div>
          : audit.length === 0 ? <div className="hq-empty">{T.nothingYet}</div>
          : (
            <div className="hq-list">
              {audit.map((a) => (
                <div key={a.id} className="hq-row">
                  <div className="hq-row-main">
                    <div className="hq-row-title">{a.summary}</div>
                    <div className="hq-row-meta">
                      {[a.actor_name || '—', a.businesses?.name, a.action].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="hq-row-num" style={{ color: 'var(--ink3)', fontWeight: 600 }}>{when(a.created_at, lang)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <InquiryDrawer
        inquiry={openInquiry}
        onClose={() => setOpenInquiry(null)}
        onChanged={() => { setQueue(null); void fetchSupportQueue().then(setQueue).catch(() => {}); }}
        onFlash={flash}
      />

      <ClientDrawer
        businessId={openClient}
        plans={plans}
        onClose={() => setOpenClient(null)}
        onChanged={() => { void load(); setAudit(null); }}
        onFlash={flash}
      />
    </PortalShell>
  );
}

/**
 * Whether payment can work at all, before anyone asks why it did not.
 *
 * Three different faults look identical from a client's phone: no credentials,
 * no callback URL, and a gateway that is not answering. The first two are
 * visible from here and are stated plainly, because "the pay button does
 * nothing" is not a bug report anybody can act on.
 *
 * No secret ever crosses this boundary — the function returns booleans.
 */
function GatewayCard({ config, error, T }: { config: GatewayConfig | null; error: string; T: typeof HQ.en }) {
  if (error) {
    return (
      <div className="hq-card" style={{ borderColor: 'var(--bad)' }}>
        <div className="hq-row">
          <Icon name="alert" size={15} style={{ color: 'var(--bad)' }} />
          <div className="hq-row-main">
            <div className="hq-row-title">{T.gatewayNotReady}</div>
            <div className="hq-row-meta">{error}</div>
          </div>
        </div>
      </div>
    );
  }
  if (!config) return <div className="hq-empty">{T.loading}…</div>;

  const rows: { k: string; ok: boolean; v: string }[] = [
    { k: T.gatewayAppId, ok: config.app_id_set, v: config.app_id_set ? T.set : T.notSet },
    { k: T.gatewaySecret, ok: config.secret_set, v: config.secret_set ? T.set : T.notSet },
    { k: T.gatewayCallback, ok: config.callback_set, v: config.callback_url || T.notSet },
    { k: T.gatewayMode, ok: true, v: config.sandbox ? T.gatewaySandbox : T.gatewayLive },
    { k: T.gatewayRate, ok: config.usd_rate > 0, v: String(config.usd_rate) },
  ];

  return (
    <div className="hq-card" style={{ borderColor: config.ready ? undefined : 'var(--bad)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <Icon name={config.ready ? 'check' : 'alert'} size={15} style={{ color: config.ready ? 'var(--ok)' : 'var(--bad)' }} />
        <div className="hq-section-title" style={{ margin: 0 }}>{T.gateway}</div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: config.ready ? 'var(--ok)' : 'var(--bad)' }}>
          {config.ready ? T.gatewayReady : T.gatewayNotReady}
        </span>
      </div>

      {rows.map((r) => (
        <div key={r.k} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '4px 0', fontSize: 12 }}>
          <span style={{ color: 'var(--ink3)', minWidth: 96 }}>{r.k}</span>
          <span style={{
            flex: 1, textAlign: 'right', fontWeight: 700, wordBreak: 'break-all',
            color: r.ok ? 'var(--ink)' : 'var(--bad)',
          }}>
            {r.v}
          </span>
        </div>
      ))}

      {!config.ready && (
        <div style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.5, color: 'var(--ink3)' }}>
          {config.callback_set ? T.gatewayMissing : T.gatewayCallbackMissing}
        </div>
      )}
    </div>
  );
}
