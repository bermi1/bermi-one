import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { PLANS, TRIAL_DAYS, localPrice, localPriceNote, requiredPlan, type Plan, type PlanCode } from '../lib/plans';
import { PERIODS, checkPayment, isValidPhone, latestPayment, periodUsd, startPayment, type BillingPeriod, type LatestPayment, type PayStatus } from '../lib/billing';
import { useAuth } from '../state/AuthContext';
import { COUNTRIES } from '../lib/countries';
import { isNative } from '../lib/native';

/**
 * Plans, and the way to actually buy one.
 *
 * Two decisions shape this page. The recommended tier is the one the account
 * genuinely needs for the number of businesses it runs, not the dearest —
 * recommending Premium to someone with one bar is how a price list stops being
 * believed. And every figure appears in the customer's own currency with the
 * dollar beside it, because "TSh 53,000 a month" is a decision and "$20" is a
 * conversion they have to do first.
 */
export function Pricing() {
  const nav = useNavigate();
  const { L, lang } = useSettings();
  const { flash } = useToast();
  const { businesses, activeBusiness, plan: currentPlan, subscription, trialDays, onTrial, updateBusiness, refreshSubscription } = useData();
  const sw = lang === 'sw';

  const [country, setCountry] = useState(activeBusiness?.country_code || 'TZ');
  const [paying, setPaying] = useState<Plan | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>(PERIODS[0]);
  const { session: authSession } = useAuth();
  const uid = authSession?.user?.id ?? null;

  /*
    The last payment, on the page itself. The pay sheet only watches while it
    is open; the answer from Airtel or M-Pesa can take minutes, and the person
    should be able to close the sheet and still see where it got to.
  */
  const [latest, setLatest] = useState<LatestPayment | null>(null);
  const loadLatest = useCallback(async () => {
    if (!uid) return;
    try { setLatest(await latestPayment(uid)); } catch { /* the strip is a courtesy */ }
  }, [uid]);
  useEffect(() => { void loadLatest(); }, [loadLatest, paying]);
  useEffect(() => {
    if (latest?.status !== 'PENDING') return;
    const t = window.setInterval(() => { void loadLatest(); void refreshSubscription(); }, 30_000);
    return () => window.clearInterval(t);
  }, [latest?.status, loadLatest, refreshSubscription]);

  /*
    In the downloaded app this page states what the plan is and stops there.

    Play's billing policy does not allow a subscription to a digital service to
    be sold inside an Android app by any other means, and there is no version of
    "pay by mobile money" that satisfies it. So on native there are no prices, no
    Pay button, no payment sheet and no link out. The client manages the plan on
    the web, or asks us through Get help — which is allowed, and is better
    support than a dead button would be.
  */
  const native = isNative();

  const needed = useMemo(() => requiredPlan(businesses.length), [businesses.length]);
  const note = localPriceNote(lang, country);
  const activeCode = onTrial ? null : subscription?.subscription_plans?.code;

  const renews = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString(sw ? 'sw-TZ' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="screen sb desk-wide">
      <ScreenHeader
        title={native ? (sw ? 'Kifurushi chako' : 'Your plan') : (sw ? 'Bei na vifurushi' : 'Plans and pricing')}
        sub={native
          ? (sw ? 'Kile kifurushi chako kinachojumuisha.' : 'What your plan covers.')
          : (sw ? 'Lipa kwa mwezi, miezi 3 au mwaka. Acha wakati wowote.' : 'Pay monthly, quarterly or yearly. Cancel whenever.')}
      />

      {/* Where the account stands, before anything is being sold to it. */}
      <div className="card" style={{ padding: 18, marginBottom: 14, background: onTrial ? 'var(--grad)' : 'var(--card)', color: onTrial ? '#fff' : 'var(--ink)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name={onTrial ? 'spark' : 'check'} size={17} style={{ opacity: onTrial ? 1 : undefined, color: onTrial ? '#fff' : 'var(--ok)' }} />
          <div style={{ fontSize: 15, fontWeight: 800 }}>
            {onTrial
              ? (trialDays > 0
                ? (sw ? `Siku ${trialDays} zimebaki kwenye majaribio` : `${trialDays} ${trialDays === 1 ? 'day' : 'days'} left on your trial`)
                : (sw ? 'Majaribio yamekwisha' : 'Your trial has ended'))
              : `${currentPlan.name}`}
          </div>
        </div>
        <div style={{ marginTop: 6, fontSize: 12.5, opacity: onTrial ? 0.88 : 1, color: onTrial ? undefined : 'var(--ink2)', lineHeight: 1.5 }}>
          {onTrial
            ? (trialDays > 0
              ? (sw
                ? `Siku ${TRIAL_DAYS} zina kila kitu — biashara zote, watumishi wote, ripoti zote.`
                : `Your ${TRIAL_DAYS} days include everything — every business, every seat, every report.`)
              : native
                ? (sw
                  ? 'Taarifa zako zote zipo salama. Tuulize kupitia Pata msaada ili kuendelea.'
                  : 'Everything you have recorded is safe. Ask us through Get help to carry on.')
                : (sw
                  ? 'Taarifa zako zote zipo salama. Chagua kifurushi hapa chini ili kuendelea.'
                  : 'Everything you have recorded is safe. Choose a plan below to carry on.'))
            : renews
              ? (sw ? `Inaisha ${renews}` : `Renews ${renews}`)
              : (sw ? 'Hakuna kipindi kilichowekwa' : 'No period set yet')}
        </div>

        {/* What the plan covers, in the client's own terms: their businesses. */}
        {businesses.length > 0 && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 13 }}>
            {businesses.map((b) => (
              <span
                key={b.id}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 11.5, fontWeight: 700, padding: '6px 11px', borderRadius: 10,
                  background: onTrial ? 'rgba(255,255,255,.16)' : 'var(--card2)',
                  color: onTrial ? '#fff' : 'var(--ink2)',
                }}
              >
                <Icon name="building" size={12} />
                {b.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {!native && latest && <LatestStrip p={latest} country={country} sw={sw} />}

      {!native && (
        <div className="period-switch" role="tablist">
          {PERIODS.map((pd) => (
            <button
              key={pd.code}
              role="tab"
              aria-selected={period.code === pd.code}
              className="tap"
              data-on={period.code === pd.code || undefined}
              onClick={() => setPeriod(pd)}
            >
              <span>{periodName(pd, sw)}</span>
              {periodPerk(pd, sw) && <em>{periodPerk(pd, sw)}</em>}
            </button>
          ))}
        </div>
      )}

      {!native && (
      <div className="sb" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {COUNTRIES.map((c) => (
          <button
            key={c.code}
            className="tap"
            onClick={() => setCountry(c.code)}
            style={{ flexShrink: 0, padding: '7px 13px', borderRadius: 11, fontSize: 12, fontWeight: 700, background: country === c.code ? 'var(--brand)' : 'var(--card)', color: country === c.code ? 'var(--brandInk)' : 'var(--ink2)', border: '1px solid var(--line)' }}
          >
            {c.cur}
          </button>
        ))}
      </div>
      )}

      {native && (
        <div className="card" style={{ padding: 16, marginBottom: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--card2)', color: 'var(--ink2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="info" size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>
              {sw ? 'Kifurushi kinasimamiwa nje ya programu' : 'Your plan is managed outside the app'}
            </div>
            <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5 }}>
              {sw
                ? 'Kubadilisha au kuhuisha kifurushi, tuulize kupitia Pata msaada na tutakushughulikia.'
                : 'To change or renew a plan, ask us through Get help and we will sort it out with you.'}
            </div>
            <button className="btn-ghost tap" style={{ marginTop: 11, padding: '10px 14px', fontSize: 12.5, fontWeight: 700 }} onClick={() => nav('/help')}>
              {L.getHelp}
            </button>
          </div>
        </div>
      )}

      <div className="plan-grid">
        {PLANS.map((p) => (
          <PlanCard
            key={p.code}
            plan={p}
            country={country}
            lang={lang}
            recommended={p.code === needed.code}
            current={p.code === activeCode}
            businesses={businesses.length}
            native={native}
            period={period}
            onChoose={() => setPaying(p)}
          />
        ))}
      </div>

      {!native && note && (
        <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--ink3)', textAlign: 'center', lineHeight: 1.5 }}>{note}</div>
      )}

      {activeBusiness && currentPlan.limits.smsAlerts && (
        <AutomationPanel />
      )}

      <div className="card" style={{ marginTop: 16, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
          {native
            ? (sw ? 'Jinsi vifurushi vinavyofanya kazi' : 'How the plans work')
            : (sw ? 'Jinsi bei inavyofanya kazi' : 'How the pricing works')}
        </div>
        {[
          sw ? 'Kifurushi kimoja kinafunika akaunti yako yote, si kila biashara.' : 'One plan covers your whole account, not each business.',
          ...(native ? [] : [sw ? 'Lipa miezi 3 upate punguzo la 10%. Lipa mwaka mzima upate miezi 2 bure.' : 'Pay for 3 months and save 10%. Pay for a year and get 2 months free.']),
          sw ? 'Biashara moja ni Starter. Mbili au tatu ni Standard. Nne au zaidi ni Premium.' : 'One business is Starter. Two or three is Standard. Four or more is Premium.',
          ...(native ? [] : [sw ? 'Unalipa kwa simu yako. Utapokea ombi la PIN.' : 'You pay from your phone — a prompt arrives and you enter your PIN.']),
          sw ? 'Taarifa zako ni zako. Unaweza kuzitoa wakati wowote.' : 'Your records stay yours — export them any time, on any plan.',
        ].map((line) => (
          <div key={line} style={{ display: 'flex', gap: 9, padding: '5px 0', alignItems: 'flex-start' }}>
            <Icon name="check" size={13} style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5 }}>{line}</span>
          </div>
        ))}
      </div>

      <button className="btn-ghost tap" style={{ width: '100%', marginTop: 14 }} onClick={() => nav('/manage')}>{L.back}</button>

      {!native && (
        <PaySheet
          plan={paying}
          period={period}
          country={country}
          onClose={() => { setPaying(null); void loadLatest(); }}
          onPaid={() => { void refreshSubscription(); void loadLatest(); flash(sw ? 'Malipo yamekamilika' : 'Payment received'); }}
        />
      )}
    </div>
  );

  function AutomationPanel() {
    if (!activeBusiness) return null;
    return (
      <div className="card" style={{ marginTop: 14, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Icon name="spark" size={16} style={{ color: 'var(--brand)' }} />
          <div style={{ fontSize: 15.5, fontWeight: 800 }}>{L.automation}</div>
        </div>
        <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.45 }}>{L.automationSub}</div>

        {([
          ['sms_alerts', L.autoSms, L.autoSmsSub, !!activeBusiness.sms_alerts],
          ['auto_report_weekly', L.autoWeekly, L.autoWeeklySub, !!activeBusiness.auto_report_weekly],
          ['auto_report_monthly', L.autoMonthly, L.autoMonthlySub, !!activeBusiness.auto_report_monthly],
        ] as const).map(([field, label, sub, on]) => (
          <div
            key={field}
            className="tap"
            onClick={() => {
              const needsPhone = field === 'sms_alerts' && !activeBusiness.alerts_phone?.trim();
              const needsEmail = field !== 'sms_alerts' && !activeBusiness.alerts_email?.trim();
              if (!on && (needsPhone || needsEmail)) { flash(needsPhone ? L.alertsNeedPhone : L.alertsNeedEmail); return; }
              void updateBusiness({ [field]: !on });
            }}
            style={{ marginTop: 10, padding: 13, borderRadius: 14, background: on ? 'var(--okSoft)' : 'var(--card2)', display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: on ? 'var(--ok)' : 'var(--ink)' }}>{label}</div>
              <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--ink3)' }}>{sub}</div>
            </div>
            <div style={{ width: 42, height: 24, borderRadius: 99, background: on ? 'var(--ok)' : 'var(--line)', padding: 3, flexShrink: 0 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: on ? 'translateX(18px)' : 'none', transition: 'transform .15s' }} />
            </div>
          </div>
        ))}

        <input
          className="card"
          inputMode="tel"
          placeholder={L.alertsPhone}
          defaultValue={activeBusiness.alerts_phone || ''}
          onBlur={(e) => { const v = e.target.value.trim(); if (v !== (activeBusiness.alerts_phone || '')) void updateBusiness({ alerts_phone: v || null }); }}
          style={{ width: '100%', marginTop: 12, padding: '12px 14px', border: '1px solid var(--line)', fontSize: 13.5 }}
        />
        <input
          className="card"
          inputMode="email"
          placeholder={L.alertsEmail}
          defaultValue={activeBusiness.alerts_email || ''}
          onBlur={(e) => { const v = e.target.value.trim(); if (v !== (activeBusiness.alerts_email || '')) void updateBusiness({ alerts_email: v || null }); }}
          style={{ width: '100%', marginTop: 8, padding: '12px 14px', border: '1px solid var(--line)', fontSize: 13.5 }}
        />
      </div>
    );
  }
}

function PlanCard({ plan, country, lang, recommended, current, businesses, native, period, onChoose }: {
  plan: Plan;
  period: BillingPeriod;
  country: string;
  lang: 'en' | 'sw';
  recommended: boolean;
  current: boolean;
  businesses: number;
  native: boolean;
  onChoose: () => void;
}) {
  const sw = lang === 'sw';
  const totalUsd = periodUsd(plan.usd, period);
  const usd = `$${fmtUsd(totalUsd)}`;
  const local = localPrice(totalUsd, country);
  const showsLocal = local !== usd;
  const months = period.months;
  const savedUsd = Math.round((plan.usd * months - totalUsd) * 100) / 100;
  const perMonth = months > 1 ? localPrice(Math.round((totalUsd / months) * 100) / 100, country) : null;
  const saved = savedUsd > 0 ? localPrice(savedUsd, country) : null;

  // Says plainly when a tier cannot hold what the account already runs, rather
  // than letting someone buy it and hit a wall afterwards.
  const tooSmall = plan.limits.maxBusinesses >= 0 && businesses > plan.limits.maxBusinesses;

  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        border: recommended ? '1.5px solid var(--brand)' : '1px solid var(--line)',
        boxShadow: recommended ? '0 14px 34px rgba(47,91,255,.16)' : undefined,
        opacity: tooSmall ? 0.62 : 1,
      }}
    >
      {/* The price sits in a tinted head, so the tiers read as cards rather
          than as one long list of ticks. */}
      <div style={{ padding: '17px 18px 15px', background: recommended ? 'var(--brandSoft)' : 'var(--card2)' }}>
        <div className="plan-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 17.5, fontWeight: 800, letterSpacing: -0.35 }}>{plan.name}</span>
              {recommended && (
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--brandInk)', background: 'var(--brand)', padding: '3px 8px', borderRadius: 7 }}>
                  {sw ? 'Kwa ajili yako' : 'Right for you'}
                </span>
              )}
              {current && (
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--ok)', background: 'var(--okSoft)', padding: '3px 8px', borderRadius: 7 }}>
                  {sw ? 'Unatumia' : 'Current'}
                </span>
              )}
            </div>
            <div style={{ marginTop: 5, fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.45 }}>{plan.blurb[lang]}</div>
          </div>
          {!native && (
            <div className="plan-price" style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.7 }}>{showsLocal ? local : usd}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink3)', fontWeight: 700, marginTop: 1 }}>
                {showsLocal ? `${usd} · ` : ''}{periodPer(period, sw)}
              </div>
              {perMonth && (
                <div style={{ fontSize: 10.5, color: 'var(--ink2)', fontWeight: 700, marginTop: 3 }}>
                  ≈ {perMonth} {sw ? '/ mwezi' : '/ month'}
                </div>
              )}
              {saved && (
                <div className="save-pill">{sw ? `Unaokoa ${saved}` : `You save ${saved}`}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="plan-body" style={{ padding: '14px 18px 18px' }}>
        {plan.includes[lang].map((line) => (
          <div key={line} style={{ display: 'flex', gap: 9, padding: '4px 0', alignItems: 'flex-start' }}>
            <Icon name="check" size={13} style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.45 }}>{line}</span>
          </div>
        ))}

        {native ? null : tooSmall ? (
          <div style={{ marginTop: 12, fontSize: 11.5, fontWeight: 700, color: 'var(--warn)', lineHeight: 1.45 }}>
            {sw
              ? `Una biashara ${businesses}. Kifurushi hiki kinafunika ${plan.limits.maxBusinesses}.`
              : `You run ${businesses} businesses. This plan covers ${plan.limits.maxBusinesses}.`}
          </div>
        ) : (
          <button
            className={recommended ? 'btn-primary tap' : 'btn-ghost tap'}
            style={{ width: '100%', marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={onChoose}
          >
            <Icon name="phone" size={15} />
            {current
              ? addLabel(period, sw)
              : (sw ? `Lipa ${showsLocal ? local : usd}` : `Pay ${showsLocal ? local : usd}`)}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The payment itself.
 *
 * The gateway answers PENDING immediately and the real outcome arrives later —
 * by webhook, which is what actually activates the plan, and by polling here so
 * the person holding the phone can watch it land. Polling stops on a settled
 * status or after two minutes; a payment still pending then is not lost, it is
 * just slower than someone wants to sit and watch.
 */
function PaySheet({ plan, period, country, onClose, onPaid }: {
  plan: Plan | null;
  period: BillingPeriod;
  country: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const { lang } = useSettings();
  const sw = lang === 'sw';

  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [status, setStatus] = useState<PayStatus | null>(null);
  const [message, setMessage] = useState('');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!plan) { setReference(null); setStatus(null); setMessage(''); setBusy(false); setTimedOut(false); }
  }, [plan]);

  useEffect(() => {
    if (!reference || status !== 'PENDING') return;
    const started = Date.now();

    const tick = async () => {
      // Past two minutes the sheet says so, but it keeps asking — every 15s
      // instead of every 4 — for as long as it is open. Airtel and M-Pesa can
      // take a while, and the answer should land here when it comes, not only
      // on the next visit.
      const slow = Date.now() - started > 120_000;
      if (slow) setTimedOut(true);
      try {
        const out = await checkPayment(reference);
        if (out.status !== 'PENDING') {
          setStatus(out.status);
          setMessage(out.provider_message || '');
          if (out.status === 'COMPLETED') onPaid();
          return;
        }
      } catch {
        // A failed check is not a failed payment — keep waiting.
      }
      timer.current = window.setTimeout(tick, slow ? 15_000 : 4000);
    };

    timer.current = window.setTimeout(tick, 4000);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [reference, status, onPaid]);

  if (!plan) return null;

  const totalUsd = periodUsd(plan.usd, period);
  const local = localPrice(totalUsd, country);
  const shown = local !== `$${fmtUsd(totalUsd)}` ? `${local} ($${fmtUsd(totalUsd)})` : `$${fmtUsd(totalUsd)}`;

  async function pay() {
    if (!isValidPhone(phone)) {
      setMessage(sw ? 'Weka namba sahihi, mfano 0754 000 000.' : 'Enter a valid number, e.g. 0754 000 000.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const out = await startPayment(plan!.code as PlanCode, phone, period.code);
      setReference(out.reference);
      setStatus(out.status || 'PENDING');
      setMessage(out.message || '');
    } catch (e) {
      /*
        Three failures, three different next steps, and they used to arrive as
        one undifferentiated string. "Payments are not configured yet" is ours
        to fix and nothing the client does will help; an unreachable gateway is
        worth trying again in a minute; anything else is worth telling us about.
      */
      const raw = e instanceof Error ? e.message : String(e);
      // One prompt at a time: a second one while the first is still on the
      // phone is how people end up paying twice.
      if (/already waiting/i.test(raw)) {
        setMessage(sw
          ? 'Tayari kuna ombi la malipo kwenye simu yako. Likubali, au subiri dakika 3 kutuma jipya.'
          : raw);
        setBusy(false);
        return;
      }
      const notConfigured = /not configured/i.test(raw);
      // "The payment gateway refused the request: …" was matching the bare word
      // "gateway" below and being reported as unreachable — hiding the one
      // message that says what is actually wrong. A refusal is its own case.
      const refused = /refused/i.test(raw);
      const unreachable = !refused && /could not reach|network|failed to fetch/i.test(raw);
      setStatus('FAILED');
      setMessage(
        notConfigured
          ? (sw
            ? 'Malipo bado hayajawashwa. Tuulize kupitia Pata msaada — si kitu unachoweza kurekebisha.'
            : 'Payments are not switched on yet. Ask us through Get help — this one is ours, not yours.')
          : refused
            ? (sw
              ? `Lango la malipo limekataa ombi: ${raw.replace(/^.*refused the request:\s*/i, '')}. Hili ni letu kurekebisha — tuulize kupitia Pata msaada.`
              : `${raw}. This one is ours to fix — ask us through Get help.`)
          : unreachable
            ? (sw
              ? 'Hatukuweza kufikia lango la malipo. Jaribu tena baada ya dakika moja.'
              : 'We could not reach the payment gateway. Try again in a minute.')
            : raw,
      );
    }
    setBusy(false);
  }

  const tone =
    status === 'COMPLETED' ? { bg: 'var(--okSoft)', ink: 'var(--ok)', icon: 'check', text: sw ? 'Malipo yamepokelewa' : 'Payment received' }
    : status === 'FAILED' ? { bg: 'var(--badSoft)', ink: 'var(--bad)', icon: 'alert', text: sw ? 'Hayakuidhinishwa' : 'Not approved' }
    : status === 'CANCELLED' ? { bg: 'var(--badSoft)', ink: 'var(--bad)', icon: 'x', text: sw ? 'Umesitisha' : 'Cancelled' }
    : timedOut
      ? { bg: 'var(--card2)', ink: 'var(--ink2)', icon: 'clock', text: sw ? 'Bado hatujapata jibu' : 'We have not heard back yet' }
      : { bg: 'var(--warnSoft)', ink: 'var(--warn)', icon: 'clock', text: sw ? 'Angalia simu yako, weka PIN' : 'Check your phone and enter your PIN' };

  return (
    <Sheet
      open
      onClose={onClose}
      title={sw ? `Lipa ${plan.name}` : `Pay for ${plan.name}`}
      sub={shown + ' · ' + periodPer(period, sw)}
    >
      {reference ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: 20, background: tone.bg, textAlign: 'center' }}>
            <div style={{ width: 46, height: 46, borderRadius: 15, margin: '0 auto 12px', background: 'rgba(255,255,255,.55)', color: tone.ink, display: 'grid', placeItems: 'center' }}>
              <Icon name={tone.icon} size={21} />
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: tone.ink }}>{tone.text}</div>
            <div style={{ marginTop: 6, fontSize: 19, fontWeight: 800 }}>{shown}</div>
            {message && <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5 }}>{message}</div>}
            {status === 'FAILED' && !message && (
              <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5 }}>
                {sw
                  ? 'Ombi liliisha muda au lilikataliwa. Hakuna pesa iliyokatwa. Jaribu tena.'
                  : 'The prompt expired or was declined. Nothing was charged. Try again.'}
              </div>
            )}
            {timedOut && status === 'PENDING' && (
              <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5 }}>
                {sw
                  ? 'Bado tunasubiri Airtel/M-Pesa kuthibitisha. Unaweza kufunga — kifurushi kitawaka chenyewe malipo yakipita, na hali itaonekana kwenye ukurasa huu.'
                  : 'Still waiting for Airtel / M-Pesa to confirm. You can close this — the plan switches on by itself when it goes through, and the result shows on this page.'}
              </div>
            )}
            {/* Selectable: support asks for this, and a number you cannot copy
                is a number that gets read out wrong. */}
            <div style={{ marginTop: 9, fontSize: 10, color: 'var(--ink3)', fontWeight: 700, letterSpacing: 0.4, userSelect: 'all' }}>{reference}</div>
          </div>
          {(status === 'FAILED' || status === 'CANCELLED') && (
            <button className="btn-primary tap" style={{ width: '100%' }} onClick={() => { setReference(null); setStatus(null); setMessage(''); setTimedOut(false); }}>
              {sw ? 'Jaribu tena' : 'Try again'}
            </button>
          )}
          <button className={status === 'FAILED' || status === 'CANCELLED' ? 'btn-ghost tap' : 'btn-primary tap'} style={{ width: '100%' }} onClick={onClose}>
            {status === 'COMPLETED' ? (sw ? 'Vizuri' : 'Done') : (sw ? 'Funga' : 'Close')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div className="card" style={{ padding: 14, background: 'var(--card2)', display: 'flex', alignItems: 'center', gap: 11 }}>
            <Icon name="info" size={15} style={{ color: 'var(--ink3)', flexShrink: 0 }} />
            <div style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.45 }}>
              {sw
                ? 'Utapokea ombi kwenye simu. Weka PIN yako ya fedha kukamilisha.'
                : 'A prompt arrives on this phone. Enter your mobile money PIN to finish.'}
            </div>
          </div>
          <input
            autoFocus
            inputMode="tel"
            placeholder="0754 000 000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="card"
            style={{ padding: '14px 16px', border: 'none', fontSize: 16, fontWeight: 700 }}
          />
          {message && <div style={{ fontSize: 12.5, color: 'var(--bad)', fontWeight: 600 }}>{message}</div>}
          <button className="btn-primary tap" style={{ width: '100%' }} data-disabled={busy} onClick={pay}>
            {sw ? `Lipa ${shown}` : `Pay ${shown}`}
          </button>
        </div>
      )}
    </Sheet>
  );
}

function fmtUsd(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function periodName(p: BillingPeriod, sw: boolean): string {
  return p.code === 'monthly' ? (sw ? 'Kila mwezi' : 'Monthly') : p.code === 'quarterly' ? (sw ? 'Miezi 3' : 'Quarterly') : (sw ? 'Mwaka' : 'Annual');
}

function periodPerk(p: BillingPeriod, sw: boolean): string {
  if (p.freeMonths) return sw ? `Miezi ${p.freeMonths} bure` : `${p.freeMonths} months free`;
  if (p.discountPct) return sw ? `Okoa ${p.discountPct}%` : `Save ${p.discountPct}%`;
  return '';
}

function periodPer(p: BillingPeriod, sw: boolean): string {
  return p.code === 'monthly' ? (sw ? 'kwa mwezi' : 'per month') : p.code === 'quarterly' ? (sw ? 'kwa miezi 3' : 'for 3 months') : (sw ? 'kwa mwaka' : 'per year');
}

function addLabel(p: BillingPeriod, sw: boolean): string {
  return p.code === 'monthly' ? (sw ? 'Ongeza mwezi' : 'Add a month') : p.code === 'quarterly' ? (sw ? 'Ongeza miezi 3' : 'Add 3 months') : (sw ? 'Ongeza mwaka' : 'Add a year');
}

/** Where the last payment got to, so nobody has to keep the sheet open to find out. */
function LatestStrip({ p, country, sw }: { p: LatestPayment; country: string; sw: boolean }) {
  const when = new Date(p.updated_at || p.created_at);
  const age = Date.now() - new Date(p.created_at).getTime();
  // An old failure is history, not news.
  if (p.status !== 'PENDING' && age > 3 * 86_400_000) return null;
  const time = when.toLocaleString(sw ? 'sw-TZ' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const amount = `${countryCur(country)} ${Math.round(p.amount).toLocaleString('en-US')}`;
  const tone = p.status === 'COMPLETED'
    ? { cls: 'ok', icon: 'check', text: sw ? 'Malipo yamepokelewa — kifurushi kimewaka' : 'Payment received — your plan is on' }
    : p.status === 'PENDING'
      ? { cls: 'wait', icon: 'clock', text: sw ? 'Tunasubiri uthibitisho wa malipo' : 'Waiting for the payment to confirm' }
      : { cls: 'bad', icon: 'alert', text: sw ? 'Malipo ya mwisho hayakuidhinishwa — hakuna pesa iliyokatwa' : 'Last payment was not approved — nothing was charged' };
  return (
    <div className="pay-strip" data-tone={tone.cls}>
      <Icon name={tone.icon} size={16} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="pay-strip-title">{tone.text}</div>
        <div className="pay-strip-sub">{amount} · {time} · <span style={{ userSelect: 'all' }}>{p.reference}</span></div>
      </div>
      {p.status === 'PENDING' && <span className="pay-strip-dot" />}
    </div>
  );
}

/** Payments are collected in TSh; the strip states the amount actually pushed. */
function countryCur(_country: string): string {
  return 'TSh';
}
