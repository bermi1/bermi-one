// The two things an owner does with a report: print it, or send the gist to
// someone on WhatsApp. Both read the same aggregated ReportData.

import { countryByCode } from './countries';
import { esc, footer, masthead, openPrintable, printButton, printCss } from './printKit';
import { highlightsOf, type ReportData } from './reporting';
import type { Lang } from './types';

const T = {
  en: {
    title: 'Financial report', period: 'Period', summary: 'Executive summary',
    sales: 'Total sales', profit: 'Total profit', cashMobile: 'Cash & mobile', sessionExp: 'Session expenses',
    purchases: 'Purchases', otherExp: 'Other expenses', staffDebts: 'Staff debts', losses: 'Losses',
    banked: 'Amount banked', balance: 'Balance difference',
    daily: 'Daily breakdown', date: 'Date', cash: 'Cash', mobile: 'Mobile', sExp: 'S.Exp', sPur: 'S.Purch',
    oExp: 'O.Exp', sDebt: 'S.Debt', total: 'TOTAL',
    lossesTable: 'Losses & damages', topExpenses: 'Top expenses', description: 'Description', amount: 'Amount',
    highlights: 'Key highlights', bestDay: 'Best sales day', avgProfit: 'Avg daily profit', margin: 'Profit margin',
    footer: 'Bermi One', noData: 'No verified closings in this period.', day: 'day', days: 'days',
  },
  sw: {
    title: 'Ripoti ya fedha', period: 'Kipindi', summary: 'Muhtasari',
    sales: 'Jumla ya mauzo', profit: 'Jumla ya faida', cashMobile: 'Taslimu na simu', sessionExp: 'Matumizi ya siku',
    purchases: 'Manunuzi', otherExp: 'Matumizi mengine', staffDebts: 'Madeni ya wafanyakazi', losses: 'Hasara',
    banked: 'Zilizopelekwa benki', balance: 'Tofauti',
    daily: 'Uchambuzi wa kila siku', date: 'Tarehe', cash: 'Taslimu', mobile: 'Simu', sExp: 'Mat.', sPur: 'Man.',
    oExp: 'Meng.', sDebt: 'Deni', total: 'JUMLA',
    lossesTable: 'Hasara na uharibifu', topExpenses: 'Matumizi makubwa', description: 'Maelezo', amount: 'Kiasi',
    highlights: 'Mambo muhimu', bestDay: 'Siku bora ya mauzo', avgProfit: 'Wastani wa faida', margin: 'Kiwango cha faida',
    footer: 'Bermi One', noData: 'Hakuna kufunga kulikothibitishwa kipindi hiki.', day: 'siku', days: 'siku',
  },
} as const;

export function buildComprehensiveReportHtml(data: ReportData, lang: Lang): string {
  const L = T[lang];
  const sym = countryByCode(data.businesses[0]?.country_code || 'TZ').sym;
  const money = (n: number) => sym + ' ' + Math.round(n).toLocaleString('en-US');
  // Nothing recorded reads as a dash, not as a hard zero.
  const money0 = (n: number) => (Math.round(n) ? money(n) : '—');
  const names = data.businesses.map((b) => b.name).join(', ');
  const { totals, days } = data;
  const showDebts = totals.staffDebts > 0;
  const showBalance = Math.round(totals.balance) !== 0;

  const summaryCells: [string, string, string?][] = [
    [L.sales, money0(totals.sales)],
    [L.profit, money0(totals.profit), 'ok'],
    [L.cashMobile, money0(totals.cash + totals.mobile)],
    [L.sessionExp, money0(totals.sessionExpenses)],
    [L.purchases, money0(totals.sessionPurchases)],
    [L.otherExp, money0(totals.otherExpenses)],
    ...(showDebts ? ([[L.staffDebts, money0(totals.staffDebts), 'warn']] as [string, string, string?][]) : []),
    [L.losses, money0(totals.losses), totals.losses > 0 ? 'bad' : undefined],
    [L.banked, money0(totals.banked), 'brand'],
    ...(showBalance ? ([[L.balance, money0(totals.balance), 'bad']] as [string, string, string?][]) : []),
  ];

  const dayRows = days
    .map((d) => `<tr>
      <td>${d.date}</td>
      <td class="n b">${money0(d.sales)}</td>
      <td class="n ok">${money0(d.profit)}</td>
      <td class="n">${money0(d.cash)}</td>
      <td class="n">${money0(d.mobile)}</td>
      <td class="n">${money0(d.sessionExpenses)}</td>
      <td class="n">${money0(d.sessionPurchases)}</td>
      <td class="n">${money0(d.otherExpenses)}</td>
      ${showDebts ? `<td class="n">${money0(d.staffDebts)}</td>` : ''}
      <td class="n">${money0(d.losses)}</td>
      <td class="n brand">${money0(d.banked)}</td>
      ${showBalance ? `<td class="n ${Math.round(d.balance) === 0 ? 'ok' : 'bad'}">${money0(d.balance)}</td>` : ''}
    </tr>`)
    .join('');

  const totalRow = `<tr class="tot">
    <td class="b">${L.total}</td>
    <td class="n">${money0(totals.sales)}</td>
    <td class="n">${money0(totals.profit)}</td>
    <td class="n">${money0(totals.cash)}</td>
    <td class="n">${money0(totals.mobile)}</td>
    <td class="n">${money0(totals.sessionExpenses)}</td>
    <td class="n">${money0(totals.sessionPurchases)}</td>
    <td class="n">${money0(totals.otherExpenses)}</td>
    ${showDebts ? `<td class="n">${money0(totals.staffDebts)}</td>` : ''}
    <td class="n">${money0(totals.losses)}</td>
    <td class="n">${money0(totals.banked)}</td>
    ${showBalance ? `<td class="n">${money0(totals.balance)}</td>` : ''}
  </tr>`;

  const breakdownTable = (title: string, rows: { label: string; amount: number }[]) =>
    rows.length
      ? `<h2>${title}</h2>
        <table>
          <thead><tr><th>${L.description}</th><th class="n">${L.amount}</th></tr></thead>
          <tbody>${rows.map((r) => `<tr><td>${esc(r.label)}</td><td class="n b">${money0(r.amount)}</td></tr>`).join('')}</tbody>
        </table>`
      : '';

  const h = highlightsOf(data);

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<title>${esc(names)} — ${L.title}</title>
<style>${printCss('landscape')}
  .kpis { grid-template-columns: repeat(5, 1fr); }
</style>
</head>
<body>
  ${printButton()}
  ${masthead({
    business: names,
    meta: `${L.period}: ${data.from} → ${data.to}`,
    kind: L.title,
    badge: { text: `${days.length} ${days.length === 1 ? L.day : L.days}`, tone: 'plain' },
  })}

  ${days.length === 0 ? `<div class="note" style="margin-top:16px">${L.noData}</div>` : `
  <h2>${L.summary}</h2>
  <div class="kpis">
    ${summaryCells.map(([k, v, c]) => `<div class="kpi"><div class="k">${k}</div><div class="v${c ? ' ' + c : ''}">${v}</div></div>`).join('')}
  </div>

  <h2>${L.highlights}</h2>
  <div class="chips">
    <div>${L.bestDay} <b>${h.bestDay ? `${h.bestDay.date} — ${money(h.bestDay.sales)}` : '—'}</b></div>
    <div>${L.avgProfit} <b>${money(h.avgDailyProfit)}</b></div>
    <div>${L.margin} <b>${h.profitMargin}%</b></div>
  </div>

  <h2>${L.daily}</h2>
  <table>
    <thead>
      <tr>
        <th>${L.date}</th><th class="n">${L.sales}</th><th class="n">${L.profit}</th><th class="n">${L.cash}</th><th class="n">${L.mobile}</th>
        <th class="n">${L.sExp}</th><th class="n">${L.sPur}</th><th class="n">${L.oExp}</th>${showDebts ? `<th class="n">${L.sDebt}</th>` : ''}
        <th class="n">${L.losses}</th><th class="n">${L.banked}</th>${showBalance ? `<th class="n">${L.balance}</th>` : ''}
      </tr>
    </thead>
    <tbody>${dayRows}${totalRow}</tbody>
  </table>

  <div class="cols" style="margin-top:4px">
    <div>${breakdownTable(L.lossesTable, data.lossBreakdown)}</div>
    <div>${breakdownTable(L.topExpenses, data.expenseBreakdown.slice(0, 10))}</div>
  </div>
  `}

  ${footer(names, `${data.from} → ${data.to}`, lang, L.footer)}
</body>
</html>`;
}

export function openComprehensiveReport(data: ReportData, lang: Lang): boolean {
  return openPrintable(buildComprehensiveReportHtml(data, lang));
}

/** WhatsApp-flavoured plain text — *bold* markers, no HTML. */
export function buildWhatsappSummary(data: ReportData, lang: Lang, money: (n: number) => string): string {
  const L = T[lang];
  const { totals } = data;
  const h = highlightsOf(data);
  const names = data.businesses.map((b) => b.name).join(', ');
  const out: string[] = [];

  out.push(`*${names}*`);
  out.push(`${L.period}: ${data.from} → ${data.to}`);
  out.push('');
  out.push(`*${L.summary}*`);
  out.push(`${L.sales}: ${money(totals.sales)}`);
  out.push(`${L.profit}: ${money(totals.profit)}`);
  out.push(`${L.cash}: ${money(totals.cash)}`);
  out.push(`${L.mobile}: ${money(totals.mobile)}`);
  out.push(`${L.sessionExp}: ${money(totals.sessionExpenses)}`);
  out.push(`${L.purchases}: ${money(totals.sessionPurchases)}`);
  out.push(`${L.otherExp}: ${money(totals.otherExpenses)}`);
  if (totals.staffDebts > 0) out.push(`${L.staffDebts}: ${money(totals.staffDebts)}`);
  out.push(`${L.losses}: ${money(totals.losses)}`);
  out.push(`${L.banked}: ${money(totals.banked)}`);
  if (Math.round(totals.balance) !== 0) out.push(`${L.balance}: ${money(totals.balance)}`);

  out.push('');
  out.push(`*${L.highlights}*`);
  out.push(`${L.bestDay}: ${h.bestDay ? `${h.bestDay.date} — ${money(h.bestDay.sales)}` : '—'}`);
  out.push(`${L.avgProfit}: ${money(h.avgDailyProfit)}`);
  out.push(`${L.margin}: ${h.profitMargin}%`);

  if (data.lossBreakdown.length) {
    out.push('');
    out.push(`*${L.lossesTable}*`);
    for (const r of data.lossBreakdown.slice(0, 3)) out.push(`• ${r.label}: ${money(r.amount)}`);
  }
  if (data.expenseBreakdown.length) {
    out.push('');
    out.push(`*${L.topExpenses}*`);
    for (const r of data.expenseBreakdown.slice(0, 3)) out.push(`• ${r.label}: ${money(r.amount)}`);
  }

  out.push('');
  out.push(`_${L.footer}_`);
  return out.join('\n');
}

export function openWhatsapp(text: string, phone?: string): void {
  const target = phone?.replace(/[^0-9]/g, '');
  const base = target ? `https://wa.me/${target}` : 'https://wa.me/';
  window.open(`${base}?text=${encodeURIComponent(text)}`, '_blank');
}
