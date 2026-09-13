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
  description: string;
  properties: string[];
  links: Partial<Record<ObjectTypeName, string>>; // related object type -> relationship description
}

export const OBJECT_TYPES: Record<ObjectTypeName, ObjectTypeDef> = {
  Business: {
    label: 'Business',
    description: 'One business in the owner’s portfolio (a bar, pharmacy, shop, etc).',
    properties: ['name', 'type', 'city', 'answers'],
    links: { Product: 'has many', StockSession: 'has many', LedgerEntry: 'has many', Accounts: 'has one', StaffMember: 'has many' },
  },
  Product: {
    label: 'Product',
    description: 'Something the business stocks and sells.',
    properties: ['name', 'cat', 'unit', 'cost', 'price', 'opening', 'added', 'low', 'wk', 'sort_order'],
    links: { Business: 'belongs to' },
  },
  StockSession: {
    label: 'Closing session',
    description: 'One day’s stock count and cash reconciliation.',
    properties: ['session_date', 'status', 'counts', 'cash', 'mobile', 'bank_in', 'closing_items', 'reason', 'note'],
    links: { Business: 'belongs to' },
  },
  LedgerEntry: {
    label: 'Ledger entry',
    description: 'One recorded money movement (sale, expense, purchase, withdrawal...).',
    properties: ['kind', 'label', 'amount', 'account', 'who_name', 'created_at'],
    links: { Business: 'belongs to' },
  },
  Accounts: {
    label: 'Account balances',
    description: 'The business’s standing cash / mobile money / bank balances.',
    properties: ['cash', 'mobile', 'bank'],
    links: { Business: 'belongs to' },
  },
  Profile: {
    label: 'Person',
    description: 'A signed-in user (owner or staff) and their preferences.',
    properties: ['full_name', 'role', 'lang', 'theme', 'country_code'],
    links: { Business: 'owns / works in' },
  },
  StaffMember: {
    label: 'Staff member',
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
  | 'ledger.recordLines'
  | 'business.create'
  | 'business.update'
  | 'staff.add'
  | 'staff.remove';

export interface ActionTypeDef {
  label: string;
  objectType: ObjectTypeName;
}

export const ACTION_TYPES: Record<ActionTypeName, ActionTypeDef> = {
  'stock.add': { label: 'Add stock', objectType: 'Product' },
  'stock.updatePrice': { label: 'Change price', objectType: 'Product' },
  'stock.reorder': { label: 'Reorder products', objectType: 'Product' },
  'stock.addProduct': { label: 'Add product', objectType: 'Product' },
  'stock.updateProduct': { label: 'Update product', objectType: 'Product' },
  'stock.bulkImport': { label: 'Bulk import products', objectType: 'Product' },
  'session.submit': { label: 'Submit closing', objectType: 'StockSession' },
  'session.approve': { label: 'Approve closing', objectType: 'StockSession' },
  'session.return': { label: 'Return closing for correction', objectType: 'StockSession' },
  'ledger.recordLines': { label: 'Record money entry', objectType: 'LedgerEntry' },
  'business.create': { label: 'Create business', objectType: 'Business' },
  'business.update': { label: 'Update business profile', objectType: 'Business' },
  'staff.add': { label: 'Add staff member', objectType: 'StaffMember' },
  'staff.remove': { label: 'Remove staff member', objectType: 'StaffMember' },
};
