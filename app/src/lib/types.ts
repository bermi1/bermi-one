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

export const SEED_PRODUCTS: Omit<Product, 'id' | 'business_id' | 'sort_order'>[] = [
  { name: 'Tusker Lager', icon: 'bottle', cat: 'Beer', unit: 'btl', cost: 2200, price: 3500, opening: 40, added: 20, low: 24, wk: 310 },
  { name: 'Safari Lager', icon: 'bottle', cat: 'Beer', unit: 'btl', cost: 2100, price: 3000, opening: 30, added: 10, low: 24, wk: 240 },
  { name: 'Kilimanjaro', icon: 'bottle', cat: 'Beer', unit: 'btl', cost: 2200, price: 3500, opening: 24, added: 0, low: 24, wk: 180 },
  { name: 'Serengeti', icon: 'bottle', cat: 'Beer', unit: 'btl', cost: 2000, price: 3000, opening: 36, added: 12, low: 24, wk: 340 },
  { name: 'Castle Lite', icon: 'bottle', cat: 'Beer', unit: 'btl', cost: 2500, price: 4000, opening: 18, added: 0, low: 24, wk: 90 },
  { name: 'Coca-Cola 500ml', icon: 'cup', cat: 'Soda', unit: 'btl', cost: 700, price: 1500, opening: 50, added: 20, low: 30, wk: 410 },
  { name: 'Sprite 500ml', icon: 'cup', cat: 'Soda', unit: 'btl', cost: 700, price: 1500, opening: 30, added: 0, low: 30, wk: 220 },
  { name: 'Konyagi 250ml', icon: 'glass', cat: 'Spirits', unit: 'btl', cost: 3500, price: 6000, opening: 15, added: 6, low: 10, wk: 120 },
  { name: 'Savanna Dry', icon: 'glass', cat: 'Cider', unit: 'btl', cost: 3000, price: 5000, opening: 12, added: 0, low: 10, wk: 70 },
  { name: 'Water 500ml', icon: 'droplet', cat: 'Water', unit: 'btl', cost: 300, price: 1000, opening: 40, added: 0, low: 20, wk: 260 },
];

export const TINTS = ['brand', 'vio', 'sky', 'ok', 'warn'] as const;
export function tintVars(i: number) {
  const t = TINTS[i % TINTS.length];
  return { soft: `var(--${t}Soft)`, ink: `var(--${t})` };
}
