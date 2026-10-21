import { supabase } from './supabase';
import type { StockSession } from './types';

/*
  Closings older than about five months keep their totals in the database but
  their per-product lines in Storage (see supabase/functions/archive-cold), so
  the database stays small. Anything that shows the lines of a closing asks
  for them here first. A closing that was never archived comes back as is.
*/
const cache = new Map<string, Pick<StockSession, 'lines' | 'counts'>>();

export async function withLines(s: StockSession): Promise<StockSession> {
  if (!s.archived_at || !s.archive_path || (s.lines && s.lines.length)) return s;
  const hit = cache.get(s.id);
  if (hit) return { ...s, ...hit };
  const { data, error } = await supabase.storage.from('cold').download(s.archive_path);
  if (error || !data) throw new Error(error?.message || 'Could not open the archived closing');
  const text = await new Response(data.stream().pipeThrough(new DecompressionStream('gzip'))).text();
  const parsed = JSON.parse(text) as { lines: StockSession['lines'] | null; counts: StockSession['counts'] | null };
  const detail = { lines: parsed.lines || [], counts: parsed.counts || {} };
  cache.set(s.id, detail);
  return { ...s, ...detail };
}
