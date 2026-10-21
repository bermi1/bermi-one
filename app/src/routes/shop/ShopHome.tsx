import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../lib/icons';
import { useSettings } from '../../lib/useSettings';
import { supabase } from '../../lib/supabase';
import { useData } from '../../state/DataContext';
import { useToast } from '../../state/ToastContext';
import { qrDataUrl, shopPoster, shopUrl, shopUrlShort } from '../../lib/shopLink';

/**
 * A shop's home: its address on the web, the QR that opens it, and the two
 * details a customer needs to order — where to send the WhatsApp message, and
 * one line about the shop. The link is made from the shop's name the first
 * time this screen opens.
 */
export function ShopHome() {
  const nav = useNavigate();
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const { activeBusiness, updateBusiness } = useData();
  const { flash } = useToast();
  const [slug, setSlug] = useState<string | null>(activeBusiness?.slug || null);
  const [qr, setQr] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ all: number; out: number } | null>(null);
  const shop = activeBusiness?.settings?.shop || {};
  const [whatsapp, setWhatsapp] = useState(shop.whatsapp || '');
  const [tagline, setTagline] = useState(shop.tagline || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!activeBusiness || slug) return;
    void supabase.rpc('ensure_business_slug', { p_business: activeBusiness.id }).then(({ data, error }) => {
      if (!error && data) setSlug(data as string);
    });
  }, [activeBusiness, slug]);

  useEffect(() => { if (slug) void qrDataUrl(shopUrl(slug), 480).then(setQr); }, [slug]);

  useEffect(() => {
    if (!activeBusiness) return;
    void supabase.from('shop_products').select('track_stock, stock').eq('business_id', activeBusiness.id).eq('active', true)
      .then(({ data }) => {
        const rows = (data || []) as { track_stock: boolean; stock: number }[];
        setCounts({ all: rows.length, out: rows.filter((r) => r.track_stock && Number(r.stock) <= 0).length });
      });
  }, [activeBusiness]);

  const link = slug ? shopUrl(slug) : '';

  async function copy() {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); flash(sw ? 'Link imenakiliwa' : 'Link copied'); } catch { flash(link); }
  }

  async function share() {
    if (!link) return;
    const text = sw ? `Karibu ${activeBusiness?.name || ''} — ona bidhaa na uagize hapa: ${link}` : `Shop ${activeBusiness?.name || ''} — see what we have and order here: ${link}`;
    if (navigator.share) { try { await navigator.share({ title: activeBusiness?.name, text, url: link }); return; } catch { /* fall back to WhatsApp */ } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  async function poster() {
    if (!slug || !activeBusiness) return;
    const blob = await shopPoster(activeBusiness.name, slug, sw);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-qr.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function saveDetails() {
    if (!activeBusiness) return;
    setBusy(true);
    await updateBusiness({ settings: { ...(activeBusiness.settings || {}), shop: { ...shop, whatsapp: whatsapp.trim(), tagline: tagline.trim() } } });
    setBusy(false);
    flash(sw ? 'Imehifadhiwa' : 'Saved');
  }

  return (
    <div className="screen sb">
      <ScreenHeader title={activeBusiness?.name || ''} sub={sw ? 'Duka lako mtandaoni' : 'Your shop online'} />

      <div id="shop-link-card" className="card" style={{ padding: 18, textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{sw ? 'Link ya duka lako' : 'Your shop link'}</div>
        <div id="shop-link" style={{ marginTop: 6, fontSize: 18, fontWeight: 800, wordBreak: 'break-all' }}>{slug ? shopUrlShort(slug) : '…'}</div>
        {qr && <img id="shop-qr" src={qr} alt="QR" width={200} height={200} style={{ display: 'block', margin: '14px auto 4px', borderRadius: 12, border: '1px solid var(--line)' }} />}
        <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600 }}>{sw ? 'Wateja wakipiga picha QR hii wanaona bidhaa zako' : 'Customers scan this to see your products'}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button type="button" className="btn-ghost tap" style={{ flex: 1, padding: '12px 0' }} onClick={() => void copy()} disabled={!slug}><Icon name="copy" size={14} /> {sw ? 'Nakili' : 'Copy'}</button>
          <button type="button" className="btn-primary tap" style={{ flex: 1, padding: '12px 0' }} onClick={() => void share()} disabled={!slug}><Icon name="share" size={14} /> {sw ? 'Tuma' : 'Share'}</button>
        </div>
        <button id="shop-poster" type="button" className="btn-ghost tap" style={{ width: '100%', marginTop: 8, padding: '12px 0' }} onClick={() => void poster()} disabled={!slug}>
          <Icon name="download" size={14} /> {sw ? 'Pakua bango la QR (kuchapisha)' : 'Download QR poster (to print)'}
        </button>
        {slug && <a href={link} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 10, fontSize: 12.5, fontWeight: 800, color: 'var(--brand)' }}>{sw ? 'Fungua duka kama mteja →' : 'Open it as a customer →'}</a>}
      </div>

      <div className="card tap" style={{ padding: 16, marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }} onClick={() => nav('/products')}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--brandSoft)', color: 'var(--brand)', display: 'grid', placeItems: 'center' }}><Icon name="tag" size={17} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800 }}>{sw ? 'Bidhaa' : 'Products'}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600 }}>
            {counts === null ? '…' : counts.all === 0 ? (sw ? 'Ongeza bidhaa ya kwanza ili duka lionekane' : 'Add your first product so the shop shows something')
              : `${counts.all} ${sw ? 'bidhaa' : 'products'}${counts.out ? ` · ${counts.out} ${sw ? 'zimeisha' : 'sold out'}` : ''}`}
          </div>
        </div>
        <Icon name="right" size={16} style={{ color: 'var(--ink3)' }} />
      </div>

      <div className="card" style={{ padding: 16, marginTop: 12 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800 }}>{sw ? 'Wateja wakuagize wapi?' : 'Where customers order'}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600, marginTop: 2 }}>{sw ? 'Oda zinakuja kama ujumbe wa WhatsApp kwenye namba hii' : 'Orders arrive as a WhatsApp message to this number'}</div>
        <input className="field" style={{ marginTop: 10 }} inputMode="tel" placeholder={sw ? 'Namba ya WhatsApp, mfano 0754 000 000' : 'WhatsApp number, e.g. 0754 000 000'} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        <input className="field" style={{ marginTop: 8 }} maxLength={90} placeholder={sw ? 'Sentensi moja kuhusu duka (si lazima)' : 'One line about the shop (optional)'} value={tagline} onChange={(e) => setTagline(e.target.value)} />
        <button type="button" className="btn-primary tap" style={{ width: '100%', marginTop: 10 }} data-disabled={busy} onClick={() => void saveDetails()}>{sw ? 'Hifadhi' : 'Save'}</button>
      </div>
    </div>
  );
}
