import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import { useToast } from '../state/ToastContext';
import {
  CATEGORIES, fetchMyInquiries, fetchThread, openInquiry, postMessage,
  type Inquiry, type InquiryCategory, type InquiryMessage,
} from '../lib/support';

/**
 * Where a client asks Bermi Techs something.
 *
 * The business they are standing in is attached automatically, so support never
 * opens with "which bar is this?" — and the person asking never has to explain
 * what the product already knows.
 */
export function Help() {
  const nav = useNavigate();
  const { L, lang } = useSettings();
  const { activeBusiness, profile, displayName } = useData();
  const { session } = useAuth();
  const { flash } = useToast();
  const sw = lang === 'sw';

  const [threads, setThreads] = useState<Inquiry[] | null>(null);
  const [open, setOpen] = useState<Inquiry | null>(null);
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<InquiryCategory>('question');
  const [body, setBody] = useState('');
  const [reply, setReply] = useState('');

  const load = useCallback(async () => setThreads(await fetchMyInquiries()), []);
  useEffect(() => { void load(); }, [load]);

  const openThread = useCallback(async (t: Inquiry) => {
    setOpen(t);
    setMessages(await fetchThread(t.id));
  }, []);

  async function send() {
    const uid = session?.user?.id;
    if (!uid || !subject.trim() || !body.trim()) { flash(L.helpNeedBoth); return; }
    setBusy(true);
    const problem = await openInquiry({
      ownerId: uid,
      businessId: activeBusiness?.id ?? null,
      businessName: activeBusiness?.name ?? null,
      ownerName: profile?.full_name ?? displayName,
      ownerEmail: session?.user?.email ?? null,
      subject,
      category,
      body,
    });
    setBusy(false);
    if (problem) { flash(problem); return; }
    setComposing(false);
    setSubject(''); setBody(''); setCategory('question');
    flash(L.helpSent);
    void load();
  }

  async function sendReply() {
    const uid = session?.user?.id;
    if (!uid || !open || !reply.trim()) return;
    setBusy(true);
    const problem = await postMessage({
      inquiryId: open.id, authorId: uid,
      authorName: profile?.full_name ?? displayName,
      fromSupport: false, body: reply,
    });
    setBusy(false);
    if (problem) { flash(problem); return; }
    setReply('');
    setMessages(await fetchThread(open.id));
    void load();
  }

  const statusTone: Record<string, { ink: string; soft: string; label: string }> = {
    open: { ink: 'var(--warn)', soft: 'var(--warnSoft)', label: sw ? 'Imefunguliwa' : 'Open' },
    answered: { ink: 'var(--brand)', soft: 'var(--brandSoft)', label: sw ? 'Imejibiwa' : 'Answered' },
    resolved: { ink: 'var(--ok)', soft: 'var(--okSoft)', label: sw ? 'Imetatuliwa' : 'Resolved' },
    closed: { ink: 'var(--ink3)', soft: 'var(--card2)', label: sw ? 'Imefungwa' : 'Closed' },
  };

  return (
    <div className="screen sb">
      <ScreenHeader title={L.getHelp} sub={L.getHelpSub} />

      <button
        className="btn-primary tap"
        style={{ width: '100%', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}
        onClick={() => setComposing(true)}
      >
        <Icon name="plus" size={16} />
        {L.askSomething}
      </button>

      {threads === null ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>{L.loading}</div>
      ) : threads.length === 0 ? (
        <div className="card" style={{ padding: 36, textAlign: 'center' }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, margin: '0 auto 14px', background: 'var(--card2)', display: 'grid', placeItems: 'center', color: 'var(--ink3)' }}>
            <Icon name="mail" size={20} />
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 800 }}>{L.noThreads}</div>
          <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5 }}>{L.noThreadsSub}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {threads.map((t) => {
            const tone = statusTone[t.status];
            return (
              <div key={t.id} className="card tap" style={{ padding: 14 }} onClick={() => void openThread(t)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{t.subject}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: tone.ink, background: tone.soft, padding: '3px 7px', borderRadius: 6 }}>
                    {tone.label}
                  </span>
                </div>
                <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600 }}>
                  {[t.business_name, new Date(t.last_message_at).toLocaleDateString()].filter(Boolean).join(' · ')}
                  {t.awaiting === 'client' ? ` · ${L.awaitingYou}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="btn-ghost tap" style={{ width: '100%', marginTop: 16 }} onClick={() => nav('/manage')}>{L.back}</button>

      <Sheet open={composing} onClose={() => setComposing(false)} title={L.askSomething} sub={activeBusiness?.name}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="sb" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className="tap"
                onClick={() => setCategory(c.id)}
                style={{ flexShrink: 0, padding: '8px 13px', borderRadius: 12, fontSize: 12.5, fontWeight: 700, background: category === c.id ? 'var(--brand)' : 'var(--card2)', color: category === c.id ? 'var(--brandInk)' : 'var(--ink2)', border: '1px solid var(--line)' }}
              >
                {sw ? c.sw : c.en}
              </button>
            ))}
          </div>
          <input
            autoFocus
            className="card"
            placeholder={L.helpSubject}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ padding: '13px 15px', border: 'none', fontSize: 14.5, fontWeight: 700 }}
          />
          <textarea
            rows={5}
            className="card"
            placeholder={L.helpBody}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{ padding: '13px 15px', border: 'none', fontSize: 13.5, resize: 'vertical' }}
          />
          <button className="btn-primary tap" style={{ width: '100%' }} data-disabled={busy} onClick={send}>{L.send}</button>
        </div>
      </Sheet>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.subject} sub={open?.business_name || undefined}>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="sb" style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 340, overflowY: 'auto' }}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.from_support ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    padding: '10px 13px',
                    borderRadius: 14,
                    background: m.from_support ? 'var(--card2)' : 'var(--brandSoft)',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--ink3)' }}>
                    {m.from_support ? 'Bermi Techs' : (m.author_name || displayName)}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                </div>
              ))}
            </div>
            <textarea
              rows={3}
              className="card"
              placeholder={L.helpReply}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              style={{ padding: '12px 14px', border: '1px solid var(--line)', fontSize: 13.5, resize: 'vertical' }}
            />
            <button className="btn-primary tap" style={{ width: '100%' }} data-disabled={busy || !reply.trim()} onClick={sendReply}>{L.send}</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
