import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useToast } from '../state/ToastContext';
import { HQ } from './hq-i18n';
import { PortalShell, type HqSection } from './PortalShell';
import { useRealtimeInserts } from './useRealtime';
import { ClientDrawer } from './ClientDrawer';
import { ACTION_TYPES, OBJECT_TYPES, type ObjectTypeName } from '../ontology/schema';
import {
  fetchActivity, fetchAllPayments, fetchAudit, fetchClients, fetchOntology, fetchOverview, fetchPlans,
  type ActivityRow, type AuditRow, type ClientRow, type OntologySnapshot, type Overview, type Plan, type PlatformPayment,
  type SubscriptionStatus,
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

  const [query, setQuery] = useState('');
  const [objectFilter, setObjectFilter] = useState<ObjectTypeName | null>(null);
  const [openClient, setOpenClient] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

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

  // Each view fetches once, when it is first opened.
  useEffect(() => {
    if (section === 'activity' && !activity) void fetchActivity({ limit: 100 }).then(setActivity).catch((e) => setError(String(e)));
    if (section === 'ontology' && !ontology) void fetchOntology().then(setOntology).catch((e) => setError(String(e)));
    if (section === 'payments' && !payments) void fetchAllPayments().then(setPayments).catch((e) => setError(String(e)));
    if (section === 'audit' && !audit) void fetchAudit().then(setAudit).catch((e) => setError(String(e)));
  }, [section, activity, ontology, payments, audit]);

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
              </div>
              <div className="hq-card">
                <div className="hq-k">{T.accounts}</div>
                <div className="hq-v">{overview.accounts}</div>
                <div className="hq-sub">{overview.businesses} {T.businesses.toLowerCase()}</div>
              </div>
              <div className="hq-card">
                <div className="hq-k">{T.businesses}</div>
                <div className="hq-v">{overview.activeLast30} <span style={{ fontSize: 14, color: 'var(--ink3)' }}>/ {overview.businesses}</span></div>
                <div className="hq-sub">{T.activeBusinesses}</div>
              </div>
              <div className="hq-card">
                <div className="hq-k">{T.closings30}</div>
                <div className="hq-v">{overview.closingsLast30}</div>
                <div className="hq-sub">{overview.verifiedLast30} {T.verified.toLowerCase()}</div>
              </div>
              <div className="hq-card">
                <div className="hq-k">{T.onTrial}</div>
                <div className="hq-v" style={{ color: 'var(--brand)' }}>{overview.subscriptions.trialing}</div>
              </div>
              <div className="hq-card">
                <div className="hq-k">{T.blocked}</div>
                <div className="hq-v" style={{ color: overview.suspended ? 'var(--bad)' : undefined }}>{overview.suspended}</div>
              </div>
            </div>

            <div>
              <div className="hq-section-title">{T.subscriptions}</div>
              <div className="hq-list" style={{ marginTop: 9 }}>
                {(Object.keys(statusCopy) as SubscriptionStatus[]).map((s) => (
                  <div key={s} className="hq-row">
                    <div className="hq-row-main"><div className="hq-row-title">{statusCopy[s].label}</div></div>
                    <div className="hq-row-num" style={{ color: statusCopy[s].ink }}>
                      {s === 'past_due' ? overview.subscriptions.pastDue : overview.subscriptions[s as 'active' | 'trialing' | 'suspended' | 'cancelled']}
                    </div>
                  </div>
                ))}
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
                  </div>
                  <div className="hq-row-num" style={{ color: ink }}>{tzs(p.amount)}</div>
                </div>
              );
            })}
          </div>
        )
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
