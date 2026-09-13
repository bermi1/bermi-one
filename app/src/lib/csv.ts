// Minimal CSV parsing for bulk stock import — handles quoted fields with
// embedded commas, but otherwise stays deliberately simple: this is a real
// parser (no "AI reads your file" theater), matched to what an SME owner
// would actually export from a phone spreadsheet app.

function splitCsvLine(line: string): string[] {
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
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

export interface ParsedProductRow {
  name: string;
  cat: string;
  unit: string;
  cost: number;
  price: number;
  opening: number;
  low: number;
}

export interface ParseResult {
  rows: ParsedProductRow[];
  errors: string[];
}

const HEADER_ALIASES: Record<string, keyof ParsedProductRow> = {
  name: 'name', product: 'name', item: 'name',
  category: 'cat', cat: 'cat', type: 'cat',
  unit: 'unit', units: 'unit',
  cost: 'cost', costprice: 'cost', buyprice: 'cost',
  price: 'price', sellprice: 'price', sellingprice: 'price',
  opening: 'opening', qty: 'opening', quantity: 'opening', stock: 'opening',
  low: 'low', reorder: 'low', reorderlevel: 'low', lowstock: 'low',
};

const DEFAULT_ORDER: (keyof ParsedProductRow)[] = ['name', 'cat', 'unit', 'cost', 'price', 'opening', 'low'];

function num(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function parseProductsCsv(text: string): ParseResult {
  const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return { rows: [], errors: ['The file is empty.'] };

  const firstCells = splitCsvLine(lines[0]).map((c) => c.toLowerCase().replace(/[^a-z]/g, ''));
  const looksLikeHeader = firstCells.some((c) => c in HEADER_ALIASES);

  let columnMap: (keyof ParsedProductRow | null)[];
  let dataLines: string[];
  if (looksLikeHeader) {
    columnMap = firstCells.map((c) => HEADER_ALIASES[c] ?? null);
    dataLines = lines.slice(1);
  } else {
    columnMap = DEFAULT_ORDER;
    dataLines = lines;
  }

  const rows: ParsedProductRow[] = [];
  const errors: string[] = [];

  dataLines.forEach((line, i) => {
    const cells = splitCsvLine(line);
    const row: Partial<ParsedProductRow> = {};
    columnMap.forEach((key, ci) => {
      if (!key) return;
      const raw = cells[ci];
      if (key === 'name' || key === 'cat' || key === 'unit') row[key] = (raw || '').trim();
      else row[key] = num(raw);
    });
    if (!row.name) {
      errors.push(`Line ${i + (looksLikeHeader ? 2 : 1)}: missing a product name — skipped.`);
      return;
    }
    rows.push({
      name: row.name,
      cat: row.cat || 'General',
      unit: row.unit || 'unit',
      cost: row.cost ?? 0,
      price: row.price ?? 0,
      opening: row.opening ?? 0,
      low: row.low ?? 0,
    });
  });

  return { rows, errors };
}
