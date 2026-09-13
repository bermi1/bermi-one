// The paper stock sheet: a print-ready A4 page a bar prints at the start of a
// shift and fills in by hand at closing. Only the item name and its price are
// printed — every counting column is deliberately left blank so the person
// closing writes the real numbers in, then keys them into Bermi afterwards.

import { businessDayIso, groupByCategory } from './calc';
import { esc, footer, masthead, openPrintable, printButton, printCss } from './printKit';
import type { Business, Lang, Product } from './types';
import { countryByCode } from './countries';

interface SheetLabels {
  title: string;
  counter: string;
  date: string;
  shift: string;
  item: string;
  opening: string;
  added: string;
  total: string;
  sold: string;
  remain: string;
  price: string;
  amount: string;
  categoryTotal: string;
  grandTotal: string;
  totalSold: string;
  expenses: string;
  cash: string;
  mobile: string;
  bank: string;
  debt: string;
  countedBy: string;
  checkedBy: string;
  footer: string;
  blank: string;
}

const LABELS: Record<Lang, SheetLabels> = {
  en: {
    title: 'Daily stock sheet',
    counter: 'Counter',
    date: 'Date',
    shift: 'Shift',
    item: 'Item',
    opening: 'Opening',
    added: 'Added',
    total: 'Total stock',
    sold: 'Sold',
    remain: 'Remain',
    price: 'Price',
    amount: 'Amount sold',
    categoryTotal: 'Subtotal',
    grandTotal: 'Total',
    totalSold: 'Total sales',
    expenses: 'Expenses paid out',
    cash: 'Cash received',
    mobile: 'Mobile money received',
    bank: 'Bank / deposit',
    debt: 'Staff debt',
    countedBy: 'Counted by',
    checkedBy: 'Checked by',
    footer: 'Bermi One',
    blank: 'Blank — fill in by hand',
  },
  sw: {
    title: 'KARATASI YA BIDHAA YA SIKU',
    counter: 'Kaunta',
    date: 'Tarehe',
    shift: 'Zamu',
    item: 'Bidhaa',
    opening: 'Mwanzo',
    added: 'Imeongezwa',
    total: 'Jumla ya bidhaa',
    sold: 'Zimeuzwa',
    remain: 'Zilizobaki',
    price: 'Bei',
    amount: 'Kiasi cha mauzo',
    categoryTotal: 'Jumla ndogo',
    grandTotal: 'JUMLA',
    totalSold: 'Jumla ya mauzo',
    expenses: 'Matumizi yaliyolipwa',
    cash: 'Taslimu iliyopokelewa',
    mobile: 'Simu iliyopokelewa',
    bank: 'Benki / amana',
    debt: 'Deni la mfanyakazi',
    countedBy: 'Amehesabu',
    checkedBy: 'Amekagua',
    footer: 'Bermi One',
    blank: 'Tupu — jaza kwa mkono',
  },
};

function money(n: number, sym: string): string {
  return sym + ' ' + Math.round(n).toLocaleString('en-US');
}

export function buildStockSheetHtml(opts: {
  business: Business;
  products: Product[];
  lang: Lang;
  counterName?: string;
}): string {
  const { business, products, lang, counterName = '' } = opts;
  const T = LABELS[lang];
  const sym = countryByCode(business.country_code || 'TZ').sym;
  const groups = groupByCategory(products);
  // The sheet is filled in when a night is counted, and that count settles the
  // previous day's trade — so the sheet carries that date, not today's.
  const dateStr = new Date(businessDayIso()).toLocaleDateString(lang === 'sw' ? 'sw-TZ' : 'en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  const blank = '<td class="fill"></td>';

  const body = groups
    .map((g) => {
      const rows = g.items
        .map(
          (p) => `<tr>
        <td class="b">${esc(p.name)} <span class="muted" style="font-weight:400">${esc(p.unit)}</span></td>
        ${blank}${blank}${blank}${blank}${blank}
        <td class="n">${money(p.price, sym)}</td>
        ${blank}
      </tr>`,
        )
        .join('');
      return `<tr class="group"><td colspan="8">${esc(g.cat)} · ${g.items.length}</td></tr>
      ${rows}
      <tr class="sub"><td colspan="7" class="n">${T.categoryTotal} — ${esc(g.cat)}</td><td class="fill"></td></tr>`;
    })
    .join('');

  const summaryRows = [T.totalSold, T.expenses, T.cash, T.mobile, T.bank, T.debt]
    .map((label) => `<tr><th>${label}</th><td class="fill"></td></tr>`)
    .join('');

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<title>${esc(business.name)} — ${T.title}</title>
<style>${printCss('portrait')}
  thead th.n { text-align: center; }
  .meta { display: flex; gap: 14px; margin: 11px 0; }
  .meta > div { flex: 1; font-size: 8.6px; color: var(--ink3); text-transform: uppercase;
                letter-spacing: 0.6px; font-weight: 700; }
  .meta .line { border-bottom: 1px solid var(--ink3); height: 19px; margin-top: 3px; }
  .totals { margin-top: 13px; width: 62%; }
  .totals th { width: 58%; }
  .totals td { height: 20px; background: #fff; }
</style>
</head>
<body>
  ${printButton()}
  ${masthead({
    business: business.name,
    meta: [business.city, dateStr].filter(Boolean).join(' · '),
    kind: T.title,
    badge: { text: T.blank, tone: 'plain' },
  })}

  <div class="meta">
    <div>${T.counter}${counterName ? ` — ${esc(counterName)}` : ''}<div class="line"></div></div>
    <div>${T.date}<div class="line"></div></div>
    <div>${T.shift}<div class="line"></div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>${T.item}</th>
        <th class="n">${T.opening}</th>
        <th class="n">${T.added}</th>
        <th class="n">${T.total}</th>
        <th class="n">${T.sold}</th>
        <th class="n">${T.remain}</th>
        <th class="n">${T.price}</th>
        <th class="n">${T.amount}</th>
      </tr>
    </thead>
    <tbody>
      ${body}
      <tr class="tot"><td colspan="7" class="n">${T.grandTotal}</td><td class="fill"></td></tr>
    </tbody>
  </table>

  <table class="totals">
    ${summaryRows}
  </table>

  <div class="sign">
    <div>${T.countedBy}<div class="line"></div></div>
    <div>${T.checkedBy}<div class="line"></div></div>
  </div>

  ${footer(business.name, dateStr, lang, T.footer)}
</body>
</html>`;
}

/** Opens the sheet in a new tab so the user can print it or save it as a PDF. */
export function openStockSheet(opts: Parameters<typeof buildStockSheetHtml>[0]): boolean {
  return openPrintable(buildStockSheetHtml(opts));
}
