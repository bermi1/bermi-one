import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { PLANS, TRIAL_DAYS, localPrice, localPriceNote, requiredPlan, type Plan } from '../lib/plans';
import { COUNTRIES } from '../lib/countries';

/**
 * The page that has to make the price make sense.
 *
 * Two decisions shape it. First, the recommended tier is the one the account
 * genuinely needs for the number of businesses it runs — not the dearest one.
 * Recommending Premium to someone with one bar is how a price list stops being
 * believed. Second, every figure appears in the customer's own currency with
 * the dollar beside it, because "TSh 53,000 a month" is a decision and "$20" is
 * a conversion they have to do first.
 */
export function Pricing() {
  const nav = useNavigate();
  const { L, lang } = useSettings();
  const { flash } = useToast();
  const { businesses, activeBusiness, plan: currentPlan, subscription, trialDays, onTrial, updateBusiness } = useData();

  const [country, setCountry] = useState(activeBusiness?.country_code || 'TZ');
  const needed = useMemo(() => requiredPlan(businesses.length), [businesses.length]);
  const sw = lang === 'sw';

  const note = localPriceNote(lang, country);
  const activeCode = onTrial ? null : subscription?.subscription_plans?.code;

  return (
    <div className="screen sb">
      <ScreenHeader
        title={sw ? 'Bei na vifurushi' : 'Plans and pricing'}
        sub={sw ? 'Lipa kwa mwezi. Acha wakati wowote.' : 'Billed monthly. Cancel whenever.'}
      />

      {onTrial && (
        <div className="card" style={{ padding: 16, marginBottom: 14, background: 'var(--grad)', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="spark" size={17} />
            <div style={{ fontSize: 14.5, fontWeight: 800 }}>
              {trialDays > 0
                ? sw ? `Siku ${trialDays} zimebaki kwenye majaribio` : `${trialDays} ${trialDays === 1 ? 'day' : 'days'} left on your trial`
                : sw ? 'Majaribio yamekwisha' : 'Your trial has ended'}
            </div>
          </div>
          <div style={{ marginTop: 6, fontSize: 12.5, opacity: 0.85, lineHeight: 1.5 }}>
            {sw
              ? `Siku ${TRIAL_DAYS} za majaribio zina kila kitu — biashara nyingi, wafanyakazi wengi, ripoti zote. Chagua kifurushi kabla hazijaisha.`
              : `Your ${TRIAL_DAYS} days include everything — every business, every seat, every report. Pick a plan before they run out and nothing changes.`}
          </div>
        </div>
      )}

      {/* Currency picker: the price should be readable by whoever is looking. */}
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PLANS.map((p) => (
          <PlanCard
            key={p.code}
            plan={p}
            country={country}
            lang={lang}
            recommended={p.code === needed.code}
            current={p.code === activeCode}
            businesses={businesses.length}
          />
        ))}
      </div>

      {/* Automation lives with the plan that includes it. Showing the switches
          to someone whose plan cannot deliver them is how a product teaches
          people that its settings are decorative. */}
      {activeBusiness && currentPlan.limits.smsAlerts && (
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
      )}

      {note && (
        <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--ink3)', textAlign: 'center', lineHeight: 1.5 }}>
          {note}
        </div>
      )}

      <div className="card" style={{ marginTop: 16, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
          {sw ? 'Jinsi bei inavyofanya kazi' : 'How the pricing works'}
        </div>
        {[
          sw ? 'Kifurushi kimoja kinafunika akaunti yako yote, si kila biashara.' : 'One plan covers your whole account, not each business.',
          sw ? 'Biashara moja ni Starter. Mbili au tatu ni Standard. Nne au zaidi ni Premium.' : 'One business is Starter. Two or three is Standard. Four or more is Premium.',
          sw ? 'Ukiongeza biashara, tunakuambia kabla ya kukutoza.' : 'Add a business and we tell you what it changes before you are charged.',
          sw ? 'Taarifa zako ni zako. Unaweza kuzitoa wakati wowote.' : 'Your records stay yours — export them any time, on any plan.',
        ].map((line) => (
          <div key={line} style={{ display: 'flex', gap: 9, padding: '5px 0', alignItems: 'flex-start' }}>
            <Icon name="check" size={13} style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5 }}>{line}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: 'var(--ink3)', textAlign: 'center', lineHeight: 1.6 }}>
        {sw ? 'Unatumia' : 'You are on'} <b style={{ color: 'var(--ink2)' }}>{onTrial ? (sw ? 'majaribio' : 'the trial') : currentPlan.name}</b>
        {' · '}
        {businesses.length} {businesses.length === 1 ? (sw ? 'biashara' : 'business') : (sw ? 'biashara' : 'businesses')}
      </div>

      <button className="btn-ghost tap" style={{ width: '100%', marginTop: 14 }} onClick={() => nav('/manage')}>
        {L.back}
      </button>
    </div>
  );
}

function PlanCard({ plan, country, lang, recommended, current, businesses }: {
  plan: Plan;
  country: string;
  lang: 'en' | 'sw';
  recommended: boolean;
  current: boolean;
  businesses: number;
}) {
  const sw = lang === 'sw';
  const usd = `$${plan.usd}`;
  const local = localPrice(plan.usd, country);
  const showsLocal = local !== usd;

  // Says plainly when a tier cannot hold what the account already runs, rather
  // than letting someone pick it and hit a wall afterwards.
  const tooSmall = plan.limits.maxBusinesses >= 0 && businesses > plan.limits.maxBusinesses;

  return (
    <div
      className="card"
      style={{
        padding: 18,
        border: recommended ? '2px solid var(--brand)' : '1px solid var(--line)',
        opacity: tooSmall ? 0.62 : 1,
        position: 'relative',
      }}
    >
      {(recommended || current) && (
        <div style={{ position: 'absolute', top: -9, left: 18, display: 'flex', gap: 6 }}>
          {recommended && (
            <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--brandInk)', background: 'var(--brand)', padding: '3px 9px', borderRadius: 7 }}>
              {sw ? 'Kwa ajili yako' : 'Right for you'}
            </span>
          )}
          {current && (
            <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--ok)', background: 'var(--okSoft)', padding: '3px 9px', borderRadius: 7 }}>
              {sw ? 'Unatumia' : 'Current'}
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>{plan.name}</div>
          <div style={{ marginTop: 3, fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.45 }}>{plan.blurb[lang]}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.6 }}>{showsLocal ? local : usd}</div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700, marginTop: 1 }}>
            {showsLocal ? `${usd} · ` : ''}{sw ? 'kwa mwezi' : 'per month'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 13, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
        {plan.includes[lang].map((line) => (
          <div key={line} style={{ display: 'flex', gap: 9, padding: '4px 0', alignItems: 'flex-start' }}>
            <Icon name="check" size={13} style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.45 }}>{line}</span>
          </div>
        ))}
      </div>

      {tooSmall && (
        <div style={{ marginTop: 11, fontSize: 11.5, fontWeight: 700, color: 'var(--warn)', lineHeight: 1.45 }}>
          {sw
            ? `Una biashara ${businesses}. Kifurushi hiki kinafunika ${plan.limits.maxBusinesses}.`
            : `You run ${businesses} businesses. This plan covers ${plan.limits.maxBusinesses}.`}
        </div>
      )}
    </div>
  );
}
