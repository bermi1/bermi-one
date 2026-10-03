import { useEffect, useMemo, useRef, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { answerQuestion, defaultSummary, findProduct, type AssistantData, type BusinessSummary } from '../ontology/assistant';
import { salesHistory, type SaleRow } from '../ontology/analytics';
import { analyse, overview, type AiAnswer, type AiBlock, type AnalystCtx, type Tone } from '../ontology/analyst';

interface Msg {
  who: 'user' | 'ai';
  text?: string;
  answer?: AiAnswer;
}

/** How far back Bermi reads closings for trends, rankings and buying advice. */
const HISTORY_DAYS = 120;

export function AI() {
  const { L, fmt, lang } = useSettings();
  const { products, session, accounts, ledger, actionLog, businesses, activeBusiness, fetchPortfolioSummary, fetchReportSource } = useData();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sw = lang === 'sw';

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
  useEffect(() => {
    if (!activeBusiness) return;
    let cancelled = false;
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - HISTORY_DAYS);
    fetchReportSource([activeBusiness.id], from.toISOString().slice(0, 10), to.toISOString().slice(0, 10))
      .then(({ sessions }) => { if (!cancelled) setRows(salesHistory(sessions, products)); })
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

  const [messages, setMessages] = useState<Msg[]>(() => [{ who: 'ai', text: defaultSummary(assistantData, fmt) }]);
  const [input, setInput] = useState('');
  const asked = useRef(false);

  // Once the history is in, open with where the business actually stands.
  useEffect(() => {
    if (!analystCtx || asked.current) return;
    const o = overview(analystCtx);
    if (o) setMessages([{ who: 'ai', answer: o }]);
  }, [analystCtx]);

  function reply(q: string): Msg {
    if (analystCtx) {
      const a = analyse(q, analystCtx, findProduct(products, q));
      if (a) return { who: 'ai', answer: a };
    }
    return { who: 'ai', text: answerQuestion(assistantData, q, fmt) };
  }

  function ask(q: string) {
    asked.current = true;
    setMessages((m) => [...m, { who: 'user', text: q }]);
    setInput('');
    setTimeout(() => {
      setMessages((m) => [...m, reply(q)]);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));
    }, 350);
  }

  const suggestions = sw
    ? ['Bidhaa gani inauza zaidi?', 'Ninunue nini wiki hii?', 'Mwenendo wa biashara?', 'Niongeze bidhaa gani?', 'Uchambuzi kamili', 'Siku gani ni bora?', businesses.length > 1 ? 'Biashara zangu zote?' : 'Bidhaa zinazokwama?']
    : ['What sells the most?', 'What should I buy this week?', 'How is the business trending?', 'What product should I add?', 'Full analysis', 'Which day is busiest?', businesses.length > 1 ? 'How are all my businesses?' : 'What is not selling?'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '16px 16px 0' }}>
        <ScreenHeader title={L.bermiAI} sub={rows === null ? (sw ? 'Inasoma historia ya mauzo…' : 'Reading your sales history…') : L.watching} />
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
            {m.answer ? <Answer a={m.answer} /> : m.text}
          </div>
        ))}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 0 16px' }}>
          {suggestions.map((s) => (
            <button key={s} className="chip tap" onClick={() => ask(s)}>
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
            if (e.key === 'Enter' && input.trim()) ask(input.trim());
          }}
          placeholder={L.askPlaceholder}
          className="card"
          style={{ flex: 1, padding: '13px 16px', border: 'none', fontSize: 14 }}
        />
        <button className="icon-btn tap" style={{ width: 46, height: 46, background: 'var(--grad)', color: '#fff', border: 'none' }} onClick={() => input.trim() && ask(input.trim())}>
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
