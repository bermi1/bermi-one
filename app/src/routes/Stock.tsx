import { useMemo, useRef, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Icon } from '../lib/icons';
import { useSettings } from '../lib/useSettings';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { currentQty, groupByCategory, stockValueOf } from '../lib/calc';
import { tintVars, type Product } from '../lib/types';
import { parseTable, buildRows, FIELD_LABELS, type FieldKey, type ParsedTable } from '../lib/csv';
import { openStockSheet } from '../lib/stockSheet';
import { SessionHistory } from '../components/SessionHistory';
import { ReceiveStock } from '../components/ReceiveStock';

/** The canonical bar stock template — the same columns the business exports. */
function toCsv(products: Product[]): string {
  const head = 'product_name,unit,opening_stock,item_price,item_profit,category,sort_order';
  const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = products.map((p, i) =>
    [cell(p.name), cell(p.unit), p.opening, p.price, p.profit, cell(p.cat), i].join(','),
  );
  return [head, ...rows].join('\n');
}

export function Stock() {
  const { L, fmt, fmt0, short, lang, owner } = useSettings();
  const { products, session, activeBusiness, reorderProducts, addProduct, addProductsBulk, updateProductFields } = useData();
  const { flash } = useToast();
  const counts = session?.counts || {};

  const [tab, setTab] = useState<'items' | 'sessions'>('items');
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editProfit, setEditProfit] = useState('');
  const [reorderMode, setReorderMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newP, setNewP] = useState({ name: '', cat: '', unit: 'bottle', price: '', profit: '', low: '' });

  const [editAllMode, setEditAllMode] = useState(false);
  const [edits, setEdits] = useState<Record<string, Partial<Product>>>({});
  const [savingAll, setSavingAll] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkTable, setBulkTable] = useState<ParsedTable | null>(null);
  const [bulkColumnMap, setBulkColumnMap] = useState<FieldKey[]>([]);
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { rows: bulkRows, errors: bulkErrors } = useMemo(
    () => (bulkTable ? buildRows(bulkTable.rows, bulkColumnMap) : { rows: [], errors: [] }),
    [bulkTable, bulkColumnMap],
  );

  const cats = useMemo(() => ['All', ...Array.from(new Set(products.map((p) => p.cat)))], [products]);
  const filtered = useMemo(
    () => products.filter((p) => (cat === 'All' || p.cat === cat) && p.name.toLowerCase().includes(query.toLowerCase())),
    [products, cat, query],
  );
  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  const totalValue = stockValueOf(products, counts);
  const totalUnits = products.reduce((s, p) => s + currentQty(p, counts), 0);

  /**
   * A delivery joins the closing that is still being counted; once that closing
   * is submitted or verified it belongs to the next one instead. Saying which,
   * up front, is the difference between a stock figure people trust and one
   * they argue about.
   */
  const heldForNext = session?.status === 'submitted';
  const stockDestinationNote = heldForNext
    ? L.goesToNextClosing
    : session?.status === 'verified'
      ? L.goesToComingStock
      : L.goesToThisClosing;

  function move(p: Product, dir: -1 | 1) {
    const ids = products.map((x) => x.id);
    const i = ids.indexOf(p.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void reorderProducts(ids);
  }

  function startEdit(p: Product) {
    setEditId(p.id);
    setEditPrice(String(p.price));
    setEditProfit(String(p.profit));
  }

  async function saveEdit(p: Product) {
    await updateProductFields(p.id, { price: Number(editPrice || 0), profit: Number(editProfit || 0) });
    setEditId(null);
  }

  async function submitNewProduct() {
    if (!newP.name.trim()) return;
    await addProduct({
      name: newP.name.trim(),
      cat: newP.cat.trim() || 'General',
      unit: newP.unit.trim() || 'unit',
      price: Number(newP.price || 0),
      profit: Number(newP.profit || 0),
      low: Number(newP.low || 0),
    });
    setAddOpen(false);
    setNewP({ name: '', cat: '', unit: 'bottle', price: '', profit: '', low: '' });
    flash(lang === 'sw' ? 'Bidhaa imeongezwa' : 'Product added');
  }

  function applyBulkText(text: string) {
    setBulkText(text);
    const table = parseTable(text);
    setBulkTable(table);
    setBulkColumnMap(table.columnMap);
  }

  function setColumnMapAt(ix: number, field: FieldKey) {
    setBulkColumnMap((prev) => prev.map((f, i) => (i === ix ? field : f)));
  }

  function openBulk() {
    setBulkText('');
    setBulkTable(null);
    setBulkColumnMap([]);
    setBulkFileName('');
    setBulkOpen(true);
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => applyBulkText(String(reader.result || ''));
    reader.readAsText(file);
    e.target.value = '';
  }

  /**
   * A re-uploaded sheet is usually the same product list with fresh counts, so
   * rows that match an existing product by name update it in place; only
   * genuinely new names are added. That makes "upload today's sheet" safe to
   * repeat without piling up duplicates.
   */
  const bulkSplit = useMemo(() => {
    const byName = new Map(products.map((p) => [p.name.trim().toLowerCase(), p]));
    const updates: { product: Product; row: (typeof bulkRows)[number] }[] = [];
    const fresh: typeof bulkRows = [];
    for (const row of bulkRows) {
      const hit = byName.get(row.name.trim().toLowerCase());
      if (hit) updates.push({ product: hit, row });
      else fresh.push(row);
    }
    return { updates, fresh };
  }, [bulkRows, products]);

  async function confirmBulkImport() {
    if (!bulkRows.length) return;
    setBulkBusy(true);
    for (const { product, row } of bulkSplit.updates) {
      await updateProductFields(product.id, {
        cat: row.cat, unit: row.unit, price: row.price, profit: row.profit, opening: row.opening, low: row.low,
      });
    }
    if (bulkSplit.fresh.length) await addProductsBulk(bulkSplit.fresh);
    setBulkBusy(false);
    setBulkOpen(false);
    const parts: string[] = [];
    if (bulkSplit.fresh.length) parts.push(`${bulkSplit.fresh.length} ${lang === 'sw' ? 'mpya' : 'new'}`);
    if (bulkSplit.updates.length) parts.push(`${bulkSplit.updates.length} ${lang === 'sw' ? 'zimesasishwa' : 'updated'}`);
    flash(parts.join(' · '));
  }

  function editField(id: string, patch: Partial<Product>) {
    setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
  }

  /** Only fields that actually differ from what's stored get written back. */
  function pendingFor(p: Product): Partial<Product> | null {
    const e = edits[p.id];
    if (!e) return null;
    const diff: Partial<Product> = {};
    for (const [k, v] of Object.entries(e) as [keyof Product, never][]) {
      if (p[k] !== v) diff[k] = v;
    }
    return Object.keys(diff).length ? diff : null;
  }

  const pendingCount = products.filter((p) => pendingFor(p)).length;

  async function saveAll() {
    setSavingAll(true);
    for (const p of products) {
      const diff = pendingFor(p);
      if (diff) await updateProductFields(p.id, diff);
    }
    setSavingAll(false);
    setEdits({});
    setEditAllMode(false);
    flash(`${pendingCount} ${lang === 'sw' ? 'zimesasishwa' : 'updated'}`);
  }

  function cancelEditAll() {
    setEdits({});
    setEditAllMode(false);
  }

  function exportCsv() {
    const csv = toCsv(products);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock_${(activeBusiness?.name || 'business').replace(/\s+/g, '')}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function printSheet() {
    if (!activeBusiness) return;
    const ok = openStockSheet({ business: activeBusiness, products: filtered, lang });
    if (!ok) flash(lang === 'sw' ? 'Ruhusu dirisha jipya kwenye kivinjari' : 'Allow pop-ups to print the sheet');
  }

  return (
    <div className="screen sb">
      <AppHeader />
      <ScreenHeader
        title={L.stock}
        sub={`${products.length} ${L.products} · ${cats.length - 1} ${lang === 'sw' ? 'aina' : 'categories'}`}
        right={
          tab === 'items' && !editAllMode ? (
            <button className="chip tap" onClick={() => setReorderMode((v) => !v)}>
              {reorderMode ? L.doneEditing : L.reorderProducts}
            </button>
          ) : undefined
        }
      />

      {owner && (
        <div style={{ display: 'flex', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 4, marginBottom: 14 }}>
          {([['items', L.tabItems], ['sessions', L.tabSessions]] as const).map(([id, label]) => (
            <button
              key={id}
              className="tap"
              onClick={() => setTab(id)}
              style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: tab === id ? 'var(--card2)' : 'transparent', color: tab === id ? 'var(--ink)' : 'var(--ink3)' }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === 'sessions' && owner ? (
        <SessionHistory />
      ) : (
      <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700 }}>{L.totalStock}</div>
          <div style={{ marginTop: 4, fontSize: 17, fontWeight: 800 }}>{totalUnits || '—'}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700 }}>{L.stockValue}</div>
          <div style={{ marginTop: 4, fontSize: 17, fontWeight: 800 }}>{fmt0(totalValue)}</div>
        </div>
      </div>

      {owner && !reorderMode && !editAllMode && (
        <button
          className="btn-primary tap"
          style={{ width: '100%', marginBottom: 12, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
          onClick={() => setReceiveOpen(true)}
        >
          <Icon name="in" size={18} />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800 }}>{L.addStockCta}</span>
            <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, fontWeight: 600, opacity: 0.8 }}>{stockDestinationNote}</span>
          </span>
          <Icon name="right" size={16} style={{ opacity: 0.7 }} />
        </button>
      )}

      {editAllMode && (
        <div className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--brandSoft)' }}>
          <div style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: 'var(--brand)' }}>
            {pendingCount} {L.changed}
          </div>
          <button className="chip tap" style={{ padding: '6px 12px', fontSize: 12 }} onClick={cancelEditAll}>{L.cancel}</button>
          <button className="btn-primary tap" style={{ padding: '7px 14px', fontSize: 12.5 }} data-disabled={!pendingCount || savingAll} onClick={saveAll}>
            {L.saveAll}
          </button>
        </div>
      )}

      {!reorderMode && !editAllMode && (
        <>
          <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', marginBottom: 10 }}>
            <Icon name="search" size={16} style={{ color: 'var(--ink3)' }} />
            <input placeholder={L.searchProduct} value={query} onChange={(e) => setQuery(e.target.value)} style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 14 }} />
          </label>
          <div className="sb" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
            {cats.map((c) => (
              <button
                key={c}
                className="tap"
                onClick={() => setCat(c)}
                style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 12, fontSize: 12.5, fontWeight: 700, background: cat === c ? 'var(--brand)' : 'var(--card)', color: cat === c ? 'var(--brandInk)' : 'var(--ink2)', border: '1px solid var(--line)', textTransform: 'capitalize' }}
              >
                {c}
              </button>
            ))}
          </div>
        </>
      )}

      {reorderMode ? (
        <div className="card" style={{ padding: 6 }}>
          {products.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 8px', borderBottom: i === products.length - 1 ? 'none' : '1px solid var(--line)' }}>
              <Icon name="grip" size={16} style={{ color: 'var(--ink3)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600, textTransform: 'capitalize' }}>{p.cat}</div>
              </div>
              <button className="icon-btn tap" style={{ width: 32, height: 32 }} onClick={() => move(p, -1)} disabled={i === 0}>
                <Icon name="up" size={14} />
              </button>
              <button className="icon-btn tap" style={{ width: 32, height: 32 }} onClick={() => move(p, 1)} disabled={i === products.length - 1}>
                <Icon name="down" size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        groups.map(({ cat: groupCat, items }, gi) => {
          const tv = tintVars(gi);
          const groupUnits = items.reduce((s, p) => s + currentQty(p, counts), 0);
          const groupValue = items.reduce((s, p) => s + currentQty(p, counts) * p.price, 0);
          return (
            <div key={groupCat} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 8px' }}>
                <div style={{ width: 8, height: 8, borderRadius: 3, background: tv.ink, flexShrink: 0 }} />
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{groupCat}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700 }}>{items.length}</div>
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{groupUnits || '—'} · {groupValue ? short(groupValue) : '—'}</div>
              </div>

              <div className="card" style={{ padding: 6 }}>
                {items.map((p, i) => {
                  const qty = currentQty(p, counts);
                  const editing = editId === p.id;
                  const e = edits[p.id] || {};
                  const num = (v: unknown, fallback: number) => (v === undefined ? String(fallback) : String(v));

                  if (editAllMode) {
                    const dirty = !!pendingFor(p);
                    return (
                      <div key={p.id} style={{ padding: '10px 8px', borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--line)', background: dirty ? 'var(--warnSoft)' : 'transparent', borderRadius: 10 }}>
                        <input
                          value={e.name !== undefined ? e.name : p.name}
                          onChange={(ev) => editField(p.id, { name: ev.target.value })}
                          style={{ width: '100%', padding: '7px 9px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card2)', fontSize: 13, fontWeight: 700, marginBottom: 6 }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                          {([
                            ['opening', L.opening, p.opening],
                            ['price', L.price, p.price],
                            ['profit', L.profitPerUnit, p.profit],
                          ] as const).map(([key, label, fallback]) => (
                            <label key={key} style={{ display: 'block' }}>
                              <span style={{ fontSize: 9.5, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</span>
                              <input
                                inputMode="numeric"
                                value={num(e[key], fallback)}
                                onChange={(ev) => editField(p.id, { [key]: Number(ev.target.value.replace(/[^0-9]/g, '') || 0) })}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card2)', fontSize: 12.5, fontWeight: 700 }}
                              />
                            </label>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                          <input
                            list="cat-options"
                            value={e.cat !== undefined ? e.cat : p.cat}
                            onChange={(ev) => editField(p.id, { cat: ev.target.value })}
                            placeholder={L.category}
                            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card2)', fontSize: 12 }}
                          />
                          <input
                            value={e.unit !== undefined ? e.unit : p.unit}
                            onChange={(ev) => editField(p.id, { unit: ev.target.value })}
                            placeholder={lang === 'sw' ? 'Kipimo' : 'Unit'}
                            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card2)', fontSize: 12 }}
                          />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={p.id} style={{ borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 11, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <Icon name={p.icon} size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                          {editing ? (
                            <div style={{ display: 'flex', gap: 6, marginTop: 5, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <input
                                autoFocus
                                inputMode="numeric"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder={L.price}
                                style={{ width: 74, padding: '5px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card2)', fontSize: 12.5 }}
                              />
                              <input
                                inputMode="numeric"
                                value={editProfit}
                                onChange={(e) => setEditProfit(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder={L.profitPerUnit}
                                style={{ width: 74, padding: '5px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card2)', fontSize: 12.5 }}
                              />
                              <button className="chip tap" style={{ padding: '5px 10px', fontSize: 11.5 }} onClick={() => saveEdit(p)}>
                                {L.save}
                              </button>
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                              {fmt(p.price)}
                              {owner && <> · {lang === 'sw' ? 'faida' : 'profit'} {fmt(p.profit)}</>}
                              {p.incoming > 0 && (
                                <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--warn)', background: 'var(--warnSoft)', padding: '2px 6px', borderRadius: 5, whiteSpace: 'nowrap' }}>
                                  +{p.incoming} {L.heldForNextCount}
                                </span>
                              )}
                              {owner && (
                                <Icon
                                  name="edit"
                                  size={12}
                                  style={{ color: 'var(--ink3)' }}
                                  onClick={(e) => { e.stopPropagation(); startEdit(p); }}
                                />
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: qty < p.low ? 'var(--warn)' : 'var(--ink)' }}>{qty || '—'}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--ink3)', fontWeight: 600 }}>
                            {p.unit}{p.added > 0 ? ` · +${p.added}` : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {!reorderMode && !editAllMode && (
        <>
          {owner && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              <button className="btn-ghost tap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setAddOpen(true)}>
                <Icon name="plus" size={16} />
                {lang === 'sw' ? 'Bidhaa mpya' : 'Add product'}
              </button>
              <button className="btn-ghost tap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={openBulk}>
                <Icon name="upload" size={16} />
                {L.bulkUpload}
              </button>
              <button className="btn-ghost tap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setEditAllMode(true)}>
                <Icon name="edit" size={16} />
                {L.bulkEdit}
              </button>
              <button className="btn-ghost tap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={exportCsv}>
                <Icon name="download" size={16} />
                {L.exportCsv}
              </button>
            </div>
          )}
          <button className="btn-ghost tap" style={{ width: '100%', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={printSheet}>
            <Icon name="doc" size={16} />
            {L.printStockSheet}
          </button>
          {!owner && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink3)', textAlign: 'center', lineHeight: 1.5 }}>
              {L.staffStockNote}
            </div>
          )}
        </>
      )}
      </>
      )}
      <input ref={fileInputRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={onFilePicked} />

      <ReceiveStock open={receiveOpen} onClose={() => setReceiveOpen(false)} note={stockDestinationNote} heldForNext={heldForNext} />

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={lang === 'sw' ? 'Bidhaa mpya' : 'New product'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input placeholder={L.product} value={newP.name} onChange={(e) => setNewP({ ...newP, name: e.target.value })} className="card" style={{ padding: '12px 14px', border: 'none', fontSize: 14 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input list="cat-options" placeholder={lang === 'sw' ? 'Aina' : 'Category'} value={newP.cat} onChange={(e) => setNewP({ ...newP, cat: e.target.value })} className="card" style={{ padding: '12px 14px', border: 'none', fontSize: 14 }} />
            <input placeholder={lang === 'sw' ? 'Kipimo' : 'Unit'} value={newP.unit} onChange={(e) => setNewP({ ...newP, unit: e.target.value })} className="card" style={{ padding: '12px 14px', border: 'none', fontSize: 14 }} />
          </div>
          <datalist id="cat-options">
            {cats.filter((c) => c !== 'All').map((c) => <option key={c} value={c} />)}
          </datalist>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input placeholder={L.price} inputMode="numeric" value={newP.price} onChange={(e) => setNewP({ ...newP, price: e.target.value.replace(/[^0-9]/g, '') })} className="card" style={{ padding: '12px 14px', border: 'none', fontSize: 14 }} />
            <input placeholder={L.profitPerUnit} inputMode="numeric" value={newP.profit} onChange={(e) => setNewP({ ...newP, profit: e.target.value.replace(/[^0-9]/g, '') })} className="card" style={{ padding: '12px 14px', border: 'none', fontSize: 14 }} />
          </div>
          <input placeholder={lang === 'sw' ? 'Kiwango cha chini' : 'Low stock alert level'} inputMode="numeric" value={newP.low} onChange={(e) => setNewP({ ...newP, low: e.target.value.replace(/[^0-9]/g, '') })} className="card" style={{ padding: '12px 14px', border: 'none', fontSize: 14 }} />
          <button className="btn-primary tap" style={{ width: '100%', marginTop: 4 }} onClick={submitNewProduct}>
            {L.save}
          </button>
        </div>
      </Sheet>

      <Sheet open={bulkOpen} onClose={() => setBulkOpen(false)} title={L.bulkUploadTitle} sub={L.bulkUploadSub}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn-ghost tap" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => fileInputRef.current?.click()}>
            <Icon name="upload" size={16} />
            {bulkFileName || L.chooseCsvFile}
          </button>
          <textarea
            placeholder={L.orPasteRows}
            value={bulkText}
            onChange={(e) => applyBulkText(e.target.value)}
            rows={6}
            className="card"
            style={{ width: '100%', padding: 12, border: 'none', fontSize: 13, fontFamily: 'monospace', resize: 'vertical' }}
          />
          <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{L.csvFormatHint}</div>

          {bulkTable && bulkColumnMap.length > 0 && (
            <div className="card" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {L.matchColumns}
              </div>
              {bulkColumnMap.map((field, ix) => {
                const headerLabel = bulkTable.headerCells?.[ix]?.trim() || `${lang === 'sw' ? 'Safu' : 'Column'} ${ix + 1}`;
                const sample = bulkTable.rows[0]?.[ix] || '';
                return (
                  <div key={ix} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{headerLabel}</div>
                      {sample && (
                        <div style={{ fontSize: 11, color: 'var(--ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lang === 'sw' ? 'mfano' : 'e.g.'} {sample}
                        </div>
                      )}
                    </div>
                    <select
                      value={field}
                      onChange={(e) => setColumnMapAt(ix, e.target.value as FieldKey)}
                      className="card"
                      style={{ padding: '7px 8px', border: '1px solid var(--line)', fontSize: 12.5, fontWeight: 600 }}
                    >
                      {Object.entries(FIELD_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          {bulkErrors.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--warn)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {bulkErrors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          {bulkRows.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="card" style={{ flex: 1, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand)' }}>{bulkSplit.fresh.length}</div>
                <div style={{ fontSize: 10, color: 'var(--ink3)', fontWeight: 700 }}>{lang === 'sw' ? 'MPYA' : 'NEW'}</div>
              </div>
              <div className="card" style={{ flex: 1, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ok)' }}>{bulkSplit.updates.length}</div>
                <div style={{ fontSize: 10, color: 'var(--ink3)', fontWeight: 700 }}>{(lang === 'sw' ? 'SASISHO' : 'UPDATES')}</div>
              </div>
            </div>
          )}
          {bulkRows.length > 0 && bulkSplit.updates.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{L.matchedByName}</div>
          )}

          {bulkRows.length > 0 ? (
            <div className="card" style={{ padding: 6, maxHeight: 220, overflowY: 'auto' }}>
              {bulkRows.slice(0, 20).map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 8px', borderBottom: i === Math.min(bulkRows.length, 20) - 1 ? 'none' : '1px solid var(--line)', fontSize: 12.5 }}>
                  <div style={{ flex: 1, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ color: 'var(--ink3)' }}>{r.opening} {r.unit}</div>
                  <div style={{ fontWeight: 700 }}>{fmt(r.price)}</div>
                </div>
              ))}
              {bulkRows.length > 20 && (
                <div style={{ padding: 8, fontSize: 12, color: 'var(--ink3)', textAlign: 'center' }}>
                  +{bulkRows.length - 20} {lang === 'sw' ? 'zaidi' : 'more'}
                </div>
              )}
            </div>
          ) : (
            bulkText.trim().length > 0 && <div style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{L.noRowsYet}</div>
          )}

          <button className="btn-primary tap" style={{ width: '100%' }} data-disabled={bulkRows.length === 0 || bulkBusy} onClick={confirmBulkImport}>
            {bulkRows.length > 0 ? `${L.confirmImport} · ${bulkRows.length} ${L.rowsReady}` : L.confirmImport}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
