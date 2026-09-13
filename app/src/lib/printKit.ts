// Shared print styling for everything Bermi puts on paper. One visual
// language across the blank stock sheet, the daily closing report and the
// financial report: a dark title band, hairline tables with tinted headers,
// tabular figures, and a Bermi footer.
//
// Print quirk worth knowing: browsers strip background colours when printing
// unless print-color-adjust is forced, which would flatten every tinted row
// into white. Hence the exact/-webkit rules below.

import type { Lang } from './types';

export const SLOGAN: Record<Lang, string> = {
  en: 'Your business. One system.',
  sw: 'Biashara yako. Mfumo mmoja.',
};

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function printCss(orientation: 'portrait' | 'landscape' = 'portrait'): string {
  return `
  @page { size: A4 ${orientation}; margin: 11mm 10mm 14mm; }
  *, *::before, *::after { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }

  :root {
    --ink: #14161c;
    --ink2: #4a4f5c;
    --ink3: #878d9c;
    --line: #dfe2ea;
    --line2: #eef0f5;
    --tint: #f6f7fa;
    --brand: #4b3fd6;
    --ok: #067a4b;
    --bad: #c0322b;
    --warn: #9a6a06;
  }

  body {
    font-family: "Inter", "Helvetica Neue", Arial, sans-serif;
    color: var(--ink);
    margin: 0;
    font-size: 9.6px;
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
  }

  /* --- masthead --- */
  .mast { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px;
          background: var(--ink); color: #fff; border-radius: 8px; padding: 13px 16px; margin-bottom: 4px; }
  .mast .biz { font-size: 17px; font-weight: 800; letter-spacing: -0.35px; line-height: 1.1; }
  .mast .meta { font-size: 9.5px; color: rgba(255,255,255,.66); margin-top: 3px; font-weight: 500; }
  .mast .right { text-align: right; flex-shrink: 0; }
  .mast .kind { font-size: 10px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; color: rgba(255,255,255,.9); }
  .badge { display: inline-block; margin-top: 6px; font-size: 8.5px; font-weight: 800; letter-spacing: 0.8px;
           text-transform: uppercase; padding: 3px 8px; border-radius: 99px; background: rgba(255,255,255,.14); color: #fff; }
  .badge.ok { background: #067a4b; }
  .badge.warn { background: #9a6a06; }
  .badge.bad { background: #c0322b; }

  h2 { font-size: 8.8px; text-transform: uppercase; letter-spacing: 1px; margin: 15px 0 6px;
       color: var(--ink3); font-weight: 800; }

  /* --- KPI grid --- */
  .kpis { display: grid; gap: 7px; }
  .kpi { border: 1px solid var(--line); border-radius: 7px; padding: 9px 11px; background: #fff; }
  .kpi .k { font-size: 7.8px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--ink3); font-weight: 700; }
  .kpi .v { font-size: 13.5px; font-weight: 800; margin-top: 4px; letter-spacing: -0.3px;
            font-variant-numeric: tabular-nums; }

  /* --- tables --- */
  table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--line);
          border-radius: 7px; overflow: hidden; }
  th, td { padding: 5px 8px; text-align: left; border-bottom: 1px solid var(--line2); }
  thead th { background: var(--tint); font-size: 7.8px; text-transform: uppercase; letter-spacing: 0.6px;
             color: var(--ink3); font-weight: 800; border-bottom: 1px solid var(--line); }
  th.n, td.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tbody tr:last-child td { border-bottom: none; }
  td.b { font-weight: 700; }
  td.muted { color: var(--ink3); }
  .ok { color: var(--ok); }
  .bad { color: var(--bad); }
  .warn { color: var(--warn); }
  .brand { color: var(--brand); }
  /* The badge shares the ok/warn/bad names but paints them as its background,
     so its own white text has to win over the semantic colour rules above. */
  .badge, .badge.ok, .badge.warn, .badge.bad { color: #fff; }

  tr.group td { background: #eceef4; font-weight: 800; font-size: 8.2px; letter-spacing: 0.9px;
                text-transform: uppercase; color: var(--ink2); padding: 5px 8px; }
  tr.sub td { background: #fbfbfd; font-size: 8.4px; font-weight: 700; color: var(--ink2); }
  tr.tot td { background: var(--ink); color: #fff; font-weight: 800; font-size: 9.6px; }
  tr.tot td.n { color: #fff; }

  /* blank cells the counter fills in by hand — including on the dark total
     row, where a dark box would leave nowhere to write the grand total. */
  td.fill { background: #fff; height: 19px; }
  tr.tot td.fill { background: #fff; }

  .cols { display: flex; gap: 13px; align-items: flex-start; }
  .cols > * { flex: 1; min-width: 0; }

  .rail { border: 1px solid var(--line); border-radius: 7px; overflow: hidden; }
  .rail .row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 11px;
               border-bottom: 1px solid var(--line2); font-size: 9.6px; }
  .rail .row:last-child { border-bottom: none; }
  .rail .row .k { color: var(--ink2); font-weight: 600; }
  .rail .row .v { font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .rail .row.strong { background: var(--tint); }

  .chips { display: flex; gap: 20px; flex-wrap: wrap; font-size: 9.4px; color: var(--ink2); }
  .chips b { color: var(--ink); font-size: 10.5px; }

  .note { margin-top: 9px; border-left: 2.5px solid var(--line); padding: 3px 0 3px 9px;
          color: var(--ink2); font-size: 9.2px; }
  .note b { color: var(--ink); }

  .sign { display: flex; gap: 26px; margin-top: 17px; }
  .sign > div { flex: 1; font-size: 8.6px; color: var(--ink3); text-transform: uppercase;
                letter-spacing: 0.6px; font-weight: 700; }
  .sign .line { border-bottom: 1px solid var(--ink3); height: 25px; }

  .foot { margin-top: 15px; border-top: 1px solid var(--line); padding-top: 7px;
          display: flex; justify-content: space-between; font-size: 8.4px; color: var(--ink3); }
  .foot b { color: var(--ink2); font-weight: 700; }

  tr, .kpi, .rail { page-break-inside: avoid; }

  .bar { margin-bottom: 14px; }
  .bar button { font: inherit; font-size: 12px; font-weight: 700; padding: 9px 18px; border-radius: 8px;
                border: none; background: var(--ink); color: #fff; cursor: pointer; }
  @media print { .bar { display: none; } }
`;
}

export function printButton(label = 'Print / Save as PDF'): string {
  return `<div class="bar"><button onclick="window.print()">${label}</button></div>`;
}

export function masthead(opts: {
  business: string;
  meta: string;
  kind: string;
  badge?: { text: string; tone: 'ok' | 'warn' | 'bad' | 'plain' };
}): string {
  const b = opts.badge;
  return `<div class="mast">
    <div>
      <div class="biz">${esc(opts.business)}</div>
      <div class="meta">${esc(opts.meta)}</div>
    </div>
    <div class="right">
      <div class="kind">${esc(opts.kind)}</div>
      ${b ? `<div class="badge ${b.tone === 'plain' ? '' : b.tone}">${esc(b.text)}</div>` : ''}
    </div>
  </div>`;
}

export function footer(business: string, right: string, lang: Lang, label: string): string {
  return `<div class="foot">
    <span><b>${label}</b> — ${SLOGAN[lang]}</span>
    <span>${esc(business)} · ${esc(right)}</span>
  </div>`;
}

/** Opens a print-ready document in a new tab. Returns false if pop-ups are blocked. */
export function openPrintable(html: string): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
