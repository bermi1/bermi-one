import { useEffect, useMemo, useRef, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { answerQuestion, defaultSummary, findProduct, type AssistantData, type BusinessSummary } from '../ontology/assistant';
import { salesHistory, type SaleRow } from '../ontology/analytics';
import { analyse, overview, type AiAnswer, type AiBlock, type AnalystCtx, type Tone } from '../ontology/analyst';
import { salonAnalyse, salonOverview, type SalonAnalystCtx } from '../ontology/salonAnalyst';
import { useSalon } from '../state/SalonContext';
import type { SalonVisit } from '../lib/salon';
import type { Lang } from '../lib/i18n';
import { askAi, type AiFallback, type AiTurn } from '../lib/ai';
import { answer as brainAnswer, answerAs, teach, INTENT_LABELS, type BrainData, type Intent } from '../ontology/brain';
import { todayIso } from '../lib/calc';
import type { StockSession } from '../lib/types';

// Everyday words that give away which language a question was typed in.
const SW_WORDS = new Set(['nini', 'gani', 'ngapi', 'je', 'leo', 'jana', 'wiki', 'mwezi', 'hii', 'hiyo', 'yangu', 'zangu', 'wangu', 'nina', 'tuna', 'kuna', 'iko', 'ziko', 'bidhaa', 'mauzo', 'faida', 'hasara', 'deni', 'pesa', 'fedha', 'bei', 'nifanye', 'niongeze', 'ninunue', 'zaidi', 'kidogo', 'inauza', 'inauzwa', 'zimeuzwa', 'biashara', 'mfanyakazi', 'wafanyakazi', 'kinyozi', 'wateja', 'mteja', 'siku', 'bora', 'mbaya', 'kwa', 'na', 'ya', 'za', 'cha', 'vya', 'ni', 'nipe', 'nionyeshe', 'naomba', 'habari', 'mwenendo', 'ushauri', 'uchambuzi', 'ipi', 'zipi', 'lini', 'kwanini', 'vipi', 'imebaki', 'zimebaki']);
const EN_WORDS = new Set(['what', 'which', 'how', 'many', 'much', 'the', 'is', 'are', 'my', 'today', 'yesterday', 'week', 'month', 'best', 'worst', 'sell', 'sells', 'selling', 'sold', 'sales', 'profit', 'loss', 'losses', 'debt', 'should', 'show', 'me', 'give', 'who', 'when', 'why', 'top', 'most', 'least', 'left', 'trend', 'business', 'barber', 'clients', 'analysis', 'forecast', 'do', 'does', 'did', 'and', 'of', 'for', 'this', 'last', 'buy', 'order']);

interface Msg {
  who: 'user' | 'ai';
  text?: string;
  answer?: AiAnswer;
  /** Written by the real model (Claude), not the built-in assistant. */
  smart?: boolean;
  /** Still waiting for the model. */
  pending?: boolean;
  /** Why the built-in assistant answered instead. */
  note?: string;
  /** Answered by the local brain: the question and what it took it to mean, so the owner can correct it. */
  local?: { q: string; intent: Intent; lang: Lang; rated?: 'up' | 'down' | 'fixed' };
}

/** How far back Bermi reads closings for trends, rankings and buying advice. */
const HISTORY_DAYS = 120;

export function AI() {
  const { L, fmt, lang } = useSettings();
  const { products, session, accounts, ledger, actionLog, businesses, activeBusiness, fetchPortfolioSummary, fetchReportSource, plan } = useData();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sw = lang === 'sw';
  const salon = useSalon();
  const isSalon = salon.isSalon;

  // A barbershop is read from its paid visits rather than stock closings.
  const [salonVisits, setSalonVisits] = useState<SalonVisit[] | null>(null);
  useEffect(() => {
    if (!isSalon) return;
    let cancelled = false;
    const from = new Date(Date.now() - 90 * 86_400_000).toISOString();
    void salon.fetchVisits(from, new Date().toISOString()).then((v) => { if (!cancelled) setSalonVisits(v); });
    return () => { cancelled = true; };
  }, [isSalon, salon.fetchVisits]); // eslint-disable-line react-hooks/exhaustive-deps
  const salonCtx: SalonAnalystCtx | null = useMemo(() => (isSalon && salonVisits ? {
    visits: salonVisits, appts: salon.appointments, clients: salon.clients, services: salon.services, lang, fmt, businessName: activeBusiness?.name || L.appName,
  } : null), [isSalon, salonVisits, salon.appointments, salon.clients, salon.services, lang, fmt, activeBusiness, L.appName]);

  const [portfolio, setPortfolio] = useState<BusinessSummary[] | null>(null);
  useEffect(() => {
    if (businesses.length <= 1) return;
    let cancelled = false;
    fetchPortfolioSummary(7).then((rows) => {
      if (!cancelled) setPortfolio(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [businesses.length, fetchPortfolioSummary]);

  // The sales history: every verified closing of the last few months, per product.
  const [rows, setRows] = useState<SaleRow[] | null>(null);
  const [sessions, setSessions] = useState<StockSession[]>([]);
  useEffect(() => {
    if (!activeBusiness) return;
    let cancelled = false;
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - HISTORY_DAYS);
    fetchReportSource([activeBusiness.id], from.toISOString().slice(0, 10), to.toISOString().slice(0, 10))
      .then(({ sessions }) => { if (!cancelled) { setSessions(sessions); setRows(salesHistory(sessions, products)); } })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, [activeBusiness, fetchReportSource, products]);

  const assistantData: AssistantData = {
    products, session, accounts, ledger, actionLog, businesses, portfolio, lang,
    activeBusinessName: activeBusiness?.name || L.appName,
  };
  const analystCtx: AnalystCtx | null = useMemo(() => (rows ? {
    rows, products, counts: session?.counts || {}, lang, fmt, businessName: activeBusiness?.name || L.appName,
  } : null), [rows, products, session, lang, fmt, activeBusiness, L.appName]);

  // The local brain: reads this business's own records, no internet needed.
  const brainData: BrainData | null = useMemo(() => (rows && activeBusiness && !isSalon ? {
    businessId: activeBusiness.id, businessName: activeBusiness.name, sessions, rows, products,
    counts: session?.counts || {}, ledger, accounts, fmt, today: todayIso(),
  } : null), [rows, activeBusiness, isSalon, sessions, products, session, ledger, accounts, fmt]);

  const [messages, setMessages] = useState<Msg[]>(() => [{ who: 'ai', text: defaultSummary(assistantData, fmt) }]);
  const [input, setInput] = useState('');
  const asked = useRef(false);

  // Once the history is in, open with where the business actually stands.
  useEffect(() => {
    if (asked.current) return;
    if (salonCtx) { const o = salonOverview(salonCtx); if (o) setMessages([{ who: 'ai', answer: o }]); return; }
    if (!analystCtx || isSalon) return;
    const o = overview(analystCtx);
    if (o) setMessages([{ who: 'ai', answer: o }]);
  }, [analystCtx, salonCtx, isSalon]);

  /*
    Answer in the language the question was asked in. The app's language is
    the default, but someone who types "bidhaa gani inauza zaidi?" in an
    English app wants the answer in Swahili, and the reverse.
  */
  const salonBase = salonCtx, analystBase = analystCtx, assistantBase = assistantData;
  function replyLang(q: string): Lang {
    const w = q.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
    const swHits = w.filter((x) => SW_WORDS.has(x)).length;
    const enHits = w.filter((x) => EN_WORDS.has(x)).length;
    if (swHits > enHits) return 'sw';
    if (enHits > swHits) return 'en';
    return lang;
  }

  function reply(q: string): Msg {
    const ql = replyLang(q);
    const sw = ql === 'sw';
    const salonCtx = salonBase && { ...salonBase, lang: ql };
    const analystCtx = analystBase && { ...analystBase, lang: ql };
    const assistantData = { ...assistantBase, lang: ql };
    if (salonCtx) {
      const a = salonAnalyse(q, salonCtx);
      if (a) return { who: 'ai', answer: a };
      return { who: 'ai', text: sw ? 'Naweza kuchambua vinyozi, huduma, bei, saa za shughuli, wateja wanaorudi na mwenendo. Jaribu: "kinyozi bora?" au "bei gani nipandishe?"' : 'I can analyse barbers, services, pricing, busy hours, returning clients and the trend. Try "who is my best barber?" or "what should I charge more for?"' };
    }
    // "All my businesses" is the portfolio view, which the older assistant owns.
    const portfolioAsk = businesses.length > 1 && /(all|every|portfolio|zote)/i.test(q) && /(business|biashara)/i.test(q);
    if (brainData && !portfolioAsk) {
      const b = brainAnswer(q, brainData, ql);
      if (b.intent === 'search' && analystCtx) {
        const a = analyse(q, analystCtx, findProduct(products, q));
        if (a) return { who: 'ai', answer: a };
      }
      return { who: 'ai', answer: b.answer, local: { q, intent: b.intent, lang: ql } };
    }
    if (analystCtx && !portfolioAsk) {
      const a = analyse(q, analystCtx, findProduct(products, q));
      if (a) return { who: 'ai', answer: a };
    }
    return { who: 'ai', text: answerQuestion(assistantData, q, fmt) };
  }

  // The bar on Premium (or a trial) asks the real model; everything else, and
  // any failure, gets the built-in assistant's answer.
  const smart = !isSalon && plan.code === 'premium' && !!activeBusiness;
  const busy = messages.some((m) => m.pending);
  const scrollDown = () => requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));

  function noteFor(code: AiFallback, qsw: boolean): string | undefined {
    if (code === 'LIMIT') return qsw ? 'Maswali ya AI ya leo yameisha — hili ni jibu la kawaida.' : "Today's AI questions are used up — this is the basic answer.";
    if (code === 'BUSY' || code === 'AI_ERROR' || code === 'EMPTY') return qsw ? 'AI haipatikani sasa hivi — hili ni jibu la kawaida.' : 'The AI is not available right now — this is the basic answer.';
    return undefined;
  }

  async function ask(q: string) {
    if (busy) return;
    asked.current = true;
    setInput('');
    if (!smart) {
      setMessages((m) => [...m, { who: 'user', text: q }]);
      setTimeout(() => { setMessages((m) => [...m, reply(q)]); scrollDown(); }, 350);
      return;
    }
    // The conversation so far, as plain text turns the model can follow.
    const history: AiTurn[] = messages
      .filter((m) => !m.pending && m.text && (m.who === 'user' || m.smart))
      .map((m) => ({ role: m.who === 'user' ? 'user' : 'assistant', text: m.text as string }));
    setMessages((m) => [...m, { who: 'user', text: q }, { who: 'ai', pending: true }]);
    scrollDown();
    const res = await askAi(activeBusiness!.id, q, history);
    setMessages((m) => {
      const rest = m.filter((x) => !x.pending);
      if (res.answer) return [...rest, { who: 'ai', text: res.answer, smart: true }];
      const basic = reply(q);
      return [...rest, { ...basic, note: noteFor(res.fallback || 'AI_ERROR', replyLang(q) === 'sw') }];
    });
    scrollDown();
  }

  // 👍 / 👎 on a local answer. 👎 asks what was meant; the pick is answered and remembered.
  const [fixing, setFixing] = useState<number | null>(null);
  function rate(i: number, up: boolean) {
    setMessages((m) => m.map((x, j) => (j === i && x.local ? { ...x, local: { ...x.local, rated: up ? 'up' : 'down' } } : x)));
    if (up) {
      const l = messages[i].local;
      if (l && brainData && l.intent !== 'search') teach(brainData.businessId, l.q, l.intent, brainData);
    } else setFixing(i);
  }
  function fix(i: number, intent: Intent) {
    const l = messages[i].local;
    if (!l || !brainData) return;
    teach(brainData.businessId, l.q, intent, brainData);
    const a = answerAs(intent, l.q, brainData, l.lang);
    setFixing(null);
    setMessages((m) => [...m.map((x, j) => (j === i && x.local ? { ...x, local: { ...x.local, rated: 'fixed' as const } } : x)),
      { who: 'ai', answer: a, local: { q: l.q, intent, lang: l.lang, rated: 'fixed' } }]);
    scrollDown();
  }

  const suggestions = smart
    ? (sw ? ['Ninunue nini kesho?', 'Kwa nini closing ya mwisho ilikuwa short?', 'Vinywaji gani vinaleta faida zaidi?', 'Linganisha wiki hii na iliyopita', 'Nani anadaiwa pesa?', 'Stock gani haiuzi?']
      : ['What should I order tomorrow?', 'Why was the last closing short?', 'Which drinks make the most profit?', 'Compare this week with last week', 'Who owes money?', 'What stock is not moving?'])
    : isSalon
    ? (sw ? ['Kinyozi bora?', 'Huduma gani inauza zaidi?', 'Bei gani nipandishe?', 'Saa zipi ni za polepole?', 'Wateja gani hawarudi?', 'Mwenendo wa wiki', 'Uchambuzi kamili']
      : ['Who is my best barber?', 'What sells the most?', 'What should I charge more for?', 'When are we slow?', 'Who has stopped coming?', 'Weekly trend', 'Full analysis'])
    : sw
    ? ['Bidhaa gani inauza zaidi?', 'Ninunue nini wiki hii?', 'Mwenendo wa biashara?', 'Niongeze bidhaa gani?', 'Uchambuzi kamili', 'Siku gani ni bora?', businesses.length > 1 ? 'Biashara zangu zote?' : 'Bidhaa zinazokwama?']
    : ['What sells the most?', 'What should I buy this week?', 'How is the business trending?', 'What product should I add?', 'Full analysis', 'Which day is busiest?', businesses.length > 1 ? 'How are all my businesses?' : 'What is not selling?'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, overflowX: 'clip' }}>
      <div style={{ padding: '16px 16px 0' }}>
        <ScreenHeader title={L.bermiAI} sub={(isSalon ? salonVisits === null : rows === null) ? (sw ? 'Inasoma historia ya mauzo…' : 'Reading your sales history…') : L.watching} />
      </div>
      <div ref={scrollRef} className="sb" style={{ flex: 1, overflowY: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.who === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: m.answer ? '96%' : '82%',
              width: m.answer ? '96%' : undefined,
              background: m.who === 'user' ? 'var(--brand)' : 'var(--card)',
              color: m.who === 'user' ? 'var(--brandInk)' : 'var(--ink)',
              borderRadius: m.who === 'user' ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
              padding: '12px 15px',
              fontSize: 13.5,
              fontWeight: 600,
              whiteSpace: m.answer ? undefined : 'pre-line',
              lineHeight: 1.5,
              boxShadow: m.who === 'ai' ? 'var(--sh)' : 'none',
            }}
          >
            {m.pending ? (
              <span className="ai-typing" style={{ color: 'var(--ink3)' }}>{sw ? 'Bermi AI inafikiri…' : 'Bermi AI is thinking…'}</span>
            ) : m.answer ? <Answer a={m.answer} /> : m.text}
            {m.smart && (
              <div className="ai-badge" style={{ marginTop: 8, fontSize: 10.5, fontWeight: 800, color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="spark" size={11} /> Bermi AI
              </div>
            )}
            {m.note && <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: 'var(--ink3)' }}>{m.note}</div>}
            {m.local && (
              <div className="brain-rate" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--ink3)' }}>
                {m.local.rated === 'up' && <span>{sw ? 'Asante — nimejifunza.' : 'Thanks — learned.'}</span>}
                {m.local.rated === 'fixed' && <span>{sw ? 'Nimekumbuka maana hii.' : 'Got it — I will remember that.'}</span>}
                {(!m.local.rated || m.local.rated === 'down') && (
                  <>
                    <span>{sw ? 'Jibu sahihi?' : 'Right answer?'}</span>
                    <button className="tap brain-up" aria-label="yes" onClick={() => rate(i, true)} style={{ background: 'none', border: 0, fontSize: 14, cursor: 'pointer' }}>👍</button>
                    <button className="tap brain-down" aria-label="no" onClick={() => rate(i, false)} style={{ background: 'none', border: 0, fontSize: 14, cursor: 'pointer' }}>👎</button>
                  </>
                )}
              </div>
            )}
            {fixing === i && m.local && (
              <div className="brain-fix" style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink2)', marginBottom: 6 }}>{sw ? 'Ulimaanisha nini?' : 'What did you mean?'}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(Object.keys(INTENT_LABELS) as (keyof typeof INTENT_LABELS)[]).filter((k) => k !== m.local!.intent).map((k) => (
                    <button key={k} className="chip tap" data-intent={k} onClick={() => fix(i, k)} style={{ fontSize: 11.5 }}>{INTENT_LABELS[k][m.local!.lang]}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {!isSalon && !smart && (
          <div className="card" style={{ padding: '10px 13px', fontSize: 12, fontWeight: 700, color: 'var(--ink2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="spark" size={14} style={{ color: 'var(--brand)' }} />
            {sw ? 'Bermi AI kamili (inaelewa swali lolote, inapanga oda, inaeleza short) iko kwenye Premium.' : 'Full Bermi AI (understands any question, plans orders, explains short/over) comes with Premium.'}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 0 16px' }}>
          {suggestions.map((s) => (
            <button key={s} className="chip tap" data-disabled={busy} onClick={() => void ask(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '10px 16px calc(96px + env(safe-area-inset-bottom))', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input.trim()) void ask(input.trim());
          }}
          placeholder={L.askPlaceholder}
          className="field"
          style={{ flex: 1 }}
        />
        <button className="icon-btn tap" style={{ width: 46, height: 46, background: 'var(--grad)', color: '#fff', border: 'none' }} onClick={() => { if (input.trim()) void ask(input.trim()); }}>
          <Icon name="right" size={18} />
        </button>
      </div>
    </div>
  );
}

const TONE: Record<Tone, { ink: string; soft: string }> = {
  good: { ink: 'var(--ok)', soft: 'var(--okSoft)' },
  bad: { ink: 'var(--bad)', soft: 'var(--badSoft)' },
  warn: { ink: 'var(--warn)', soft: 'var(--warnSoft)' },
  neutral: { ink: 'var(--ink2)', soft: 'var(--card2)' },
};

function Answer({ a }: { a: AiAnswer }) {
  return (
    <div className="ai-answer" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {a.blocks.map((b, i) => <Block key={i} b={b} />)}
    </div>
  );
}

function Block({ b }: { b: AiBlock }) {
  if (b.kind === 'text') return <div style={{ whiteSpace: 'pre-line' }}>{b.text}</div>;

  if (b.kind === 'kpis') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(b.items.length, 2)}, minmax(0,1fr))`, gap: 8 }}>
        {b.items.map((k) => (
          <div key={k.label} style={{ background: 'var(--card2)', borderRadius: 14, padding: '10px 12px', minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700 }}>{k.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 3, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.value}</div>
            {k.delta && (
              <span style={{ display: 'inline-block', marginTop: 4, fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 7, color: TONE[k.tone || 'neutral'].ink, background: TONE[k.tone || 'neutral'].soft }}>{k.delta}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (b.kind === 'bars') {
    const max = Math.max(1, ...b.rows.map((r) => r.value));
    return (
      <div>
        {b.title && <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{b.title}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {b.rows.map((r, i) => (
            <div key={r.label + i}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{r.label}</span>
                <b style={{ fontSize: 13 }}>{r.display}</b>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: 'var(--card2)', marginTop: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(2, (r.value / max) * 100)}%`, borderRadius: 4, background: r.tone === 'bad' ? 'var(--bad)' : r.tone === 'good' ? 'var(--ok)' : 'var(--brand)' }} />
              </div>
              {r.note && <div style={{ fontSize: 11, color: r.tone === 'bad' ? 'var(--bad)' : 'var(--ink3)', fontWeight: 700, marginTop: 3 }}>{r.note}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {b.title && <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{b.title}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {b.items.map((it, i) => (
          <div key={it.title + i} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 14, background: TONE[it.tone || 'neutral'].soft }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: TONE[it.tone || 'neutral'].ink, marginTop: 6, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800 }}>{it.title}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink2)', marginTop: 2, lineHeight: 1.45 }}>{it.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
