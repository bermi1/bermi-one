import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { HQ } from './hq-i18n';
import { fetchThread, postMessage, setInquiryStatus, type Inquiry, type InquiryMessage } from '../lib/support';

/**
 * Answering a client.
 *
 * Posting a reply flips the thread to "waiting on them" and queues an email —
 * both done by database triggers, not here, so the queue stays truthful however
 * a message arrived and an answer nobody knows about cannot happen.
 */
export function InquiryDrawer({ inquiry, onClose, onChanged, onFlash }: {
  inquiry: Inquiry | null;
  onClose: () => void;
  onChanged: () => void;
  onFlash: (msg: string) => void;
}) {
  const { lang } = useSettings();
  const { displayName } = useData();
  const { session } = useAuth();
  const T = HQ[lang];

  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!inquiry) { setMessages([]); return; }
    setMessages(await fetchThread(inquiry.id));
  }, [inquiry]);

  useEffect(() => { void load(); }, [load]);

  if (!inquiry) return null;

  async function send() {
    const uid = session?.user?.id;
    if (!uid || !reply.trim()) return;
    setBusy(true);
    const problem = await postMessage({
      inquiryId: inquiry!.id, authorId: uid, authorName: displayName,
      fromSupport: true, body: reply,
    });
    setBusy(false);
    if (problem) { onFlash(problem); return; }
    setReply('');
    await load();
    onChanged();
  }

  async function resolve() {
    setBusy(true);
    const problem = await setInquiryStatus(inquiry!.id, 'resolved');
    setBusy(false);
    if (problem) { onFlash(problem); return; }
    onFlash(T.markResolved);
    onChanged();
    onClose();
  }

  return (
    <>
      <div className="hq-scrim" style={{ display: 'block' }} onClick={onClose} />
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 40,
          width: 'min(460px, 100vw)', background: 'var(--bg)', borderLeft: '1px solid var(--line)',
          overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: -0.2 }}>{inquiry.subject}</div>
            <div style={{ marginTop: 3, fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>
              {[inquiry.business_name, inquiry.owner_name, inquiry.owner_email].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button className="hq-icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.from_support ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                padding: '11px 13px',
                borderRadius: 14,
                background: m.from_support ? 'var(--brandSoft)' : 'var(--card)',
                border: '1px solid var(--line)',
              }}
            >
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--ink3)' }}>
                {m.from_support ? (m.author_name || 'Bermi Techs') : (m.author_name || inquiry.owner_name || 'Client')}
                {' · '}
                {new Date(m.created_at).toLocaleString()}
              </div>
              <div style={{ marginTop: 5, fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{m.body}</div>
            </div>
          ))}
        </div>

        <textarea
          rows={4}
          className="hq-input"
          placeholder={T.reply}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          style={{ resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="hq-nav-item"
            style={{ justifyContent: 'center', border: '1px solid var(--line)', fontSize: 12.5 }}
            disabled={busy}
            onClick={resolve}
          >
            {T.markResolved}
          </button>
          <button
            className="hq-nav-item"
            style={{ justifyContent: 'center', background: 'var(--brand)', color: 'var(--brandInk)', fontWeight: 800 }}
            disabled={busy || !reply.trim()}
            onClick={send}
          >
            {T.reply}
          </button>
        </div>
      </aside>
    </>
  );
}
