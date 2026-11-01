// Bermi AI for the bar module: a real model answering from the business's own figures.
//
// The app sends a question and the last few turns; this function checks the
// caller owns the business and is on Premium (or trialling it), counts the
// question against a daily limit, builds a compact snapshot of the business
// from the database, and asks Claude Haiku 5.5. The model sees only that one
// business's figures, read here with the service role after the ownership
// check — never anything from another account.
//
// Soft refusals (not Premium, limit reached, no key) come back as 200 with a
// `fallback` code so the app quietly answers with its built-in assistant.

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MODEL = 'claude-haiku-5-5';
const DAILY_LIMIT = { premium: 40, trial: 10 };

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

type Turn = { role: 'user' | 'assistant'; text: string };

const SYSTEM = `You are Bermi AI, the business analyst inside Bermi One, an app that Tanzanian bars and lounges use to count stock every night, record cash, mobile money and bank takings, and verify each day's closing.

How a closing works: each product has an opening (what was on the shelf), added (deliveries), and a count of what is left; sold = opening + added − count; sales = sold × price; profit = sold × profit-per-unit (the owner enters profit per unit — never invent costs). The money side: cash + mobile + bank + amount-to-bank + expenses + losses + staff debts should equal sales; the gap is "short" (missing money) or "over". Only verified closings are final.

Answer from the BUSINESS SNAPSHOT you are given and nothing else.
- Never invent numbers, products, dates or names. If the snapshot does not hold what is needed, say what is missing and what the owner can record to get it.
- Lead with the answer and the key number, then 2–5 short bullets: what it means and what to do. Keep it short enough to read on a phone. No tables wider than 3 columns; no markdown headings.
- Money as TSh with thousands separators (TSh 125,000). Quantities with their unit.
- Reply in the language of the question. For Swahili, use simple everyday Swahili and keep common business words in English where people say them that way: stock, closing, cash, mobile money, bank, profit, order, short, over.
- You can: plan what to order (from recent daily sales and stock on hand, aim for about 3 days of cover and flag items below their low level), explain why a day was short or over (compare its collected money and items against sales), compare days and weeks, find best sellers, slow and dead stock, most profitable products, staff debts and who owes, and suggest price or profit-per-unit changes with the reason.
- Be direct and practical, like a trusted manager. Don't lecture.`;

function tzToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dar_es_Salaam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
const r2 = (n: number) => Math.round(Number(n || 0) * 100) / 100;
const tsh = (n: number) => Math.round(Number(n || 0)).toLocaleString('en-US');

/** The business, in a compact text form a model reads well and that stays a few thousand tokens. */
async function snapshot(bizId: string): Promise<string> {
  const [{ data: biz }, { data: products }, { data: closings }, { data: open }, { data: acc }, { data: led }] = await Promise.all([
    admin.from('businesses').select('name, city, type').eq('id', bizId).single(),
    admin.from('products').select('id, name, cat, unit, price, profit, opening, added, incoming, low').eq('business_id', bizId).order('sort_order'),
    admin.from('stock_sessions').select('session_date, total_calculated_sales, total_calculated_profit, cash, mobile, bank_in, amount_to_bank, closing_items, lines, counts, submitted_by_name')
      .eq('business_id', bizId).eq('status', 'verified').order('session_date', { ascending: false }).limit(30),
    admin.from('stock_sessions').select('session_date, status, counts').eq('business_id', bizId).neq('status', 'verified').order('session_date', { ascending: true }).limit(3),
    admin.from('accounts').select('cash, mobile, bank').eq('business_id', bizId).maybeSingle(),
    admin.from('ledger_entries').select('created_at, label').eq('business_id', bizId).eq('kind', 'stock')
      .gte('created_at', new Date(Date.now() - 14 * 86_400_000).toISOString()).order('created_at', { ascending: false }).limit(25),
  ]);

  const out: string[] = [];
  out.push(`BUSINESS: ${biz?.name ?? ''}${biz?.city ? `, ${biz.city}` : ''} (bar). Today (Tanzania): ${tzToday()}.`);

  out.push('\nPRODUCTS NOW (name | category | unit | price | profit/unit | opening | added | held for next count | on shelf | low level):');
  for (const p of products ?? []) {
    out.push(`${p.name} | ${p.cat || '-'} | ${p.unit} | ${tsh(p.price)} | ${tsh(p.profit)} | ${r2(p.opening)} | ${r2(p.added)} | ${r2(p.incoming)} | ${r2(Number(p.opening) + Number(p.added))} | ${r2(p.low)}`);
  }

  const days = closings ?? [];
  out.push(`\nVERIFIED CLOSINGS, newest first (date | sales | profit | cash | mobile | bank | to bank | expenses | losses | staff debts | short(−)/over(+) | counted by):`);
  const debts = new Map<string, number>();
  for (const s of days) {
    const items = (s.closing_items ?? []) as { kind: string; amount: number; note: string }[];
    const sum = (k: string) => items.filter((i) => i.kind === k).reduce((t, i) => t + Number(i.amount || 0), 0);
    const collected = Number(s.cash || 0) + Number(s.mobile || 0) + Number(s.bank_in || 0) + Number(s.amount_to_bank || 0);
    const gap = collected + sum('expense') + sum('loss') + sum('debt') - Number(s.total_calculated_sales || 0);
    for (const i of items.filter((x) => x.kind === 'debt')) {
      const who = (i.note || 'unnamed').trim();
      debts.set(who, (debts.get(who) ?? 0) + Number(i.amount || 0));
    }
    out.push(`${s.session_date} | ${tsh(s.total_calculated_sales)} | ${tsh(s.total_calculated_profit)} | ${tsh(s.cash)} | ${tsh(s.mobile)} | ${tsh(s.bank_in)} | ${tsh(s.amount_to_bank)} | ${tsh(sum('expense'))} | ${tsh(sum('loss'))} | ${tsh(sum('debt'))} | ${gap === 0 ? '0' : (gap > 0 ? '+' : '−') + tsh(Math.abs(gap))} | ${s.submitted_by_name || '-'}`);
  }
  if (!days.length) out.push('(none yet)');

  // What each product sold, per verified day, for the last two weeks: the basis for orders and rankings.
  const recent = days.slice(0, 14);
  if (recent.length) {
    out.push(`\nUNITS SOLD PER PRODUCT, last ${recent.length} verified days (product: newest → oldest):`);
    const sold = new Map<string, number[]>();
    recent.forEach((s, di) => {
      const counts = (s.counts ?? {}) as Record<string, number>;
      for (const l of (s.lines ?? []) as { id: string; name: string; opening: number; added: number }[]) {
        const c = counts[l.id];
        if (c === undefined || c === null) continue;
        const arr = sold.get(l.name) ?? Array(recent.length).fill(null);
        arr[di] = r2(Number(l.opening) + Number(l.added) - Number(c));
        sold.set(l.name, arr);
      }
    });
    for (const [name, arr] of sold) out.push(`${name}: ${arr.map((v) => (v === null ? '-' : v)).join(', ')}`);
  }

  if (debts.size) {
    out.push('\nSTAFF DEBT recorded in those closings (name: total):');
    for (const [who, amt] of [...debts].sort((a, b) => b[1] - a[1])) out.push(`${who}: TSh ${tsh(amt)}`);
  }

  out.push('\nDAYS NOT YET VERIFIED:');
  if (open?.length) for (const s of open) out.push(`${s.session_date}: ${s.status}, ${Object.keys(s.counts ?? {}).length} products counted`);
  else out.push('(none)');

  if (acc) out.push(`\nMONEY HELD (from verified closings, less payments): cash TSh ${tsh(acc.cash)}, mobile TSh ${tsh(acc.mobile)}, bank TSh ${tsh(acc.bank)}.`);

  if (led?.length) {
    out.push('\nSTOCK MOVEMENTS, last 14 days (deliveries, removals, corrections, transfers):');
    for (const l of led) out.push(`${String(l.created_at).slice(0, 10)}: ${l.label}`);
  }
  return out.join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    const { data: who } = await admin.auth.getUser(token);
    const user = who?.user;
    if (!user) return json({ error: 'Not signed in' }, 401);

    const body = await req.json().catch(() => ({})) as { business_id?: string; business_ids?: string[]; question?: string; history?: Turn[] };
    const question = String(body.question ?? '').trim().slice(0, 1000);
    // One business, or several the owner chose to read together (at most 6).
    const ids = [...new Set((Array.isArray(body.business_ids) && body.business_ids.length ? body.business_ids : [body.business_id]).filter((x): x is string => typeof x === 'string' && !!x))].slice(0, 6);
    if (!ids.length || !question) return json({ error: 'business_id and question are required' }, 400);

    // The owner only: the figures are the businesses' books.
    const { data: bizRows } = await admin.from('businesses').select('id, name, owner_id, type').in('id', ids);
    if (!bizRows || bizRows.length !== ids.length || bizRows.some((b) => b.owner_id !== user.id)) return json({ error: 'Not allowed' }, 403);
    const bars = bizRows.filter((b) => b.type !== 'barber');
    if (!bars.length) return json({ fallback: 'NOT_BAR' });

    // Premium, or a trial (which runs as Premium), with its own daily allowance.
    const { data: sub } = await admin.from('subscriptions').select('status, subscription_plans(code)').eq('owner_id', user.id).maybeSingle();
    const code = (sub?.subscription_plans as { code?: string } | null)?.code;
    const tier = sub?.status === 'trialing' ? 'trial' : sub?.status === 'active' && code === 'premium' ? 'premium' : null;
    if (!tier) return json({ fallback: 'NOT_PREMIUM' });

    const { data: cfg } = await admin.rpc('ai_config');
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY') || (cfg as { api_key?: string } | null)?.api_key || '';
    if (!apiKey) return json({ fallback: 'NO_KEY' });

    const day = tzToday();
    const { data: used } = await admin.from('ai_usage').select('questions').eq('owner_id', user.id).eq('day', day).maybeSingle();
    if ((used?.questions ?? 0) >= DAILY_LIMIT[tier]) return json({ fallback: 'LIMIT', limit: DAILY_LIMIT[tier] });

    const facts = bars.length === 1
      ? await snapshot(bars[0].id)
      : `${bars.length} businesses read together. Give combined totals first, then the split per business, and name the business for any per-business fact.\n\n` +
        (await Promise.all(bars.map(async (b) => `===== BUSINESS: ${b.name} =====\n${await snapshot(b.id)}`))).join('\n\n');
    const history = (Array.isArray(body.history) ? body.history : [])
      .filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string' && t.text.trim())
      .slice(-6)
      .map((t) => ({ role: t.role, content: t.text.slice(0, 2000) }));
    // The API needs the conversation to start with the user.
    while (history.length && history[0].role !== 'user') history.shift();

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low' },
      // Instructions and the business snapshot are the stable prefix: cached, so
      // follow-up questions in the same few minutes cost a fraction.
      system: [
        { type: 'text', text: SYSTEM },
        { type: 'text', text: `BUSINESS SNAPSHOT\n${facts}`, cache_control: { type: 'ephemeral' } },
      ],
      messages: [...history, { role: 'user', content: question }],
    });

    if (response.stop_reason === 'refusal') return json({ fallback: 'REFUSED' });
    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!answer) return json({ fallback: 'EMPTY' });

    const u = response.usage;
    await admin.rpc('ai_count', {
      p_owner: user.id, p_day: day,
      p_in: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
      p_out: u.output_tokens ?? 0,
    });

    return json({ answer, remaining: DAILY_LIMIT[tier] - (used?.questions ?? 0) - 1 });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ fallback: 'BUSY' });
    if (e instanceof Anthropic.AuthenticationError) return json({ fallback: 'NO_KEY' });
    if (e instanceof Anthropic.APIError) {
      console.error('ask-ai: Anthropic', e.status, e.message);
      return json({ fallback: 'AI_ERROR' });
    }
    console.error('ask-ai failed:', e instanceof Error ? e.message : String(e));
    return json({ fallback: 'AI_ERROR' });
  }
});
