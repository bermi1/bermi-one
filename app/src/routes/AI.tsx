import { useMemo, useRef, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { currentQty, diffOf } from '../lib/calc';
import { deriveInsights } from '../ontology/insights';

interface Msg {
  who: 'user' | 'ai';
  text: string;
}

export function AI() {
  const { L, fmt, lang } = useSettings();
  const { products, session, accounts, ledger, actionLog } = useData();
  const counts = session?.counts || {};
  const scrollRef = useRef<HTMLDivElement>(null);

  const insights = useMemo(() => deriveInsights({ products, counts, accounts, actionLog, lang }), [products, counts, accounts, actionLog, lang]);

  const cutoff7 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);
  const week = useMemo(() => ledger.filter((e) => e.created_at >= cutoff7), [ledger, cutoff7]);
  const weekRev = week.filter((e) => e.kind === 'sale' || e.kind === 'payment').reduce((s, e) => s + e.amount, 0);
  const weekOpex = week.filter((e) => e.kind === 'expense').reduce((s, e) => s + Math.abs(e.amount), 0);
  const weekCogs = Math.round(weekRev * 0.6);

  const [messages, setMessages] = useState<Msg[]>([{ who: 'ai', text: summary() }]);
  const [input, setInput] = useState('');

  function summary() {
    const base = lang === 'sw'
      ? `Wiki hii\n\nMapato: ${fmt(weekRev)}\nGharama za bidhaa: ${fmt(weekCogs)}\nFaida halisi: ${fmt(weekRev - weekCogs - weekOpex)}`
      : `This week\n\nRevenue: ${fmt(weekRev)}\nCost of goods sold: ${fmt(weekCogs)}\nNet profit: ${fmt(weekRev - weekCogs - weekOpex)}`;
    const top = insights[0];
    const noted = top ? `\n\n${lang === 'sw' ? 'Nimegundua' : 'I noticed'}: ${top.text}` : '';
    const hint = lang === 'sw' ? '\n\nUliza kuhusu bidhaa, fedha, tofauti, faida, kilichotokea, au nifanye nini.' : '\n\nAsk about stock, cash, difference, profit, what happened, or what to focus on.';
    return base + noted + hint;
  }

  function answer(q: string): string {
    const l = q.toLowerCase();
    const sessionMoney = { cash: session?.cash || 0, mobile: session?.mobile || 0, bank_in: session?.bank_in || 0, closing_items: session?.closing_items || [] };
    if (l.includes('stock') || l.includes('bidhaa')) {
      const low = products.filter((p) => currentQty(p, counts) < p.low).map((p) => p.name);
      return (lang === 'sw' ? 'Bidhaa zilizopungua: ' : 'Below reorder: ') + (low.join(', ') || '—');
    }
    if (l.includes('cash') || l.includes('fedha')) {
      const pos = (accounts?.cash || 0) + (accounts?.mobile || 0) + (accounts?.bank || 0);
      return (lang === 'sw' ? 'Fedha zilizopo: ' : 'Cash position: ') + fmt(pos) + `\n${L.cash} ${fmt(accounts?.cash || 0)}\n${L.mobileMoney} ${fmt(accounts?.mobile || 0)}\n${L.bank} ${fmt(accounts?.bank || 0)}`;
    }
    if (l.includes('diff') || l.includes('tofauti')) {
      const diff = diffOf(products, counts, sessionMoney);
      return (lang === 'sw' ? "Tofauti ya leo: " : "Today's difference: ") + fmt(Math.abs(diff));
    }
    if (l.includes('profit') || l.includes('faida')) {
      return `${L.revenue} ${fmt(weekRev)}\n${L.costOfSales} ${fmt(weekCogs)}\n${L.opex} ${fmt(weekOpex)}\n${L.netProfit} ${fmt(weekRev - weekCogs - weekOpex)}`;
    }
    if (l.includes('happen') || l.includes('recent') || l.includes('history') || l.includes('kimetokea') || l.includes('karibuni')) {
      if (!actionLog.length) return lang === 'sw' ? 'Hakuna kilichorekodiwa bado.' : 'Nothing recorded yet.';
      return actionLog.slice(0, 6).map((a) => `• ${a.summary}`).join('\n');
    }
    if (l.includes('should') || l.includes('advice') || l.includes('focus') || l.includes('nifanye') || l.includes('ushauri')) {
      if (!insights.length) return lang === 'sw' ? 'Kila kitu kinaonekana kuwa sawa kwa sasa.' : 'Everything looks steady right now — nothing urgent needs your attention.';
      return insights.slice(0, 3).map((i) => `• ${i.text}`).join('\n\n');
    }
    return summary();
  }

  function ask(q: string) {
    setMessages((m) => [...m, { who: 'user', text: q }]);
    setInput('');
    setTimeout(() => {
      setMessages((m) => [...m, { who: 'ai', text: answer(q) }]);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));
    }, 350);
  }

  const suggestions = lang === 'sw'
    ? ['Nifanye nini leo?', 'Faida ikoje?', 'Fedha zilizopo?', 'Nini kimetokea hivi karibuni?']
    : ['What should I focus on?', 'How is profit?', 'Cash position?', 'What happened recently?'];

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
