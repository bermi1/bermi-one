// The ontology: the formal noun/verb model behind Bermi One.
//
// Object Types (nouns) are the entities the business is made of. Link Types
// describe how they relate. Action Types (verbs, see actions.ts) are the only
// sanctioned way any object is ever created or changed — every one of them is
// logged to `action_log`, which is what lets Bermi AI reason about the
// business's history instead of just its current snapshot.
//
// This registry is internal: SME owners never see the words "ontology",
// "object type" or "action type" anywhere in the UI. It exists so the app's
// logic and Bermi AI's reasoning are both built on one explicit model instead
// of scattered ad hoc state.

export type ObjectTypeName = 'Business' | 'Product' | 'StockSession' | 'LedgerEntry' | 'Accounts' | 'Profile' | 'StaffMember';

export interface ObjectTypeDef {
  label: string;
  /** The console is bilingual, so the model it displays has to be too. */
  labelSw: string;
  description: string;
  properties: string[];
  links: Partial<Record<ObjectTypeName, string>>; // related object type -> relationship description
}

export const OBJECT_TYPES: Record<ObjectTypeName, ObjectTypeDef> = {
  Business: {
    label: 'Business',
    labelSw: 'Biashara',
    description: 'One business in the owner’s portfolio (a bar, pharmacy, shop, etc).',
    properties: ['name', 'type', 'city', 'answers'],
    links: { Product: 'has many', StockSession: 'has many', LedgerEntry: 'has many', Accounts: 'has one', StaffMember: 'has many' },
  },
  Product: {
    label: 'Product',
    labelSw: 'Bidhaa',
    description: 'Something the business stocks and sells.',
    properties: ['name', 'cat', 'unit', 'cost', 'price', 'opening', 'added', 'low', 'wk', 'sort_order'],
    links: { Business: 'belongs to' },
  },
  StockSession: {
    label: 'Closing session',
    labelSw: 'Kufunga siku',
    description: 'One day’s stock count and cash reconciliation.',
    properties: ['session_date', 'status', 'counts', 'cash', 'mobile', 'bank_in', 'closing_items', 'reason', 'note'],
    links: { Business: 'belongs to' },
  },
  LedgerEntry: {
    label: 'Ledger entry',
    labelSw: 'Ingizo la fedha',
    description: 'One recorded money movement (sale, expense, purchase, withdrawal...).',
    properties: ['kind', 'label', 'amount', 'account', 'who_name', 'created_at'],
    links: { Business: 'belongs to' },
  },
  Accounts: {
    label: 'Account balances',
    labelSw: 'Salio la akaunti',
    description: 'The business’s standing cash / mobile money / bank balances.',
    properties: ['cash', 'mobile', 'bank'],
    links: { Business: 'belongs to' },
  },
  Profile: {
    label: 'Person',
    labelSw: 'Mtu',
    description: 'A signed-in user (owner or staff) and their preferences.',
    properties: ['full_name', 'role', 'lang', 'theme', 'country_code'],
    links: { Business: 'owns / works in' },
  },
  StaffMember: {
    label: 'Staff member',
    labelSw: 'Mfanyakazi',
    description: 'Someone who works at the business (not necessarily a signed-in user).',
    properties: ['name', 'phone', 'title', 'sort_order'],
    links: { Business: 'belongs to' },
  },
};

export type ActionTypeName =
  | 'stock.add'
  | 'stock.updatePrice'
  | 'stock.reorder'
  | 'stock.addProduct'
  | 'stock.updateProduct'
  | 'stock.bulkImport'
  | 'session.submit'
  | 'session.approve'
  | 'session.return'
  | 'session.delete'
  | 'ledger.recordLines'
  | 'business.create'
  | 'business.update'
  | 'staff.add'
  | 'staff.remove';

export interface ActionTypeDef {
  label: string;
  labelSw: string;
  objectType: ObjectTypeName;
}

export const ACTION_TYPES: Record<ActionTypeName, ActionTypeDef> = {
  'stock.add': { labelSw: 'Ongeza bidhaa kwenye stoo', label: 'Add stock', objectType: 'Product' },
  'stock.updatePrice': { labelSw: 'Badilisha bei', label: 'Change price', objectType: 'Product' },
  'stock.reorder': { labelSw: 'Panga upya bidhaa', label: 'Reorder products', objectType: 'Product' },
  'stock.addProduct': { labelSw: 'Ongeza bidhaa mpya', label: 'Add product', objectType: 'Product' },
  'stock.updateProduct': { labelSw: 'Sasisha bidhaa', label: 'Update product', objectType: 'Product' },
  'stock.bulkImport': { labelSw: 'Ingiza bidhaa kwa wingi', label: 'Bulk import products', objectType: 'Product' },
  'session.submit': { labelSw: 'Wasilisha kufunga', label: 'Submit closing', objectType: 'StockSession' },
  'session.approve': { labelSw: 'Thibitisha kufunga', label: 'Approve closing', objectType: 'StockSession' },
  'session.return': { labelSw: 'Rudisha kufunga kwa marekebisho', label: 'Return closing for correction', objectType: 'StockSession' },
  'session.delete': { labelSw: 'Futa kufunga', label: 'Delete closing', objectType: 'StockSession' },
  'ledger.recordLines': { labelSw: 'Rekodi ingizo la fedha', label: 'Record money entry', objectType: 'LedgerEntry' },
  'business.create': { labelSw: 'Fungua biashara', label: 'Create business', objectType: 'Business' },
  'business.update': { labelSw: 'Sasisha wasifu wa biashara', label: 'Update business profile', objectType: 'Business' },
  'staff.add': { labelSw: 'Ongeza mfanyakazi', label: 'Add staff member', objectType: 'StaffMember' },
  'staff.remove': { labelSw: 'Ondoa mfanyakazi', label: 'Remove staff member', objectType: 'StaffMember' },
};
