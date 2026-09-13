import { useEffect, useRef, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { answerQuestion, defaultSummary, type AssistantData, type BusinessSummary } from '../ontology/assistant';

interface Msg {
  who: 'user' | 'ai';
  text: string;
}

export function AI() {
  const { L, fmt, lang } = useSettings();
  const { products, session, accounts, ledger, actionLog, businesses, activeBusiness, fetchPortfolioSummary } = useData();
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const assistantData: AssistantData = {
    products, session, accounts, ledger, actionLog, businesses, portfolio, lang,
    activeBusinessName: activeBusiness?.name || L.appName,
  };

  const [messages, setMessages] = useState<Msg[]>(() => [{ who: 'ai', text: defaultSummary(assistantData, fmt) }]);
  const [input, setInput] = useState('');

  function ask(q: string) {
    setMessages((m) => [...m, { who: 'user', text: q }]);
    setInput('');
    setTimeout(() => {
      setMessages((m) => [...m, { who: 'ai', text: answerQuestion(assistantData, q, fmt) }]);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));
    }, 350);
  }

  const suggestions = lang === 'sw'
    ? ['Nifanye nini leo?', 'Bidhaa bora leo?', 'Fedha zilizopo?', businesses.length > 1 ? 'Biashara zangu zote?' : 'Nini kimetokea hivi karibuni?']
    : ['What should I focus on?', 'Best sellers today?', 'Cash position?', businesses.length > 1 ? 'How are all my businesses?' : 'What happened recently?'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '16px 16px 0' }}>
        <ScreenHeader title={L.bermiAI} sub={L.watching} />
      </div>
      <div ref={scrollRef} className="sb" style={{ flex: 1, overflowY: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.who === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '82%',
              background: m.who === 'user' ? 'var(--brand)' : 'var(--card)',
              color: m.who === 'user' ? 'var(--brandInk)' : 'var(--ink)',
              borderRadius: m.who === 'user' ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
              padding: '12px 15px',
              fontSize: 13.5,
              fontWeight: 600,
              whiteSpace: 'pre-line',
              lineHeight: 1.5,
              boxShadow: m.who === 'ai' ? 'var(--sh)' : 'none',
            }}
          >
            {m.text}
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
