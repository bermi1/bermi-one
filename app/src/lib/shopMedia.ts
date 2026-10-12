import QRCode from 'qrcode';
import { esc, openPrintable } from './printKit';
import type { OrderLine, ShopOrder } from './shop';

/*
  What a shop hands to the outside world: QR codes, a share card made for
  Instagram and WhatsApp status, the A5 counter poster, and a till receipt.
  All drawn on the device — no server, no design tool, nothing to pay for.
*/

export function qrDataUrl(text: string, size = 512, dark = '#0b0f1e') {
  return QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: 'M', color: { dark, light: '#ffffff' } });
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  return lines;
}

/**
 * A 1080×1350 card (Instagram's portrait size, also right for WhatsApp
 * status): the photo, the name, the price — struck-through old price when on
 * sale — the shop's name and a QR straight to the product.
 */
export async function productShareCard(opts: {
  image?: string | null; name: string; price: string; was?: string | null; shop: string; url: string; color?: string; badge?: string | null;
}): Promise<Blob> {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const brand = opts.color || '#2f5bff';
  const font = (w: number, s: number) => `${w} ${s}px Outfit, -apple-system, "Segoe UI", Roboto, sans-serif`;

  ctx.fillStyle = '#f4f6fd';
  ctx.fillRect(0, 0, W, H);

  // Photo, cover-cropped into a rounded frame.
  const img = opts.image ? await loadImage(opts.image) : null;
  const px = 60, py = 60, pw = W - 120, ph = 860;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 48);
  ctx.clip();
  if (img) {
    const s = Math.max(pw / img.width, ph / img.height);
    const iw = img.width * s, ih = img.height * s;
    ctx.drawImage(img, px + (pw - iw) / 2, py + (ph - ih) / 2, iw, ih);
  } else {
    const g = ctx.createLinearGradient(px, py, px + pw, py + ph);
    g.addColorStop(0, brand); g.addColorStop(1, '#7c4dff');
    ctx.fillStyle = g;
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.font = font(800, 120);
    ctx.textAlign = 'center';
    ctx.fillText(opts.name.slice(0, 1).toUpperCase(), W / 2, py + ph / 2 + 40);
    ctx.textAlign = 'left';
  }
  ctx.restore();

  if (opts.badge) {
    ctx.font = font(800, 40);
    const bw = ctx.measureText(opts.badge).width + 56;
    ctx.fillStyle = '#ff3b5c';
    roundRect(ctx, px + 30, py + 30, bw, 76, 38);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(opts.badge, px + 58, py + 82);
  }

  // Name and price.
  ctx.fillStyle = '#0b0f1e';
  ctx.font = font(800, 58);
  const nameLines = wrap(ctx, opts.name, 640, 2);
  nameLines.forEach((l, i) => ctx.fillText(l, 70, 1010 + i * 66));
  const priceY = 1010 + nameLines.length * 66 + 30;
  ctx.fillStyle = brand;
  ctx.font = font(800, 64);
  ctx.fillText(opts.price, 70, priceY);
  if (opts.was) {
    const pw2 = ctx.measureText(opts.price).width;
    ctx.fillStyle = '#8a93ad';
    ctx.font = font(700, 40);
    const wx = 70 + pw2 + 24;
    ctx.fillText(opts.was, wx, priceY);
    const ww = ctx.measureText(opts.was).width;
    ctx.fillRect(wx, priceY - 14, ww, 4);
  }
  ctx.fillStyle = '#4a5370';
  ctx.font = font(700, 34);
  ctx.fillText(opts.shop, 70, H - 70);

  // QR to the product page.
  const qr = await loadImage(await qrDataUrl(opts.url, 300, '#0b0f1e'));
  ctx.fillStyle = '#fff';
  roundRect(ctx, W - 330, 960, 270, 300, 28);
  ctx.fill();
  if (qr) ctx.drawImage(qr, W - 315, 975, 240, 240);
  ctx.fillStyle = '#4a5370';
  ctx.font = font(800, 26);
  ctx.textAlign = 'center';
  ctx.fillText('Scan to buy', W - 195, 1245);
  ctx.textAlign = 'left';

  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}

/** Share an image through the phone's share sheet (Instagram, WhatsApp…); fall back to a download. */
export async function shareImage(blob: Blob, filename: string, text: string, url: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: `${text} ${url}` });
      return 'shared';
    } catch { /* cancelled: fall through to download */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}

/** An A5 poster for the counter and the window: the shop's QR, big. */
export async function printStorePoster(opts: { shop: string; url: string; tagline?: string; sw: boolean }) {
  const qr = await qrDataUrl(opts.url, 900);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(opts.shop)} — QR</title>
<style>@page{size:A5;margin:0}body{margin:0;font-family:Outfit,-apple-system,Segoe UI,Roboto,sans-serif;color:#0b0f1e}
.p{width:148mm;height:210mm;box-sizing:border-box;padding:14mm 12mm;display:flex;flex-direction:column;align-items:center;text-align:center}
h1{font-size:30px;margin:0;letter-spacing:-.5px}.t{font-size:15px;color:#4a5370;margin-top:6px;font-weight:600}
.q{margin:10mm 0 6mm;padding:6mm;border-radius:8mm;border:2px solid #e2e6f3}.q img{width:92mm;height:92mm;display:block}
.c{font-size:22px;font-weight:800}.u{font-size:13px;color:#4a5370;margin-top:4px;word-break:break-all}
.f{margin-top:auto;font-size:11px;color:#8a93ad;font-weight:600}.bar{position:fixed;top:8px;right:8px}@media print{.bar{display:none}}</style></head>
<body><div class="bar"><button onclick="window.print()">${opts.sw ? 'Chapisha' : 'Print'}</button></div><div class="p">
<h1>${esc(opts.shop)}</h1>${opts.tagline ? `<div class="t">${esc(opts.tagline)}</div>` : ''}
<div class="q"><img src="${qr}" alt=""></div>
<div class="c">${opts.sw ? 'Piga picha · Nunua mtandaoni' : 'Scan to shop online'}</div>
<div class="u">${esc(opts.url.replace(/^https?:\/\//, ''))}</div>
<div class="f">${opts.sw ? 'Lipa kwa simu, chukua dukani au tuletee' : 'Pay by phone · pick up or get it delivered'} · Bermi One</div>
</div></body></html>`;
  return openPrintable(html);
}

/** A 58 mm till receipt. */
export function printReceipt(o: Pick<ShopOrder, 'number' | 'items' | 'subtotal' | 'discount' | 'promo_code' | 'gift_amount' | 'points_value' | 'total' | 'paid_cash' | 'paid_mobile' | 'paid_card' | 'customer_name' | 'points_earned' | 'created_at'>, opts: { shop: string; fmt: (n: number) => string; sw: boolean; change?: number; pointsBalance?: number | null; footer?: string }) {
  const { fmt, sw } = opts;
  const row = (a: string, b: string, bold = false) => `<tr${bold ? ' class="b"' : ''}><td>${a}</td><td class="r">${b}</td></tr>`;
  const items = (o.items as OrderLine[]).map((l) => `<tr><td>${esc(String(l.qty))}× ${esc(l.name)}</td><td class="r">${fmt(Number(l.line_total))}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>#${o.number}</title>
<style>@page{size:58mm auto;margin:2mm}body{margin:0;width:54mm;font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#000}
h1{font-size:14px;text-align:center;margin:0 0 2px}.c{text-align:center}table{width:100%;border-collapse:collapse}td{vertical-align:top;padding:1px 0}
.r{text-align:right;white-space:nowrap;padding-left:4px}.b td{font-weight:700;font-size:13px}hr{border:0;border-top:1px dashed #000;margin:4px 0}
.bar{margin:6px 0}@media print{.bar{display:none}}</style></head><body>
<div class="bar"><button onclick="window.print()">${sw ? 'Chapisha' : 'Print'}</button></div>
<h1>${esc(opts.shop)}</h1><div class="c">${sw ? 'Risiti' : 'Receipt'} #${o.number}<br>${new Date(o.created_at).toLocaleString()}</div><hr>
<table>${items}</table><hr><table>
${row(sw ? 'Jumla ndogo' : 'Subtotal', fmt(Number(o.subtotal)))}
${Number(o.discount) ? row(`${sw ? 'Punguzo' : 'Discount'}${o.promo_code ? ` (${esc(o.promo_code)})` : ''}`, '-' + fmt(Number(o.discount))) : ''}
${Number(o.points_value) ? row(sw ? 'Pointi' : 'Points', '-' + fmt(Number(o.points_value))) : ''}
${Number(o.gift_amount) ? row(sw ? 'Kadi ya zawadi' : 'Gift card', '-' + fmt(Number(o.gift_amount))) : ''}
${row(sw ? 'JUMLA' : 'TOTAL', fmt(Number(o.total)), true)}
${Number(o.paid_cash) ? row(sw ? 'Taslimu' : 'Cash', fmt(Number(o.paid_cash) + (opts.change || 0))) : ''}
${Number(o.paid_mobile) ? row(sw ? 'Simu' : 'Mobile', fmt(Number(o.paid_mobile))) : ''}
${Number(o.paid_card) ? row(sw ? 'Kadi' : 'Card', fmt(Number(o.paid_card))) : ''}
${opts.change ? row(sw ? 'Chenji' : 'Change', fmt(opts.change)) : ''}
</table>${o.customer_name ? `<hr><div>${esc(o.customer_name)}${o.points_earned ? ` · +${o.points_earned} ${sw ? 'pointi' : 'pts'}` : ''}${opts.pointsBalance != null ? ` · ${sw ? 'salio' : 'balance'} ${opts.pointsBalance}` : ''}</div>` : ''}
<hr><div class="c">${esc(opts.footer || (sw ? 'Asante, karibu tena!' : 'Thank you, come again!'))}</div>
<script>setTimeout(function(){window.print()},300)</script></body></html>`;
  return openPrintable(html);
}

/** The same receipt as a WhatsApp message. */
export function receiptText(o: Pick<ShopOrder, 'number' | 'items' | 'total' | 'discount' | 'points_earned'>, opts: { shop: string; fmt: (n: number) => string; sw: boolean; link?: string }) {
  const { fmt, sw } = opts;
  const lines = (o.items as OrderLine[]).map((l) => `${l.qty}× ${l.name} — ${fmt(Number(l.line_total))}`);
  return [
    `*${opts.shop}* — ${sw ? 'Risiti' : 'Receipt'} #${o.number}`,
    ...lines,
    Number(o.discount) ? `${sw ? 'Punguzo' : 'Discount'}: -${fmt(Number(o.discount))}` : '',
    `*${sw ? 'Jumla' : 'Total'}: ${fmt(Number(o.total))}*`,
    o.points_earned ? (sw ? `Umepata pointi ${o.points_earned} 🎉` : `You earned ${o.points_earned} points 🎉`) : '',
    opts.link ? `${sw ? 'Nunua mtandaoni' : 'Shop online'}: ${opts.link}` : '',
    sw ? 'Asante, karibu tena!' : 'Thank you, come again!',
  ].filter(Boolean).join('\n');
}
