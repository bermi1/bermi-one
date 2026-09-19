// What Bermi One costs, what each tier includes, and how that reads in the
// money the customer actually holds.
//
// Prices are denominated in USD because that is what the business is priced in;
// every screen shows the local figure beside it, because "TSh 53,000 a month"
// is a decision someone can make and "$20" is a conversion they have to do.

import { COUNTRIES, countryByCode, type Country } from './countries';
import type { Lang } from './types';

export type PlanCode = 'starter' | 'standard' | 'premium';

export interface PlanLimits {
  /** -1 means no ceiling. */
  maxBusinesses: number;
  maxStaff: number;
  maxProducts: number;
  combinedReporting: boolean;
  whatsappShare: boolean;
  csvImport: boolean;
  bulkMigration: boolean;
  /** The day's summary by SMS and email, the moment a closing is verified. */
  smsAlerts: boolean;
  /** Weekly and monthly summaries that arrive without anyone asking. */
  autoReports: boolean;
  prioritySupport: boolean;
}

export interface Plan {
  code: PlanCode;
  name: string;
  usd: number;
  /** The line that makes someone recognise themselves in the tier. */
  blurb: Record<Lang, string>;
  limits: PlanLimits;
  /** Shown as ticks on the pricing card, in order. */
  includes: Record<Lang, string[]>;
}

export const TRIAL_DAYS = 14;

export const PLANS: Plan[] = [
  {
    code: 'starter',
    name: 'Starter',
    usd: 20,
    blurb: {
      en: 'One business, counted and closed every night.',
      sw: 'Biashara moja, kuhesabiwa na kufungwa kila usiku.',
    },
    limits: {
      maxBusinesses: 1, maxStaff: 3, maxProducts: 400,
      combinedReporting: false, whatsappShare: true, csvImport: true,
      bulkMigration: false, smsAlerts: false, autoReports: false, prioritySupport: false,
    },
    includes: {
      en: [
        '1 business',
        'Up to 3 staff accounts',
        'Nightly stock closing and verification',
        'Cash book — every shilling in and out',
        'Printable stock sheets and closing reports',
        'WhatsApp summaries',
      ],
      sw: [
        'Biashara 1',
        'Hadi wafanyakazi 3',
        'Kufunga na kuthibitisha bidhaa kila usiku',
        'Daftari la fedha — kila shilingi',
        'Karatasi za bidhaa na ripoti za kuchapisha',
        'Muhtasari kwa WhatsApp',
      ],
    },
  },
  {
    code: 'standard',
    name: 'Standard',
    usd: 30,
    blurb: {
      en: 'Up to three businesses, read together or one by one.',
      sw: 'Hadi biashara tatu, kwa pamoja au moja moja.',
    },
    limits: {
      maxBusinesses: 3, maxStaff: 12, maxProducts: 2000,
      combinedReporting: true, whatsappShare: true, csvImport: true,
      bulkMigration: true, smsAlerts: false, autoReports: false, prioritySupport: false,
    },
    includes: {
      en: [
        'Up to 3 businesses',
        'Up to 12 staff accounts',
        'Combined reporting across all three',
        'Bulk data migration from your old system',
        'Everything in Starter',
      ],
      sw: [
        'Hadi biashara 3',
        'Hadi wafanyakazi 12',
        'Ripoti za pamoja kwa zote tatu',
        'Kuhamisha data nyingi kutoka mfumo wako wa zamani',
        'Kila kitu cha Starter',
      ],
    },
  },
  {
    code: 'premium',
    name: 'Premium',
    usd: 45,
    blurb: {
      en: 'Stop going to look. The numbers come to you.',
      sw: 'Acha kwenda kuangalia. Takwimu zinakujia wewe.',
    },
    limits: {
      maxBusinesses: -1, maxStaff: -1, maxProducts: -1,
      combinedReporting: true, whatsappShare: true, csvImport: true,
      bulkMigration: true, smsAlerts: true, autoReports: true, prioritySupport: true,
    },
    includes: {
      en: [
        'Daily SMS the moment a day is verified',
        'Weekly and monthly reports by email, automatically',
        'Unlimited businesses, staff and products',
        'Priority support on WhatsApp',
        'Everything in Standard',
      ],
      sw: [
        'SMS ya kila siku mara siku inapothibitishwa',
        'Ripoti za wiki na mwezi kwa barua pepe, kiotomatiki',
        'Biashara, wafanyakazi na bidhaa bila kikomo',
        'Msaada wa haraka kwa WhatsApp',
        'Kila kitu cha Standard',
      ],
    },
  },
];

export function planByCode(code: string | null | undefined): Plan {
  return PLANS.find((p) => p.code === code) || PLANS[0];
}

/**
 * The tier an account genuinely needs for the number of businesses it runs.
 * One fits Starter, two or three need Standard, four or more need Premium —
 * the same rule the database enforces, so the screen and the ceiling agree.
 */
export function requiredPlan(businessCount: number): Plan {
  if (businessCount > 3) return planByCode('premium');
  if (businessCount > 1) return planByCode('standard');
  return planByCode('starter');
}

/** Converting USD into a local price, through the TZS pivot the app already uses. */
const USD = COUNTRIES.find((c) => c.code === 'US')!;

export function usdToLocal(usd: number, country: Country): number {
  const tzs = usd / USD.rate;
  return tzs * country.rate;
}

/**
 * A monthly price in local money, rounded to something a person would actually
 * say out loud. Exact conversions like "TSh 52,631" read as a machine's number;
 * rounding to the nearest useful unit reads as a price.
 */
export function localPrice(usd: number, countryCode: string): string {
  const country = countryByCode(countryCode);
  if (country.code === 'US') return `$${usd}`;

  const raw = usdToLocal(usd, country);
  const step = raw >= 100000 ? 1000 : raw >= 10000 ? 500 : raw >= 1000 ? 100 : raw >= 100 ? 10 : 1;
  const rounded = Math.round(raw / step) * step;
  return `${country.sym} ${rounded.toLocaleString('en-US')}`;
}

/** Local rates move; the price list should not pretend otherwise. */
export function localPriceNote(lang: Lang, countryCode: string): string {
  if (countryByCode(countryCode).code === 'US') return '';
  return lang === 'sw'
    ? 'Bei ni ya kadirio; malipo hufanyika kwa dola za Kimarekani.'
    : 'Local figure is indicative — billing is in US dollars.';
}

export function isUnlimited(n: number): boolean {
  return n < 0;
}

export function limitLabel(n: number, lang: Lang): string {
  return isUnlimited(n) ? (lang === 'sw' ? 'Bila kikomo' : 'Unlimited') : String(n);
}
