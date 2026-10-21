import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { waNumber } from '../lib/shopLink';
import { loadScreen } from '../lib/routeChunks';

const Book = lazy(() => loadScreen('book').then((m) => ({ default: m.Book })));

interface PublicProduct { id: string; name: string; category: string | null; price: number; image: string | null; in_stock: boolean }
interface PublicShop { name: string; city: string | null; tagline: string | null; whatsapp: string | null; phone: string | null; color: string | null; products: PublicProduct[] }
type Page = { kind: 'shop'; shop: PublicShop } | { kind: 'booking' } | null;

const tsh = (n: number) => `TSh ${Math.round(n).toLocaleString('en-US')}`;

/**
 * bermione.com/<name>: what a customer sees after scanning the shop's QR or
 * tapping its link. A barbershop's name opens its booking page; a shop's opens
 * this — its products and prices, a basket, and the order sent as a WhatsApp
 * message to the shop, the way people here already buy. Light on purpose: one
 * request, small photos, no sign-in.
 */
export function ShopPage() {
  const { slug = '' } = useParams();
  const [page, setPage] = useState<Page | undefined>(undefined);
  const [sw, setSw] = useState(() => {
    try { const l = localStorage.getItem('bermi:lang'); if (l) return l === 'sw'; } catch { /* private mode */ }
    return typeof navigator !== 'undefined' && /^sw/i.test(navigator.language || '');
  });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cat, setCat] = useState<string | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    window.__bermiReady?.();
    void supabase.rpc('public_page', { p_slug: slug.toLowerCase() }).then(({ data, error }) => setPage(error ? null : (data as Page)));
  }, [slug]);

  const shop = page && page.kind === 'shop' ? page.shop : null;
  useEffect(() => { if (shop) document.title = `${shop.name} · Bermi One`; }, [shop]);

  const cats = useMemo(() => [...new Set((shop?.products || []).map((p) => p.category).filter(Boolean) as string[])], [shop]);
  const shown = (shop?.products || []).filter((p) => !cat || p.category === cat);
  const lines = (shop?.products || []).filter((p) => cart[p.id]).map((p) => ({ p, n: cart[p.id] }));
  const total = lines.reduce((s, l) => s + l.n * Number(l.p.price), 0);
  const count = lines.reduce((s, l) => s + l.n, 0);
  const add = (id: string, d: number) => setCart((c) => { const n = Math.max(0, (c[id] || 0) + d); const next = { ...c, [id]: n }; if (!n) delete next[id]; return next; });

  if (page === undefined) return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', color: '#8a93a6' }}>…</div>;
  if (page && page.kind === 'booking') return <Suspense fallback={null}><Book /></Suspense>;
  if (!shop) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', background: 'var(--bg)' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{sw ? 'Duka hili halipatikani' : 'This shop was not found'}</div>
          <div style={{ marginTop: 6, color: 'var(--ink3)', fontSize: 13 }}>bermione.com/{slug}</div>
        </div>
      </div>
    );
  }

  const to = waNumber(shop.whatsapp || shop.phone);
  const order = () => {
    const text = [
      sw ? `Habari ${shop.name}, ningependa kuagiza:` : `Hello ${shop.name}, I would like to order:`,
      ...lines.map((l) => `• ${l.n} × ${l.p.name} — ${tsh(l.n * Number(l.p.price))}`),
      `${sw ? 'Jumla' : 'Total'}: ${tsh(total)}`,
      ...(name.trim() ? [`${sw ? 'Jina' : 'Name'}: ${name.trim()}`] : []),
    ].join('\n');
    window.open(`https://wa.me/${to}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div id="shop-page" style={{ minHeight: '100dvh', background: 'var(--bg)', paddingBottom: count ? 150 : 30 }}>
      <header style={{ background: shop.color || 'var(--grad)', color: '#fff', padding: '26px 16px 22px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{shop.name}</h1>
            {(shop.tagline || shop.city) && <div style={{ marginTop: 4, fontSize: 13.5, opacity: 0.85 }}>{shop.tagline || shop.city}</div>}
          </div>
          <button type="button" onClick={() => setSw(!sw)} style={{ padding: '6px 10px', borderRadius: 10, background: 'rgba(255,255,255,.18)', color: '#fff', fontSize: 11.5, fontWeight: 800 }}>{sw ? 'EN' : 'SW'}</button>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '14px 16px' }}>
        {cats.length > 1 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6 }}>
            {[null, ...cats].map((c) => (
              <button key={c ?? 'all'} type="button" onClick={() => setCat(c)}
                style={{ padding: '7px 12px', borderRadius: 999, whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 700, border: '1px solid var(--line)', background: cat === c ? 'var(--ink)' : 'var(--card)', color: cat === c ? 'var(--bg)' : 'var(--ink2)' }}>
                {c ?? (sw ? 'Zote' : 'All')}
              </button>
            ))}
          </div>
        )}
        {shown.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink3)' }}>{sw ? 'Bidhaa zitaonekana hapa hivi karibuni.' : 'Products will appear here soon.'}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginTop: 8 }}>
          {shown.map((p) => (
            <div key={p.id} className="card shop-item" style={{ padding: 0, overflow: 'hidden', opacity: p.in_stock ? 1 : 0.55 }}>
              <div style={{ aspectRatio: '1 / 1', background: 'var(--card2)' }}>
                {p.image && <img src={p.image} alt={p.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
              </div>
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.25 }}>{p.name}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)', marginTop: 3 }}>{tsh(Number(p.price))}</div>
                {!p.in_stock ? <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: 'var(--bad)' }}>{sw ? 'Imeisha' : 'Sold out'}</div>
                  : cart[p.id] ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                      <button type="button" aria-label="-" onClick={() => add(p.id, -1)} style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--card2)', fontWeight: 800 }}>−</button>
                      <b>{cart[p.id]}</b>
                      <button type="button" aria-label="+" onClick={() => add(p.id, 1)} style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--card2)', fontWeight: 800 }}>+</button>
                    </div>
                  ) : <button type="button" className="add-to-cart" onClick={() => add(p.id, 1)} style={{ marginTop: 8, width: '100%', padding: '8px 0', borderRadius: 10, background: 'var(--brandSoft)', color: 'var(--brand)', fontWeight: 800, fontSize: 12.5 }}>{sw ? 'Ongeza' : 'Add'}</button>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11.5, color: 'var(--ink3)' }}>Bermi One</div>
      </main>

      {count > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'var(--card)', borderTop: '1px solid var(--line)', padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', boxShadow: '0 -10px 30px rgba(10,16,32,.08)' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={sw ? 'Jina lako (si lazima)' : 'Your name (optional)'} className="field" style={{ marginBottom: 8 }} />
            <button id="order-wa" type="button" onClick={order} disabled={!to}
              style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: '#25D366', color: '#fff', fontWeight: 800, fontSize: 15 }}>
              {to ? (sw ? `Agiza kwa WhatsApp · ${count} · ${tsh(total)}` : `Order on WhatsApp · ${count} · ${tsh(total)}`) : (sw ? 'Duka bado halijaweka namba ya WhatsApp' : 'The shop has not added a WhatsApp number yet')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
