// Flexible CSV/TSV import for bulk stock. This does NOT assume a fixed
// column order or exact header names — it sniffs the delimiter, tries hard
// to guess which column is which from the header text (or, failing that,
// from the shape of the data itself), and hands the caller a best-guess
// column mapping the user can see and correct before anything is imported.
// That correction step is the "fix it" half: auto-detect, then let a human
// confirm — never silently import a wrong guess.

export type FieldKey = 'name' | 'cat' | 'unit' | 'cost' | 'price' | 'opening' | 'low' | 'ignore';

export const FIELD_LABELS: Record<FieldKey, string> = {
  name: 'Product name',
  cat: 'Category',
  unit: 'Unit',
  cost: 'Cost price',
  price: 'Selling price',
  opening: 'Opening quantity',
  low: 'Low stock level',
  ignore: 'Ignore this column',
};

export interface ParsedProductRow {
  name: string;
  cat: string;
  unit: string;
  cost: number;
  price: number;
  opening: number;
  low: number;
}

export interface ParsedTable {
  headerCells: string[] | null; // null if no header row was detected
  rows: string[][]; // data rows only
  columnMap: FieldKey[]; // one guess per column index, editable by the caller
}

const DELIMITERS = [',', ';', '\t', '|'];

function splitLine(line: string, delim: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 12);
  let best = ',';
  let bestScore = -1;
  for (const delim of DELIMITERS) {
    const counts = sample.map((l) => splitLine(l, delim).length);
    if (counts.every((c) => c <= 1)) continue;
    const counted = new Map<number, number>();
    for (const c of counts) counted.set(c, (counted.get(c) || 0) + 1);
    let modeCount = 0;
    let modeFreq = 0;
    for (const [c, freq] of counted) {
      if (c > 1 && freq > modeFreq) {
        modeCount = c;
        modeFreq = freq;
      }
    }
    const score = modeCount * modeFreq;
    if (score > bestScore) {
      bestScore = score;
      best = delim;
    }
  }
  return best;
}

// Ordered so more specific phrases are checked before generic ones
// (e.g. "cost price" before a bare "price").
const FIELD_KEYWORDS: [FieldKey, RegExp][] = [
  ['name', /\b(product|item|description|desc|goods|stock\s*name)\b/i],
  ['cost', /\b(cost|buy(ing)?|purchase|wholesale)\s*price\b|\bcost\b|\bbuying\b|\bunit\s*cost\b/i],
  ['price', /\b(sell(ing)?|retail|sale)\s*price\b|\bprice\b|\bsrp\b/i],
  ['opening', /\b(opening|current|available|in\s*stock|on\s*hand|qty|quantity|stock\s*level|balance)\b/i],
  ['low', /\b(low|reorder|min(imum)?|re-?order)\s*(level|point|qty|quantity)?\b/i],
  ['unit', /\b(unit|uom|measure|pack(aging)?)\b/i],
  ['cat', /\b(cat(egory)?|type|group|dept|department)\b/i],
  ['name', /\bname\b/i],
];

function guessFieldFromHeader(cell: string): FieldKey | null {
  const c = cell.trim();
  if (!c) return null;
  for (const [field, re] of FIELD_KEYWORDS) {
    if (re.test(c)) return field;
  }
  return null;
}

function isNumericCell(v: string): boolean {
  if (!v) return false;
  const cleaned = v.replace(/[^0-9.-]/g, '');
  return cleaned.length > 0 && !Number.isNaN(Number(cleaned)) && /\d/.test(v);
}

/** When there's no usable header row, guess columns from the shape of the data itself. */
function inferColumnsFromContent(rows: string[][], columnCount: number): FieldKey[] {
  const map: FieldKey[] = new Array(columnCount).fill('ignore');
  const numericScore: number[] = new Array(columnCount).fill(0);
  const sample = rows.slice(0, 15);

  for (let ci = 0; ci < columnCount; ci++) {
    let numeric = 0;
    let total = 0;
    for (const row of sample) {
      const v = row[ci];
      if (v === undefined || v === '') continue;
      total++;
      if (isNumericCell(v)) numeric++;
    }
    numericScore[ci] = total > 0 ? numeric / total : 0;
  }

  // The first mostly-non-numeric column is the product name.
  const nameCol = numericScore.findIndex((s) => s < 0.5);
  if (nameCol >= 0) map[nameCol] = 'name';

  // Remaining numeric-heavy columns, in order: price, cost, opening, low.
  const numericOrder: FieldKey[] = ['price', 'cost', 'opening', 'low'];
  let n = 0;
  for (let ci = 0; ci < columnCount; ci++) {
    if (ci === nameCol) continue;
    if (numericScore[ci] >= 0.5 && n < numericOrder.length) {
      map[ci] = numericOrder[n];
      n++;
    }
  }
  return map;
}

export function parseTable(text: string): ParsedTable {
  const stripped = text.replace(/^﻿/, ''); // strip a BOM from Excel exports
  const lines = stripped.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headerCells: null, rows: [], columnMap: [] };

  const delim = detectDelimiter(lines);
  const allRows = lines.map((l) => splitLine(l, delim));
  const columnCount = Math.max(...allRows.map((r) => r.length));

  const firstRowGuesses = allRows[0].map(guessFieldFromHeader);
  const distinctFieldsInFirstRow = new Set(firstRowGuesses.filter((g): g is FieldKey => g !== null));
  const looksLikeHeader = distinctFieldsInFirstRow.size >= 2;

  if (looksLikeHeader) {
    const claimed = new Set<FieldKey>();
    const columnMap: FieldKey[] = firstRowGuesses.map((g) => {
      if (g && g !== 'ignore' && !claimed.has(g)) {
        claimed.add(g);
        return g;
      }
      return 'ignore';
    });
    return { headerCells: allRows[0], rows: allRows.slice(1), columnMap };
  }

  return { headerCells: null, rows: allRows, columnMap: inferColumnsFromContent(allRows, columnCount) };
}

function cleanNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function buildRows(rows: string[][], columnMap: FieldKey[]): { rows: ParsedProductRow[]; errors: string[] } {
  const out: ParsedProductRow[] = [];
  const errors: string[] = [];
  const nameCol = columnMap.indexOf('name');

  rows.forEach((cells, i) => {
    if (cells.every((c) => !c || !c.trim())) return; // skip blank rows
    const name = nameCol >= 0 ? (cells[nameCol] || '').trim() : '';
    if (!name) {
      errors.push(`Row ${i + 1}: missing a product name — skipped.`);
      return;
    }
    const get = (field: FieldKey) => {
      const ci = columnMap.indexOf(field);
      return ci >= 0 ? cells[ci] : undefined;
    };
    out.push({
      name,
      cat: (get('cat') || '').trim() || 'General',
      unit: (get('unit') || '').trim() || 'unit',
      cost: cleanNumber(get('cost')),
      price: cleanNumber(get('price')),
      opening: cleanNumber(get('opening')),
      low: cleanNumber(get('low')),
    });
  });

  return { rows: out, errors };
}
