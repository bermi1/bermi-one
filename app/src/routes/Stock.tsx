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

export function Stock() {
  const { L, fmt, short, lang } = useSettings();
  const { products, session, activeBusiness, addStock, reorderProducts, addProduct, addProductsBulk, updateProductFields } = useData();
  const { flash } = useToast();
  const counts = session?.counts || {};

  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState('0');
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editProfit, setEditProfit] = useState('');
  const [reorderMode, setReorderMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newP, setNewP] = useState({ name: '', cat: '', unit: 'bottle', price: '', profit: '', low: '' });

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

  function move(p: Product, dir: -1 | 1) {
    const ids = products.map((x) => x.id);
    const i = ids.indexOf(p.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void reorderProducts(ids);
  }

  async function saveAdd(p: Product) {
    const n = Number(draft || 0);
    if (n <= 0) return;
    await addStock(p.id, n);
    flash(`${n} × ${p.name}`);
    setExpanded(null);
    setDraft('0');
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

  async function confirmBulkImport() {
    if (!bulkRows.length) return;
    setBulkBusy(true);
    await addProductsBulk(bulkRows);
    setBulkBusy(false);
    setBulkOpen(false);
    flash(`${bulkRows.length} ${L.rowsReady}`);
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
          <button className="chip tap" onClick={() => setReorderMode((v) => !v)}>
            {reorderMode ? L.doneEditing : L.reorderProducts}
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700 }}>{L.totalStock}</div>
          <div style={{ marginTop: 4, fontSize: 17, fontWeight: 800 }}>{totalUnits}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700 }}>{L.stockValue}</div>
          <div style={{ marginTop: 4, fontSize: 17, fontWeight: 800 }}>{fmt(totalValue)}</div>
        </div>
      </div>

      {!reorderMode && (
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
                <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{groupUnits} · {short(groupValue)}</div>
              </div>

              <div className="card" style={{ padding: 6 }}>
                {items.map((p, i) => {
                  const qty = currentQty(p, counts);
                  const isOpen = expanded === p.id;
                  const editing = editId === p.id;
                  return (
                    <div key={p.id} style={{ borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 11, background: tv.soft, color: tv.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <Icon name={p.icon} size={16} />
                        </div>
                        <div className="tap" style={{ flex: 1, minWidth: 0 }} onClick={() => { setExpanded(isOpen ? null : p.id); setDraft('0'); }}>
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
                            <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {fmt(p.price)} · {lang === 'sw' ? 'faida' : 'profit'} {fmt(p.profit)}
                              <Icon
                                name="edit"
                                size={12}
                                style={{ color: 'var(--ink3)' }}
                                onClick={(e) => { e.stopPropagation(); startEdit(p); }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="tap" onClick={() => { setExpanded(isOpen ? null : p.id); setDraft('0'); }} style={{ fontSize: 14, fontWeight: 800, color: qty < p.low ? 'var(--warn)' : 'var(--ink)', textAlign: 'right' }}>
                          {qty}
                          <div style={{ fontSize: 10.5, color: 'var(--ink3)', fontWeight: 600 }}>{p.unit}</div>
                        </div>
                      </div>

                      {isOpen && (
                        <div style={{ padding: '4px 8px 16px', animation: 'slideIn .2s ease' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', marginBottom: 8 }}>{L.addStockInline}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button className="icon-btn tap" onClick={() => setDraft(String(Math.max(0, Number(draft || 0) - 1)))}>
                              <Icon name="minus" size={15} />
                            </button>
                            <input
                              value={draft}
                              onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
                              style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 800, padding: '10px 0', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card2)' }}
                            />
                            <button className="icon-btn tap" onClick={() => setDraft(String(Number(draft || 0) + 1))}>
                              <Icon name="plus" size={15} />
                            </button>
                          </div>
                          <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink2)', fontWeight: 600 }}>
                            {L.totalAfterAdd}: {qty + Number(draft || 0)} {p.unit}
                          </div>
                          <button className="btn-primary tap" style={{ width: '100%', marginTop: 12, padding: '12px 0' }} onClick={() => saveAdd(p)}>
                            {L.save}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {!reorderMode && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <button className="btn-ghost tap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setAddOpen(true)}>
              <Icon name="plus" size={16} />
              {lang === 'sw' ? 'Bidhaa mpya' : 'Add product'}
            </button>
            <button className="btn-ghost tap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={openBulk}>
              <Icon name="upload" size={16} />
              {L.bulkUpload}
            </button>
          </div>
          <button className="btn-ghost tap" style={{ width: '100%', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={printSheet}>
            <Icon name="doc" size={16} />
            {L.printStockSheet}
          </button>
        </>
      )}
      <input ref={fileInputRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={onFilePicked} />

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
