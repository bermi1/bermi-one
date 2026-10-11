export type Role = 'owner' | 'staff';
export type Theme = 'light' | 'dark';
export type Lang = 'en' | 'sw';
/**
 * A closing moves open -> submitted -> verified. The owner can instead send it
 * back as `rejected`, which is deliberately distinct from a fresh `open` day:
 * it carries owner_comments telling the counter what to fix. `verified` is
 * terminal and immutable.
 */
export type SessionStatus = 'open' | 'submitted' | 'verified' | 'rejected';
export type EntryKind = 'sale' | 'purchase' | 'expense' | 'payment' | 'withdrawal' | 'loss' | 'stock' | 'debt';
export type AccountId = 'cash' | 'mobile' | 'bank';

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
  lang: Lang;
  theme: Theme;
  country_code: string;
  onboarded: boolean;
  active_business_id: string | null;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  type: string;
  city: string | null;
  country_code: string;
  answers: Record<string, boolean | null>;
  sort_order: number;
  /** Set by Bermi Techs when a subscription lapses. Reads stay open; writes stop. */
  suspended?: boolean;
  suspended_reason?: string | null;
  /** Premium automation: what is switched on, and where it goes. */
  sms_alerts?: boolean;
  auto_report_weekly?: boolean;
  auto_report_monthly?: boolean;
  alerts_phone?: string | null;
  alerts_email?: string | null;
  /** Public booking link, /book/<slug> — barbershops only, set on first share. */
  slug?: string | null;
  /** Module settings: opening hours, barber commission rates, booking slot length. */
  settings?: BusinessSettings;
}

export interface BusinessSettings {
  /** ISO weekday "1" (Mon) … "7" (Sun) → [open, close] as "HH:MM", or null when closed. */
  hours?: Record<string, [string, string] | null>;
  /** staff_member id → commission % for that barber (overrides each service's rate). */
  barber_commission?: Record<string, number>;
  slot_min?: number;
  /** Appointments and the public booking link. Off by default: most shops run on walk-ins. */
  bookings_enabled?: boolean;
  /** May staff change a service's price on the ticket? Default yes. */
  staff_edit_price?: boolean;
  /** May staff give discounts? Default no. */
  staff_discount?: boolean;
  tz?: string;
  public_phone?: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  icon: string;
  cat: string;
  unit: string;
  /** Selling price per unit (item_price in the stock template). */
  price: number;
  /** Profit earned per unit sold (item_profit) — supplied by the business, never derived. */
  profit: number;
  cost: number;
  opening: number;
  added: number;
  /**
   * Stock delivered while a closing sat submitted and frozen for review. It is
   * physically on the shelf but must not change the figures under review, so it
   * waits here and folds into `added` the moment that closing is verified.
   */
  incoming: number;
  low: number;
  wk: number;
  sort_order: number;
}

export interface StaffMember {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  title: string | null;
  sort_order: number;
  /** Barbershop only: who cuts hair, who takes the money, or both. */
  salon_role?: SalonRole;
}

export type SalonRole = 'barber' | 'cashier' | 'both';

export interface Accounts {
  business_id: string;
  cash: number;
  mobile: number;
  bank: number;
}

export interface LedgerEntry {
  id: string;
  business_id: string;
  kind: EntryKind;
  label: string;
  amount: number;
  account: AccountId;
  who_name: string | null;
  created_at: string;
}

export type ClosingItemKind = 'expense' | 'loss' | 'debt';

export interface ClosingItem {
  id: string;
  kind: ClosingItemKind;
  amount: number;
  note: string;
}

/**
 * One product as it stood on the night a closing was submitted.
 *
 * The products table holds live figures — opening, added and price all move on
 * as soon as the day rolls forward or someone edits a price. A closing that
 * reads them is a closing that rewrites itself, including the printed sheet
 * somebody signed. These are frozen at submission instead.
 */
export interface SessionLine {
  id: string;
  name: string;
  cat: string;
  unit: string;
  opening: number;
  added: number;
  price: number;
  profit: number;
}

export interface StockSession {
  id: string;
  business_id: string;
  session_date: string;
  status: SessionStatus;
  counts: Record<string, number>;
  cash: number;
  mobile: number;
  bank_in: number;
  /** Cash physically sent to the bank at close. */
  amount_to_bank: number;
  /** Frozen at submit so a later price edit can't rewrite a signed-off day. */
  total_calculated_sales: number;
  total_calculated_profit: number;
  closing_items: ClosingItem[];
  /** Frozen at submit. Empty on closings recorded before snapshots existed. */
  lines: SessionLine[];
  reason: string | null;
  note: string | null;
  owner_comments: string | null;
  submitted_by_name: string | null;
  submitted_at: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
}

export const KIND_SIGN: Record<EntryKind, number> = {
  sale: 1, payment: 1, purchase: -1, expense: -1, withdrawal: -1, loss: 0, stock: 0, debt: 0,
};

export const KIND_ICON: Record<EntryKind, string> = {
  sale: 'cash', payment: 'phone', purchase: 'truck', expense: 'receipt', withdrawal: 'out', loss: 'alert', stock: 'box', debt: 'user',
};

/**
 * Bar and Barbershop are built out: the bar around its nightly closing sheet,
 * the barbershop around the chair — services, clients, bookings, payouts. The
 * rest are listed so people can see where this is going, but they are marked
 * `live: false` and cannot be picked yet.
 */
export const BUSINESS_TYPES = [
  { id: 'bar', name: 'Bar & lounge', nameSw: 'Baa na lounge', icon: 'bottle', live: true,
    desc: 'Nightly stock count, cash and profit', descSw: 'Hesabu ya stoo kila usiku, fedha na faida' },
  { id: 'barber', name: 'Barbershop & salon', nameSw: 'Kinyozi na saluni', icon: 'scissors', live: true,
    desc: 'Services, barbers, clients and payouts', descSw: 'Huduma, vinyozi, wateja na malipo' },
  { id: 'rest', name: 'Restaurant', nameSw: 'Mgahawa', icon: 'fork', live: false, desc: '', descSw: '' },
  { id: 'pharm', name: 'Pharmacy', nameSw: 'Famasia', icon: 'pill', live: false, desc: '', descSw: '' },
  { id: 'groc', name: 'Grocery', nameSw: 'Duka la vyakula', icon: 'cart', live: false, desc: '', descSw: '' },
  { id: 'retail', name: 'Retail shop', nameSw: 'Duka', icon: 'store', live: false, desc: '', descSw: '' },
  { id: 'whole', name: 'Wholesale', nameSw: 'Jumla', icon: 'truck', live: false, desc: '', descSw: '' },
  { id: 'serv', name: 'Services', nameSw: 'Huduma', icon: 'tool', live: false, desc: '', descSw: '' },
  { id: 'hotel', name: 'Hotel', nameSw: 'Hoteli', icon: 'bed', live: false, desc: '', descSw: '' },
  { id: 'manu', name: 'Manufacturing', nameSw: 'Viwanda', icon: 'factory', live: false, desc: '', descSw: '' },
  { id: 'other', name: 'Other', nameSw: 'Nyingine', icon: 'plus', live: false, desc: '', descSw: '' },
] as const;

/** The module's name in the person's language. */
export function typeName(type: string, lang: string) {
  const m = bizMeta(type);
  return lang === 'sw' ? m.nameSw : m.name;
}

export function isLiveType(type: string): boolean {
  return BUSINESS_TYPES.some((b) => b.id === type && b.live);
}

export function bizMeta(type: string) {
  return BUSINESS_TYPES.find((b) => b.id === type) || BUSINESS_TYPES[BUSINESS_TYPES.length - 1];
}

export const TINTS = ['brand', 'vio', 'sky', 'ok', 'warn'] as const;
export function tintVars(i: number) {
  const t = TINTS[i % TINTS.length];
  return { soft: `var(--${t}Soft)`, ink: `var(--${t})` };
}
