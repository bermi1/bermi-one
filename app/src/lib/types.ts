export type Role = 'owner' | 'staff';
export type Theme = 'light' | 'dark';
export type Lang = 'en' | 'sw';
export type SessionStatus = 'open' | 'submitted' | 'approved';
export type EntryKind = 'sale' | 'purchase' | 'expense' | 'payment' | 'withdrawal' | 'loss' | 'stock';
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
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  icon: string;
  cat: string;
  unit: string;
  cost: number;
  price: number;
  opening: number;
  added: number;
  low: number;
  wk: number;
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

export interface StockSession {
  id: string;
  business_id: string;
  session_date: string;
  status: SessionStatus;
  counts: Record<string, number>;
  cash: number;
  mobile: number;
  bank_in: number;
  expenses_paid: number;
  reason: string | null;
  note: string | null;
  submitted_by_name: string | null;
  submitted_at: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
}

export const KIND_SIGN: Record<EntryKind, number> = {
  sale: 1, payment: 1, purchase: -1, expense: -1, withdrawal: -1, loss: 0, stock: 0,
};

export const KIND_ICON: Record<EntryKind, string> = {
  sale: 'cash', payment: 'phone', purchase: 'truck', expense: 'receipt', withdrawal: 'out', loss: 'alert', stock: 'box',
};

export const BUSINESS_TYPES = [
  { id: 'bar', name: 'Bar', icon: 'bottle' },
  { id: 'rest', name: 'Restaurant', icon: 'fork' },
  { id: 'pharm', name: 'Pharmacy', icon: 'pill' },
  { id: 'groc', name: 'Grocery', icon: 'cart' },
  { id: 'retail', name: 'Retail', icon: 'store' },
  { id: 'whole', name: 'Wholesale', icon: 'truck' },
  { id: 'serv', name: 'Service', icon: 'tool' },
  { id: 'hotel', name: 'Hotel', icon: 'bed' },
  { id: 'manu', name: 'Manufacturing', icon: 'factory' },
  { id: 'other', name: 'Other', icon: 'plus' },
] as const;

export function bizMeta(type: string) {
  return BUSINESS_TYPES.find((b) => b.id === type) || BUSINESS_TYPES[BUSINESS_TYPES.length - 1];
}

export const TINTS = ['brand', 'vio', 'sky', 'ok', 'warn'] as const;
export function tintVars(i: number) {
  const t = TINTS[i % TINTS.length];
  return { soft: `var(--${t}Soft)`, ink: `var(--${t})` };
}
