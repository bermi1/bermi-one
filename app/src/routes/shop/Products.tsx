import { useEffect, useMemo, useRef, useState } from 'react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../lib/icons';
import { useSettings } from '../../lib/useSettings';
import { useData } from '../../state/DataContext';
import { useShop } from '../../state/ShopContext';
import { useToast } from '../../state/ToastContext';
import { buildRows, parseTable } from '../../lib/csv';
import { isLow, productPerformance, storeUrl, type ShopProduct } from '../../lib/shop';
import { productShareCard, shareImage } from '../../lib/shopMedia';

/**
 * The catalogue and the stock room in one place: what is sold, what it costs,
 * how many are left, and the trail of every unit that came in or went out.
 */
export function Products() {
  const { lang, fmt, owner } = useSettings();
  const sw = lang === 'sw';
  const { products, loaded, orders } = useShop();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'all' | 'low' | 'hidden'>('all');
  const [edit, setEdit] = useState<ShopProduct | 'new' | null>(null);
  const [view, setView] = useState<ShopProduct | null>(null);
  const [importing, setImporting] = useState(false);

  const sold = useMemo(() => new Map(productPerformance(orders).map((p) => [p.product_id, p.qty])), [orders]);
  const low = products.filter((p) => p.active && isLow(p));
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = tab === 'low' ? low : tab === 'hidden' ? products.filter((p) => !p.active || !p.online) : products.filter((p) => p.active);
    return s ? base.filter((p) => p.name.toLowerCase().includes(s) || (p.category || '').toLowerCase().includes(s) || (p.sku || '').toLowerCase() === s || p.barcode === s) : base;
  }, [products, low, tab, q]);
  const current = view ? products.find((p) => p.id === view.id) || view : null;

  function exportCsv() {
    const head = ['name', 'category', 'price', 'compare_at_price', 'cost', 'sku', 'barcode', 'stock', 'low_stock', 'online'];
    const cell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [head.join(','), ...products.map((p) => head.map((h) => cell(p[h as keyof ShopProduct])).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = 'products.csv';
    a.click();
  }

  return (
    <div className="screen sb has-fab">
      <ScreenHeader title={sw ? 'Bidhaa' : 'Products'} sub={`${products.filter((p) => p.active).length} ${sw ? 'bidhaa' : 'products'}${low.length ? ` · ${low.length} ${sw ? 'zinakaribia kuisha' : 'running low'}` : ''}`}
        right={owner ? (
          <>
            <button type="button" className="icon-btn tap" aria-label={sw ? 'Pakia CSV' : 'Import CSV'} onClick={() => setImporting(true)}><Icon name="upload" size={16} /></button>
            <button type="button" className="icon-btn tap" aria-label={sw ? 'Pakua CSV' : 'Export CSV'} onClick={exportCsv}><Icon name="download" size={16} /></button>
          </>
        ) : undefined} />
      <input className="s-input" style={{ marginTop: 6 }} placeholder={sw ? 'Tafuta bidhaa, kundi au barcode…' : 'Search name, category or barcode…'} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="s-seg" style={{ marginTop: 10 }}>
        <button type="button" aria-pressed={tab === 'all'} onClick={() => setTab('all')}>{sw ? 'Zote' : 'All'}</button>
        <button type="button" aria-pressed={tab === 'low'} onClick={() => setTab('low')}>{sw ? 'Zinaisha' : 'Low stock'}{low.length ? ` (${low.length})` : ''}</button>
        <button type="button" aria-pressed={tab === 'hidden'} onClick={() => setTab('hidden')}>{sw ? 'Zilizofichwa' : 'Hidden'}</button>
      </div>

      {!loaded ? <div className="skeleton" style={{ height: 240, marginTop: 12 }} /> : list.length === 0 ? (
        <div className="card empty" style={{ marginTop: 12 }}>
          {products.length === 0 ? (sw ? 'Ongeza bidhaa yako ya kwanza — picha, bei na idadi iliyopo.' : 'Add your first product — a photo, a price and how many you have.') : (sw ? 'Hakuna kinacholingana.' : 'Nothing matches.')}
        </div>
      ) : (
        <div className="card" style={{ marginTop: 12, padding: '2px 12px' }}>
          {list.map((p, i) => (
            <div key={p.id} className="s-row tap" onClick={() => setView(p)} style={{ padding: '10px 0', borderTop: i ? '1px solid var(--line)' : undefined }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, overflow: 'hidden', background: 'var(--card2)', display: 'grid', placeItems: 'center', color: 'var(--ink3)', flexShrink: 0 }}>
                {p.images?.[0] ? <img src={p.images[0]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="tag" size={18} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>
                  {p.category || (sw ? 'Bila kundi' : 'No category')}{sold.get(p.id) ? ` · ${sold.get(p.id)} ${sw ? 'zimeuzwa' : 'sold'} (35d)` : ''}{!p.online ? ` · ${sw ? 'dukani tu' : 'in-store only'}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{fmt(Number(p.price))}</div>
                {p.track_stock && (
                  <span className="s-badge" style={{ background: p.stock <= 0 ? 'var(--badSoft)' : isLow(p) ? 'var(--warnSoft)' : 'var(--card2)', color: p.stock <= 0 ? 'var(--bad)' : isLow(p) ? 'var(--warn)' : 'var(--ink2)' }}>
                    {p.stock <= 0 ? (sw ? 'imeisha' : 'out') : `${p.stock} ${sw ? 'zipo' : 'left'}`}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {owner && (
        <button type="button" className="s-fab tap" onClick={() => setEdit('new')}><Icon name="plus" size={16} /> {sw ? 'Bidhaa' : 'Product'}</button>
      )}

      {current && !edit && <ProductDetail p={current} onClose={() => setView(null)} onEdit={() => setEdit(current)} />}
      {edit && <ProductEditor p={edit === 'new' ? null : edit} categories={[...new Set(products.map((p) => p.category).filter(Boolean) as string[])]} onClose={() => setEdit(null)} />}
      <ImportSheet open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}

function ProductDetail({ p, onClose, onEdit }: { p: ShopProduct; onClose: () => void; onEdit: () => void }) {
  const { lang, fmt, owner } = useSettings();
  const sw = lang === 'sw';
  const { activeBusiness } = useData();
  const { adjustStock, stockMoves, ensureSlug, settings } = useShop();
  const { flash } = useToast();
  const [mode, setMode] = useState<'restock' | 'adjust' | null>(null);
  const [n, setN] = useState('');
  const [note, setNote] = useState('');
  const [moves, setMoves] = useState<Awaited<ReturnType<typeof stockMoves>>>([]);
  const [sharing, setSharing] = useState(false);

  useEffect(() => { void stockMoves(p.id).then(setMoves); }, [p.id, p.stock, stockMoves]);

  async function save() {
    const v = Number(n);
    if (!v) return;
    const delta = mode === 'restock' ? Math.abs(v) : v - p.stock;
    if (mode === 'adjust' && !delta) { setMode(null); return; }
    const err = await adjustStock(p.id, delta, mode === 'restock' ? 'restock' : 'adjust', note);
    if (err) { flash(err); return; }
    flash(sw ? 'Stoo imesasishwa' : 'Stock updated');
    setMode(null); setN(''); setNote('');
  }

  async function share() {
    setSharing(true);
    const slug = await ensureSlug();
    const url = storeUrl(slug, `/p/${p.slug || p.id}`);
    const was = p.compare_at_price && Number(p.compare_at_price) > Number(p.price) ? fmt(Number(p.compare_at_price)) : null;
    const off = was ? Math.round((1 - Number(p.price) / Number(p.compare_at_price)) * 100) : 0;
    const blob = await productShareCard({ image: p.images?.[0], name: p.name, price: fmt(Number(p.price)), was, shop: activeBusiness?.name || '', url, color: settings.color, badge: off >= 5 ? `-${off}%` : null });
    const how = await shareImage(blob, `${p.slug || 'product'}.png`, `${p.name} — ${fmt(Number(p.price))}`, url);
    setSharing(false);
    if (how === 'downloaded') {
      try { await navigator.clipboard.writeText(url); } catch { /* clipboard blocked */ }
      flash(sw ? 'Picha imehifadhiwa, kiungo kimenakiliwa' : 'Card saved, link copied');
    }
  }

  const reasonLabel: Record<string, string> = sw
    ? { sale: 'Mauzo', online: 'Mtandaoni', restock: 'Mzigo mpya', adjust: 'Marekebisho', return: 'Rejesho', cancel: 'Imeghairiwa', opening: 'Mwanzo' }
    : { sale: 'Sold', online: 'Online order', restock: 'Restock', adjust: 'Count fix', return: 'Return', cancel: 'Cancelled', opening: 'Opening' };

  return (
    <Sheet open onClose={onClose} title={p.name} sub={`${p.category || ''}${p.sku ? ` · ${p.sku}` : ''}`}>
      {p.images?.[0] && <img src={p.images[0]} alt="" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 16 }} />}
      <div className="s-kpis" style={{ marginTop: 10 }}>
        <div className="s-kpi"><span>{sw ? 'Bei' : 'Price'}</span><b>{fmt(Number(p.price))}</b></div>
        <div className="s-kpi"><span>{sw ? 'Stoo' : 'In stock'}</span><b style={{ color: isLow(p) ? 'var(--warn)' : undefined }}>{p.track_stock ? p.stock : '∞'}</b></div>
        <div className="s-kpi"><span>{sw ? 'Faida/kipande' : 'Margin'}</span><b>{owner && p.cost != null ? fmt(Number(p.price) - Number(p.cost)) : '—'}</b></div>
      </div>

      {p.track_stock && (mode ? (
        <div className="card" style={{ marginTop: 12, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{mode === 'restock' ? (sw ? 'Zimeingia ngapi?' : 'How many came in?') : (sw ? 'Ulihesabu ngapi?' : 'How many did you count?')}</div>
          <input className="field" inputMode="numeric" autoFocus value={n} onChange={(e) => setN(e.target.value)} placeholder={mode === 'restock' ? '12' : String(p.stock)} />
          <input className="field" style={{ marginTop: 8 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder={sw ? 'Maelezo (msambazaji, sababu…)' : 'Note (supplier, reason…)'} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginTop: 10 }}>
            <button type="button" className="btn-ghost tap" onClick={() => setMode(null)}>{sw ? 'Ghairi' : 'Cancel'}</button>
            <button type="button" className="btn-primary tap" style={{ border: 'none' }} onClick={save}>{sw ? 'Hifadhi' : 'Save'}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          <button type="button" className="btn-primary tap" style={{ border: 'none' }} onClick={() => setMode('restock')}><Icon name="in" size={15} /> {sw ? 'Ongeza stoo' : 'Restock'}</button>
          <button type="button" className="btn-ghost tap" onClick={() => setMode('adjust')}><Icon name="edit" size={15} /> {sw ? 'Rekebisha hesabu' : 'Fix count'}</button>
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: owner ? '1fr 1fr' : '1fr', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn-ghost tap" disabled={sharing} onClick={share}><Icon name="share" size={15} /> {sharing ? '…' : (sw ? 'Shiriki (Instagram/WhatsApp)' : 'Share card')}</button>
        {owner && <button type="button" className="btn-ghost tap" onClick={onEdit}><Icon name="edit" size={15} /> {sw ? 'Hariri' : 'Edit'}</button>}
      </div>

      {moves.length > 0 && (
        <>
          <div className="section-label">{sw ? 'Historia ya stoo' : 'Stock history'}</div>
          <div className="card" style={{ padding: '2px 12px' }}>
            {moves.slice(0, 30).map((m, i) => (
              <div key={m.id} className="s-row" style={{ padding: '8px 0', borderTop: i ? '1px solid var(--line)' : undefined, fontSize: 12.5, fontWeight: 700 }}>
                <span style={{ width: 46, fontWeight: 800, color: m.delta > 0 ? 'var(--ok)' : 'var(--bad)' }}>{m.delta > 0 ? '+' : ''}{m.delta}</span>
                <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{reasonLabel[m.reason] || m.reason}{m.note ? ` · ${m.note}` : ''}{m.by_name ? ` · ${m.by_name}` : ''}</span>
                <span style={{ color: 'var(--ink3)' }}>{new Date(m.created_at).toLocaleDateString()}</span>
                <span style={{ width: 36, textAlign: 'right', color: 'var(--ink2)' }}>{m.stock_after ?? ''}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

function ProductEditor({ p, categories, onClose }: { p: ShopProduct | null; categories: string[]; onClose: () => void }) {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const { saveProduct, uploadImage } = useShop();
  const { flash } = useToast();
  const [f, setF] = useState({
    name: p?.name || '', description: p?.description || '', category: p?.category || '', price: p ? String(p.price) : '',
    compare_at_price: p?.compare_at_price ? String(p.compare_at_price) : '', cost: p?.cost != null ? String(p.cost) : '',
    sku: p?.sku || '', barcode: p?.barcode || '', low_stock: String(p?.low_stock ?? 3), opening: '',
    track_stock: p?.track_stock ?? true, online: p?.online ?? true, featured: p?.featured ?? false, active: p?.active ?? true,
  });
  const [images, setImages] = useState<string[]>(p?.images || []);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files || [])].slice(0, 6 - images.length);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const r = await uploadImage(file);
      if (typeof r === 'string') setImages((xs) => [...xs, r]); else flash(r.error);
    }
    setUploading(false);
  }

  async function save() {
    if (f.name.trim().length < 1 || !(Number(f.price) >= 0) || f.price === '') { flash(sw ? 'Weka jina na bei' : 'Enter a name and a price'); return; }
    setBusy(true);
    const r = await saveProduct({
      id: p?.id, name: f.name, description: f.description, category: f.category, price: Number(f.price),
      compare_at_price: f.compare_at_price ? Number(f.compare_at_price) : null, cost: f.cost === '' ? null : Number(f.cost),
      sku: f.sku, barcode: f.barcode, low_stock: Number(f.low_stock) || 0, track_stock: f.track_stock, online: f.online, featured: f.featured, active: f.active, images,
    }, p ? undefined : Number(f.opening) || 0);
    setBusy(false);
    if ('error' in r) { flash(r.error); return; }
    flash(sw ? 'Imehifadhiwa' : 'Saved');
    onClose();
  }

  const Toggle = ({ k, label, hint }: { k: 'track_stock' | 'online' | 'featured' | 'active'; label: string; hint?: string }) => (
    <label className="s-row tap" style={{ padding: '10px 0', borderTop: '1px solid var(--line)', cursor: 'pointer' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800 }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600 }}>{hint}</div>}
      </div>
      <input type="checkbox" checked={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.checked }))} style={{ width: 20, height: 20, accentColor: 'var(--brand)' }} />
    </label>
  );

  return (
    <Sheet open onClose={onClose} title={p ? (sw ? 'Hariri bidhaa' : 'Edit product') : (sw ? 'Bidhaa mpya' : 'New product')}>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {images.map((src, i) => (
          <div key={src} style={{ position: 'relative', flexShrink: 0 }}>
            <img src={src} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 14, outline: i === 0 ? '2px solid var(--brand)' : undefined }} />
            <button type="button" className="mini-btn tap" aria-label={sw ? 'Ondoa picha' : 'Remove photo'} onClick={() => setImages((xs) => xs.filter((x) => x !== src))} style={{ position: 'absolute', top: 4, right: 4 }}><Icon name="x" size={12} /></button>
          </div>
        ))}
        {images.length < 6 && (
          <button type="button" className="tap" onClick={() => fileRef.current?.click()} style={{ width: 84, height: 84, flexShrink: 0, borderRadius: 14, border: '1.5px dashed var(--line)', color: 'var(--ink3)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>
            {uploading ? '…' : <span style={{ display: 'grid', placeItems: 'center', gap: 2 }}><Icon name="image" size={20} />{sw ? 'Picha' : 'Photo'}</span>}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pick} />
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        <input className="field" placeholder={sw ? 'Jina la bidhaa' : 'Product name'} value={f.name} onChange={set('name')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input className="field" inputMode="numeric" placeholder={sw ? 'Bei' : 'Price'} value={f.price} onChange={set('price')} />
          <input className="field" inputMode="numeric" placeholder={sw ? 'Bei ya zamani (ofa)' : 'Was (for a sale)'} value={f.compare_at_price} onChange={set('compare_at_price')} />
        </div>
        <input className="field" list="shop-cats" placeholder={sw ? 'Kundi (mf. Viatu)' : 'Category (e.g. Shoes)'} value={f.category} onChange={set('category')} />
        <datalist id="shop-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        <textarea className="field" rows={3} placeholder={sw ? 'Maelezo kwa wateja wa mtandaoni' : 'Description for online shoppers'} value={f.description} onChange={set('description')} />
        <div style={{ display: 'grid', gridTemplateColumns: p ? '1fr 1fr' : '1fr 1fr 1fr', gap: 8 }}>
          {!p && <input className="field" inputMode="numeric" placeholder={sw ? 'Idadi iliyopo' : 'In stock now'} value={f.opening} onChange={set('opening')} />}
          <input className="field" inputMode="numeric" placeholder={sw ? 'Tahadhari ikifika' : 'Alert at'} value={f.low_stock} onChange={set('low_stock')} />
          <input className="field" inputMode="numeric" placeholder={sw ? 'Gharama (hiari)' : 'Cost (optional)'} value={f.cost} onChange={set('cost')} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input className="field" placeholder="SKU" value={f.sku} onChange={set('sku')} />
          <input className="field" inputMode="numeric" placeholder="Barcode" value={f.barcode} onChange={set('barcode')} />
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <Toggle k="online" label={sw ? 'Iuze mtandaoni' : 'Sell online'} hint={sw ? 'Ionekane kwenye duka lako la mtandaoni' : 'Show it in your online store'} />
        <Toggle k="featured" label={sw ? 'Iangazie' : 'Feature it'} hint={sw ? 'Juu kabisa kwenye duka' : 'First in the store'} />
        <Toggle k="track_stock" label={sw ? 'Fuatilia stoo' : 'Track stock'} hint={sw ? 'Zima kwa huduma au bidhaa zisizoisha' : 'Turn off for services or made-to-order'} />
        {p && <Toggle k="active" label={sw ? 'Inauzwa' : 'For sale'} hint={sw ? 'Zima kuificha kila mahali' : 'Turn off to hide it everywhere'} />}
      </div>
      <button type="button" className="btn-primary tap" disabled={busy || uploading} style={{ width: '100%', marginTop: 12, border: 'none' }} onClick={save}>{busy ? '…' : (sw ? 'Hifadhi' : 'Save')}</button>
    </Sheet>
  );
}

function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const { saveProduct, products } = useShop();
  const { flash } = useToast();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const t = parseTable(await file.text());
    const { rows, errors } = buildRows(t.rows, t.columnMap);
    if (!rows.length) { setMsg(errors[0] || (sw ? 'Hakuna safu zilizosomeka' : 'No readable rows')); return; }
    // Cost comes only from a cost column the file actually has — never worked out from anything else.
    const hasCost = t.columnMap.includes('cost');
    setBusy(true);
    let added = 0;
    const have = new Set(products.map((p) => p.name.toLowerCase()));
    for (const r of rows.slice(0, 1000)) {
      if (have.has(r.name.toLowerCase())) continue;
      const out = await saveProduct({ name: r.name, category: r.cat || null, price: r.price, cost: hasCost ? r.cost : null, low_stock: r.low || 3 }, r.opening || 0);
      if (!('error' in out)) added++;
    }
    setBusy(false);
    setMsg(sw ? `Bidhaa ${added} zimeongezwa` : `${added} products added`);
    flash(sw ? 'Imekamilika' : 'Import done');
  }

  return (
    <Sheet open={open} onClose={onClose} title={sw ? 'Pakia bidhaa (CSV)' : 'Import products (CSV)'} sub={sw ? 'Safu: jina, kundi, bei, idadi, gharama' : 'Columns: name, category, price, stock, cost'}>
      <label className="btn-primary tap" style={{ display: 'block', textAlign: 'center', border: 'none', cursor: 'pointer' }}>
        {busy ? (sw ? 'Inapakia…' : 'Importing…') : (sw ? 'Chagua faili ya CSV' : 'Choose a CSV file')}
        <input type="file" accept=".csv,text/csv,.txt" hidden disabled={busy} onChange={onFile} />
      </label>
      {msg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: 'var(--ink2)' }}>{msg}</div>}
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink3)', fontWeight: 600, lineHeight: 1.5 }}>
        {sw ? 'Bidhaa zenye jina lililopo tayari zinarukwa. Picha unaongeza baadaye.' : 'Products whose name already exists are skipped. Add photos afterwards.'}
      </div>
    </Sheet>
  );
}
