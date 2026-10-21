import QRCode from 'qrcode';
import { COMPANY } from './company';

/*
  A shop's address on the web is bermione.com/<its name>: short enough to say
  out loud, print on a bag or put in an Instagram bio. Everything that hands
  the shop to the outside world — the link, the QR, the counter poster, the
  WhatsApp order — is built here, on the phone, with nothing to pay for.
*/

export const shopUrl = (slug: string) => `${COMPANY.site}/${slug}`;
export const shopUrlShort = (slug: string) => shopUrl(slug).replace(/^https?:\/\//, '');

export function qrDataUrl(text: string, size = 512) {
  return QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b0f1e', light: '#ffffff' } });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

/** An A5-shaped poster for the counter or the window: the name, a big QR, and the link under it. */
export async function shopPoster(name: string, slug: string, sw: boolean): Promise<Blob> {
  const W = 1240, H = 1754;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2f5bff'; ctx.fillRect(0, 0, W, 260);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
  ctx.font = '800 86px system-ui, sans-serif';
  let title = name;
  while (ctx.measureText(title).width > W - 120 && title.length > 4) title = title.slice(0, -2);
  if (title !== name) title = title.trimEnd() + '…';
  ctx.fillText(title, W / 2, 165);

  ctx.fillStyle = '#0b0f1e';
  ctx.font = '800 72px system-ui, sans-serif';
  ctx.fillText(sw ? 'Piga picha kuagiza' : 'Scan to shop', W / 2, 400);
  ctx.font = '500 40px system-ui, sans-serif';
  ctx.fillStyle = '#5b6478';
  ctx.fillText(sw ? 'Ona bidhaa na bei, agiza kwa WhatsApp' : 'See products and prices, order on WhatsApp', W / 2, 470);

  const qr = await loadImage(await qrDataUrl(shopUrl(slug), 820));
  ctx.drawImage(qr, (W - 820) / 2, 540, 820, 820);

  ctx.fillStyle = '#0b0f1e';
  ctx.font = '800 64px system-ui, sans-serif';
  ctx.fillText(shopUrlShort(slug), W / 2, 1490);
  ctx.font = '500 34px system-ui, sans-serif';
  ctx.fillStyle = '#8a93a6';
  ctx.fillText('Bermi One', W / 2, 1680);
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}

/** A phone number as wa.me wants it: digits only, Tanzanian numbers with 255. */
export function waNumber(phone: string | null | undefined) {
  const d = (phone || '').replace(/[^0-9]/g, '');
  return d.startsWith('0') ? '255' + d.slice(1) : d;
}

/** Shrink a photo before upload: phones shoot 4000 px; a product tile needs 800. */
export async function shrinkImage(file: File, max = 800): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.82));
  } finally { URL.revokeObjectURL(url); }
}
