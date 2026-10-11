import { useState } from 'react';
import { Icon } from '../../lib/icons';
import { useSettings } from '../../lib/useSettings';
import { useData } from '../../state/DataContext';
import { useSalon } from '../../state/SalonContext';
import { useToast } from '../../state/ToastContext';

/**
 * The shop's public booking link: one tap to copy or send on WhatsApp, for the
 * Instagram bio, the status, the poster on the mirror. Created the first time
 * someone asks for it, from the shop's name.
 */
export function BookingLinkCard({ compact }: { compact?: boolean }) {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const { activeBusiness } = useData();
  const { ensureSlug } = useSalon();
  const { flash } = useToast();
  const [slug, setSlug] = useState<string | null>(activeBusiness?.slug || null);
  const [busy, setBusy] = useState(false);
  const url = slug ? `${window.location.origin}/book/${slug}` : null;

  async function get() {
    if (slug) return slug;
    setBusy(true);
    const s = await ensureSlug();
    setBusy(false);
    if (!s) { flash(sw ? 'Imeshindwa kuunda kiungo' : 'Could not create the link'); return null; }
    setSlug(s);
    return s;
  }

  async function copy() {
    const s = await get();
    if (!s) return;
    const link = `${window.location.origin}/book/${s}`;
    try { await navigator.clipboard.writeText(link); flash(sw ? 'Kiungo kimenakiliwa' : 'Link copied'); } catch { flash(link); }
  }

  async function share() {
    const s = await get();
    if (!s) return;
    const link = `${window.location.origin}/book/${s}`;
    const text = sw ? `Weka miadi ${activeBusiness?.name || ''} hapa: ${link}` : `Book your next cut at ${activeBusiness?.name || ''}: ${link}`;
    if (navigator.share) {
      try { await navigator.share({ title: activeBusiness?.name, text, url: link }); return; } catch { /* fall through to WhatsApp */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  return (
    <div className="card" style={{ marginTop: compact ? 4 : 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--brandSoft)', color: 'var(--brand)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="link" size={17} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800 }}>{sw ? 'Kiungo cha kuweka miadi' : 'Online booking link'}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {url ? url.replace(/^https?:\/\//, '') : (sw ? 'Wateja wajiwekee miadi wenyewe' : 'Let clients book themselves, 24/7')}
        </div>
      </div>
      <button type="button" className="icon-btn tap" aria-label={sw ? 'Nakili' : 'Copy'} onClick={copy} data-disabled={busy}><Icon name="copy" size={15} /></button>
      <button type="button" className="icon-btn tap" aria-label={sw ? 'Shiriki' : 'Share'} onClick={share} style={{ background: 'var(--grad)', color: '#fff', border: 'none' }}><Icon name="share" size={15} /></button>
    </div>
  );
}
