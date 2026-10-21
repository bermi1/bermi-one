import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../lib/icons';
import { useSettings } from '../../lib/useSettings';
import { supabase } from '../../lib/supabase';
import { useData } from '../../state/DataContext';
import { useToast } from '../../state/ToastContext';
import { shrinkImage } from '../../lib/shopLink';

export interface ShopItem {
  id: string; name: string; category: string | null; price: number; images: string[] | null;
  track_stock: boolean; stock: number; online: boolean; active: boolean;
}

/** Sold out is the one stock fact the shop page needs; counted stock comes with the POS. */
export const inStock = (p: Pick<ShopItem, 'track_stock' | 'stock'>) => !p.track_stock || Number(p.stock) > 0;

/**
 * What the shop sells, as customers see it on the shop page: a photo, a
 * name, a price, and whether it is in stock right now.
 */
export function Products() {
  const { lang, fmt } = useSettings();
  const sw = lang === 'sw';
  const { activeBusiness } = useData();
  const { flash } = useToast();
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<ShopItem | 'new' | null>(null);

  const load = useCallback(async () => {
    if (!activeBusiness) return;
    const { data } = await supabase.from('shop_products')
      .select('id, name, category, price, images, track_stock, stock, online, active')
      .eq('business_id', activeBusiness.id).eq('active', true).order('sort_order').order('name');
    setItems((data || []) as ShopItem[]);
  }, [activeBusiness]);
  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (items || []).filter((p) => !s || p.name.toLowerCase().includes(s) || (p.category || '').toLowerCase().includes(s));
  }, [items, q]);

  async function toggleStock(p: ShopItem) {
    const nowIn = inStock(p);
    const patch = nowIn ? { track_stock: true, stock: 0 } : { track_stock: false };
    setItems((xs) => (xs || []).map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('shop_products').update(patch).eq('id', p.id);
    if (error) { flash(error.message); void load(); }
  }

  return (
    <div className="screen sb has-fab">
      <ScreenHeader title={sw ? 'Bidhaa' : 'Products'} sub={items ? `${items.length} ${sw ? 'bidhaa' : 'products'}` : ''} />
      <input className="field" placeholder={sw ? 'Tafuta bidhaa…' : 'Search products…'} value={q} onChange={(e) => setQ(e.target.value)} />

      {items === null ? <div className="skeleton" style={{ height: 200, marginTop: 12 }} /> : list.length === 0 ? (
        <div className="card" style={{ marginTop: 12, padding: 26, textAlign: 'center', fontSize: 13, color: 'var(--ink2)' }}>
          {items.length === 0 ? (sw ? 'Ongeza bidhaa yako ya kwanza — picha, jina na bei.' : 'Add your first product — a photo, a name and a price.') : (sw ? 'Hakuna kinacholingana.' : 'Nothing matches.')}
        </div>
      ) : (
        <div className="card" style={{ marginTop: 12, padding: '2px 12px' }}>
          {list.map((p, i) => (
            <div key={p.id} className="product-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--line)' : undefined }}>
              <div className="tap" onClick={() => setEdit(p)} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, overflow: 'hidden', background: 'var(--card2)', display: 'grid', placeItems: 'center', color: 'var(--ink3)', flexShrink: 0 }}>
                  {p.images?.[0] ? <img src={p.images[0]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="tag" size={18} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{fmt(Number(p.price))}{p.category ? ` · ${p.category}` : ''}{!p.online ? ` · ${sw ? 'imefichwa' : 'hidden'}` : ''}</div>
                </div>
              </div>
              <button type="button" className="chip tap" onClick={() => void toggleStock(p)}
                style={{ padding: '6px 10px', fontSize: 11, fontWeight: 800, background: inStock(p) ? 'var(--okSoft)' : 'var(--badSoft)', color: inStock(p) ? 'var(--ok)' : 'var(--bad)' }}>
                {inStock(p) ? (sw ? 'Ipo' : 'In stock') : (sw ? 'Imeisha' : 'Sold out')}
              </button>
            </div>
          ))}
        </div>
      )}

      <button id="add-product" type="button" className="s-fab tap" onClick={() => setEdit('new')}><Icon name="plus" size={18} /> {sw ? 'Ongeza bidhaa' : 'Add product'}</button>
      {edit && <ProductSheet item={edit === 'new' ? null : edit} categories={[...new Set((items || []).map((p) => p.category).filter(Boolean) as string[])]} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); }} />}
    </div>
  );
}

function ProductSheet({ item, categories, onClose, onSaved }: { item: ShopItem | null; categories: string[]; onClose: () => void; onSaved: () => void }) {
  const { lang } = useSettings();
  const sw = lang === 'sw';
  const { activeBusiness } = useData();
  const { flash } = useToast();
  const [name, setName] = useState(item?.name || '');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [category, setCategory] = useState(item?.category || '');
  const [online, setOnline] = useState(item?.online ?? true);
  const [image, setImage] = useState<string | null>(item?.images?.[0] || null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file || !activeBusiness) return;
    setBusy(true);
    try {
      const blob = await shrinkImage(file);
      const path = `${activeBusiness.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from('shop-media').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      setImage(supabase.storage.from('shop-media').getPublicUrl(path).data.publicUrl);
    } catch (e) { flash(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  async function save() {
    if (!activeBusiness) return;
    const p = Number(price.replace(/[^0-9.]/g, ''));
    if (!name.trim() || !(p >= 0) || price.trim() === '') { flash(sw ? 'Weka jina na bei' : 'Enter a name and a price'); return; }
    setBusy(true);
    const row = { name: name.trim(), price: p, category: category.trim() || null, online, images: image ? [image] : [] };
    const { error } = item
      ? await supabase.from('shop_products').update(row).eq('id', item.id)
      : await supabase.from('shop_products').insert({ ...row, business_id: activeBusiness.id, track_stock: false, stock: 0, active: true });
    setBusy(false);
    if (error) { flash(error.message); return; }
    onSaved();
  }

  async function remove() {
    if (!item) return;
    setBusy(true);
    // Kept as inactive rather than deleted, so past orders still name it.
    const { error } = await supabase.from('shop_products').update({ active: false }).eq('id', item.id);
    setBusy(false);
    if (error) { flash(error.message); return; }
    onSaved();
  }

  return (
    <Sheet open onClose={onClose} title={item ? (sw ? 'Badilisha bidhaa' : 'Edit product') : (sw ? 'Bidhaa mpya' : 'New product')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="card tap" style={{ height: 150, display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'var(--card2)', cursor: 'pointer' }}>
          {image ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink3)', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="image" size={16} /> {busy ? '…' : (sw ? 'Weka picha' : 'Add a photo')}</span>}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
        <input id="p-name" className="field" placeholder={sw ? 'Jina la bidhaa' : 'Product name'} value={name} onChange={(e) => setName(e.target.value)} />
        <input id="p-price" className="field" inputMode="decimal" placeholder={sw ? 'Bei' : 'Price'} value={price} onChange={(e) => setPrice(e.target.value)} />
        <input className="field" list="shop-cats" placeholder={sw ? 'Kundi (si lazima), mfano Viatu' : 'Category (optional), e.g. Shoes'} value={category} onChange={(e) => setCategory(e.target.value)} />
        <datalist id="shop-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
          <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> {sw ? 'Onyesha kwenye duka la mtandaoni' : 'Show on the online shop'}
        </label>
        <button id="p-save" type="button" className="btn-primary tap" data-disabled={busy} onClick={() => void save()}>{busy ? '…' : (sw ? 'Hifadhi' : 'Save')}</button>
        {item && <button type="button" className="btn-ghost tap" style={{ color: 'var(--bad)' }} data-disabled={busy} onClick={() => void remove()}><Icon name="trash" size={14} /> {sw ? 'Ondoa bidhaa' : 'Remove product'}</button>}
      </div>
    </Sheet>
  );
}
