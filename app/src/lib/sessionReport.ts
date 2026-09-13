// The filled-in counterpart to the blank stock sheet: one closed day, printed
// as a record. Shares printKit with every other Bermi document so the blank
// sheet, this report and the financial report all file together as one set.

import { closingItemsTotal, groupByCategory, soldOf } from './calc';
import { esc, footer, masthead, openPrintable, printButton, printCss } from './printKit';
import type { Business, ClosingItemKind, Lang, Product, StockSession } from './types';
import { countryByCode } from './countries';

const T = {
  en: {
    title: 'Daily closing report', item: 'Item', opening: 'Opening', added: 'Added', total: 'Total',
    closing: 'Closing', sold: 'Sold', price: 'Price', amount: 'Sales', profit: 'Profit',
    subtotal: 'Subtotal', grand: 'Total', summary: 'Summary', expectedSales: 'Expected sales',
    grossProfit: 'Gross profit', cash: 'Cash', mobile: 'Mobile money', bank: 'Bank', received: 'Received',
    difference: 'Difference',
    deductions: 'Expenses, losses & staff debt', expense: 'Expense', loss: 'Loss / breakage', debt: 'Staff debt',
    reason: 'Reason given', ownerComments: 'Owner comments',
    submittedBy: 'Counted by', approvedBy: 'Verified by', footer: 'Bermi One',
    statusOpen: 'Open', statusSubmitted: 'Awaiting verification', statusApproved: 'Verified & locked',
    statusRejected: 'Sent back',
    matched: 'Everything matches', short: 'Cash short', over: 'More than expected', none: 'None recorded',
    itemsCounted: 'Items counted', unitsSold: 'Units sold', stockCounted: 'Stock counted',
  },
  sw: {
    title: 'Ripoti ya kufunga siku', item: 'Bidhaa', opening: 'Mwanzo', added: 'Imeongezwa', total: 'Jumla',
    closing: 'Zilizobaki', sold: 'Zimeuzwa', price: 'Bei', amount: 'Mauzo', profit: 'Faida',
    subtotal: 'Jumla ndogo', grand: 'Jumla', summary: 'Muhtasari', expectedSales: 'Mauzo yanayotarajiwa',
    grossProfit: 'Faida ghafi', cash: 'Taslimu', mobile: 'Simu', bank: 'Benki', received: 'Zilizopokelewa',
    difference: 'Tofauti',
    deductions: 'Matumizi, hasara na madeni', expense: 'Matumizi', loss: 'Hasara', debt: 'Deni la mfanyakazi',
    reason: 'Sababu', ownerComments: 'Maoni ya mmiliki',
    submittedBy: 'Amehesabu', approvedBy: 'Amethibitisha', footer: 'Bermi One',
    statusOpen: 'Wazi', statusSubmitted: 'Inasubiri uthibitisho', statusApproved: 'Imethibitishwa',
    statusRejected: 'Imerudishwa',
    matched: 'Kila kitu kinalingana', short: 'Fedha pungufu', over: 'Zaidi ya ilivyotarajiwa', none: 'Hakuna',
    itemsCounted: 'Bidhaa zilizohesabiwa', unitsSold: 'Vipande vilivyouzwa', stockCounted: 'Bidhaa zilizohesabiwa',
  },
} as const;

export interface SessionReportOptions {
  business: Business;
  products: Product[];
  session: StockSession;
  lang: Lang;
  /** Profit per unit is the owner's figure. Staff print the same sheet without it. */
  includeProfit?: boolean;
}

export function buildSessionReportHtml(opts: SessionReportOptions): string {
  const { business, products, session, lang } = opts;
  const withProfit = opts.includeProfit !== false;
  const L = T[lang];
  const sym = countryByCode(business.country_code || 'TZ').sym;
  const money = (n: number) => sym + ' ' + Math.round(n).toLocaleString('en-US');
  const money0 = (n: number) => (Math.round(n) ? money(n) : '—');
  const num0 = (n: number) => (n ? String(n) : '—');
  const counts = session.counts || {};

  // Only lines that were actually counted belong on the record.
  const counted = products.filter((p) => counts[p.id] !== undefined);
  const groups = groupByCategory(counted);

  const expected = counted.reduce((s, p) => s + soldOf(p, counts) * p.price, 0);
  const gross = counted.reduce((s, p) => s + soldOf(p, counts) * p.profit, 0);
  const unitsSold = counted.reduce((s, p) => s + soldOf(p, counts), 0);
  const deductions = closingItemsTotal(session);
  const received = Number(session.cash || 0) + Number(session.mobile || 0) + Number(session.bank_in || 0) + deductions;
  const diff = expected - received;

  const status = {
    verified: { text: L.statusApproved, tone: 'ok' as const },
    submitted: { text: L.statusSubmitted, tone: 'warn' as const },
    rejected: { text: L.statusRejected, tone: 'bad' as const },
    open: { text: L.statusOpen, tone: 'plain' as const },
  }[session.status];

  const cols = withProfit ? 9 : 8;
  const profitHead = withProfit ? `<th class="n">${L.profit}</th>` : '';

  const body = groups
    .map((g) => {
      let catSales = 0;
      let catProfit = 0;
      const rows = g.items
        .map((p) => {
          const closing = Number(counts[p.id]);
          const avail = p.opening + p.added;
          const sold = soldOf(p, counts);
          const sales = sold * p.price;
          const prof = sold * p.profit;
          catSales += sales;
          catProfit += prof;
          return `<tr>
            <td class="b">${esc(p.name)} <span class="muted" style="font-weight:400">${esc(p.unit)}</span></td>
            <td class="n">${num0(p.opening)}</td>
            <td class="n">${num0(p.added)}</td>
            <td class="n">${num0(avail)}</td>
            <td class="n">${num0(closing)}</td>
            <td class="n b">${num0(sold)}</td>
            <td class="n">${money(p.price)}</td>
            <td class="n b">${money0(sales)}</td>
            ${withProfit ? `<td class="n ok">${money0(prof)}</td>` : ''}
          </tr>`;
        })
        .join('');
      return `<tr class="group"><td colspan="${cols}">${esc(g.cat)}</td></tr>
        ${rows}
        <tr class="sub"><td colspan="7" class="n">${L.subtotal} — ${esc(g.cat)}</td><td class="n">${money0(catSales)}</td>${withProfit ? `<td class="n">${money0(catProfit)}</td>` : ''}</tr>`;
    })
    .join('');

  const kindLabel: Record<ClosingItemKind, string> = { expense: L.expense, loss: L.loss, debt: L.debt };
  const items = session.closing_items || [];
  const deductionRows = items.length
    ? items.map((i) => `<tr><td class="b">${kindLabel[i.kind]}</td><td class="muted">${esc(i.note || '—')}</td><td class="n b">${money(i.amount)}</td></tr>`).join('')
    : `<tr><td colspan="3" class="muted">${L.none}</td></tr>`;

  const kpis: [string, string, string?][] = [
    [L.expectedSales, money0(expected)],
    ...(withProfit ? ([[L.grossProfit, money0(gross), 'ok']] as [string, string, string?][]) : []),
    [L.received, money0(received)],
    [L.difference, diff === 0 ? L.matched : `${money(Math.abs(diff))} · ${diff > 0 ? L.short : L.over}`, diff === 0 ? 'ok' : 'bad'],
  ];

  const rail: [string, string, string?][] = [
    [L.cash, money0(session.cash || 0)],
    [L.mobile, money0(session.mobile || 0)],
    [L.bank, money0(session.bank_in || 0)],
    [L.deductions, money0(deductions)],
    [L.itemsCounted, num0(counted.length)],
    [L.unitsSold, num0(unitsSold)],
  ];

  const dateStr = new Date(session.session_date).toLocaleDateString(lang === 'sw' ? 'sw-TZ' : 'en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<title>${esc(business.name)} — ${L.title} ${session.session_date}</title>
<style>${printCss('portrait')}
  .kpis { grid-template-columns: repeat(${kpis.length}, 1fr); margin-top: 9px; }
</style>
</head>
<body>
  ${printButton()}
  ${masthead({
    business: business.name,
    meta: [business.city, dateStr].filter(Boolean).join(' · '),
    kind: L.title,
    badge: status,
  })}

  <div class="kpis">
    ${kpis.map(([k, v, c]) => `<div class="kpi"><div class="k">${k}</div><div class="v${c ? ' ' + c : ''}">${v}</div></div>`).join('')}
  </div>

  <h2>${L.stockCounted}</h2>
  <table>
    <thead>
      <tr>
        <th>${L.item}</th><th class="n">${L.opening}</th><th class="n">${L.added}</th><th class="n">${L.total}</th>
        <th class="n">${L.closing}</th><th class="n">${L.sold}</th><th class="n">${L.price}</th><th class="n">${L.amount}</th>${profitHead}
      </tr>
    </thead>
    <tbody>
      ${body}
      <tr class="tot"><td colspan="7" class="n">${L.grand}</td><td class="n">${money0(expected)}</td>${withProfit ? `<td class="n">${money0(gross)}</td>` : ''}</tr>
    </tbody>
  </table>

  <div class="cols" style="margin-top:15px">
    <div>
      <h2 style="margin-top:0">${L.summary}</h2>
      <div class="rail">
        ${rail.map(([k, v]) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
      </div>
    </div>
    <div>
      <h2 style="margin-top:0">${L.deductions}</h2>
      <table>${deductionRows}</table>
    </div>
  </div>

  ${session.reason ? `<div class="note"><b>${L.reason}:</b> ${esc(session.reason)}${session.note ? ` — ${esc(session.note)}` : ''}</div>` : ''}
  ${session.owner_comments ? `<div class="note"><b>${L.ownerComments}:</b> ${esc(session.owner_comments)}</div>` : ''}

  <div class="sign">
    <div>${L.submittedBy} — ${esc(session.submitted_by_name || '')}<div class="line"></div></div>
    <div>${L.approvedBy} — ${esc(session.approved_by_name || '')}<div class="line"></div></div>
  </div>

  ${footer(business.name, session.session_date, lang, L.footer)}
</body>
</html>`;
}

export function openSessionReport(opts: SessionReportOptions): boolean {
  return openPrintable(buildSessionReportHtml(opts));
}
