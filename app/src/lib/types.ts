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
  /** The paid SMS add-on, and where the summary goes. */
  sms_alerts?: boolean;
  alerts_phone?: string | null;
  alerts_email?: string | null;
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
}

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
 * Bar is the only module that is actually built out — the closing sheet, the
 * profit-per-bottle template and the reports are all shaped around it. The rest
 * are listed so people can see where this is going, but they are marked
 * `live: false` and cannot be picked yet.
 */
export const BUSINESS_TYPES = [
  { id: 'bar', name: 'Bar', icon: 'bottle', live: true },
  { id: 'rest', name: 'Restaurant', icon: 'fork', live: false },
  { id: 'pharm', name: 'Pharmacy', icon: 'pill', live: false },
  { id: 'groc', name: 'Grocery', icon: 'cart', live: false },
  { id: 'retail', name: 'Retail', icon: 'store', live: false },
  { id: 'whole', name: 'Wholesale', icon: 'truck', live: false },
  { id: 'serv', name: 'Service', icon: 'tool', live: false },
  { id: 'hotel', name: 'Hotel', icon: 'bed', live: false },
  { id: 'manu', name: 'Manufacturing', icon: 'factory', live: false },
  { id: 'other', name: 'Other', icon: 'plus', live: false },
] as const;

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
