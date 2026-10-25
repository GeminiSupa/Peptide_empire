import QRCode from 'qrcode';
// Relative, not '@/lib', so tests can build a sheet under `node --test`.
import { formatCrDate } from './crTime.mjs';
import { stickerUrl } from './labBatches.mjs';

/**
 * QR stickers for a batch, printed through the browser's own print window so
 * any printer works: a label printer (one sticker per page, page = sticker
 * size) or an ordinary printer on an A4 label sheet.
 *
 * The QR is drawn as SVG, not a picture: a printer at 203 or 300 dpi turns a
 * small bitmap QR to mush, and a code that will not scan is worse than none.
 */

export const STICKER_SIZES = [
  {
    id: 'vial',
    label: 'Vial sticker · 50 × 20 mm (label printer)',
    page: '50mm 20mm',
    width: 50, height: 20, qr: 17,
  },
  {
    id: 'box',
    label: 'Box sticker · 60 × 40 mm (label printer)',
    page: '60mm 40mm',
    width: 60, height: 40, qr: 26,
  },
  {
    id: 'a4',
    label: 'A4 sheet · 21 per page, 63.5 × 38.1 mm (normal printer)',
    page: 'A4',
    width: 63.5, height: 38.1, qr: 28,
  },
];

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const shortDate = (iso) => (iso ? formatCrDate(iso, { day: '2-digit', month: 'short', year: 'numeric' }) : '');

function stickerBody(batch, size, qrSrc) {
  const made = shortDate(batch.madeDate);
  const expires = shortDate(batch.expiryDate);
  const dates = [made && `Made ${made}`, expires && `Exp ${expires}`].filter(Boolean).join(' · ');
  return `
    <div class="sticker">
      <img class="qr" src="${qrSrc}" alt="" />
      <div class="text">
        <div class="product">${escapeHtml(batch.product)}</div>
        <div class="code">${escapeHtml(batch.code)}</div>
        ${dates ? `<div class="dates">${escapeHtml(dates)}</div>` : ''}
        <div class="ruo">Research use only</div>
      </div>
    </div>`;
}

/** The QR as an SVG image source, encoding the batch's sticker link. */
export async function stickerQrSrc(code) {
  const svg = await QRCode.toString(stickerUrl(code), { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** The whole printable page. `autoPrint: false` skips opening the print dialog. */
export function stickerSheetHtml(batch, size, copies, qrSrc, { autoPrint = true } = {}) {
  const base = size.id === 'box' ? 1.25 : 1;
  const one = stickerBody(batch, size, qrSrc);
  const stickers = Array.from({ length: copies }, () => one).join('');
  const sheetLayout = size.id === 'a4'
    ? `
      @page { size: A4; margin: 15mm 7mm; }
      .sheet { display: grid; grid-template-columns: repeat(3, ${size.width}mm); column-gap: 2.5mm; row-gap: 0; }
      .sticker { width: ${size.width}mm; height: ${size.height}mm; break-inside: avoid; }`
    : `
      @page { size: ${size.page}; margin: 0; }
      .sticker { width: ${size.width}mm; height: ${size.height}mm; break-after: page; }
      .sticker:last-child { break-after: auto; }`;
  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>Stickers ${escapeHtml(batch.code)} × ${copies}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
  .sticker { display: flex; align-items: center; gap: 1.5mm; padding: 1.2mm 1.5mm; overflow: hidden; }
  .qr { width: ${size.qr}mm; height: ${size.qr}mm; flex: 0 0 auto; }
  .text { min-width: 0; line-height: 1.15; }
  .product { font-weight: 700; font-size: ${7 * base}pt; }
  .code { font-family: 'Courier New', monospace; font-weight: 700; font-size: ${6.5 * base}pt; margin-top: 0.4mm; white-space: nowrap; }
  .dates { font-size: ${5.5 * base}pt; margin-top: 0.4mm; }
  .ruo { font-size: ${5 * base}pt; margin-top: 0.4mm; text-transform: uppercase; letter-spacing: 0.02em; }
  ${sheetLayout}
  @media screen {
    body { background: #e5e7eb; padding: 16px; }
    .help { font-size: 13px; margin-bottom: 12px; color: #111; max-width: 640px; line-height: 1.5; }
    .sticker { background: #fff; outline: 1px dashed #9ca3af; margin-bottom: 4px; }
    .sheet { background: #fff; padding: 4px; }
  }
  @media print { .help { display: none; } }
</style></head>
<body>
  <div class="help">
    <strong>${copies} sticker${copies === 1 ? '' : 's'} for ${escapeHtml(batch.code)}.</strong>
    In the print window choose your printer${size.id === 'a4' ? ' and A4 paper' : `, and set the paper size to ${size.width} × ${size.height} mm`}.
    Turn off "Headers and footers" and set margins to "None". Scan one test sticker before printing them all.
  </div>
  <div class="sheet">${stickers}</div>
  ${autoPrint ? "<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 300); });</script>" : ''}
</body></html>`;
}

/**
 * Open the window FIRST, inside the click, then fill it. Browsers block a
 * window opened after an await, which would make the button look dead.
 *
 * `getBatch` may be async (old-stock stickers create their batch first); it is
 * called after the window is already open.
 */
export async function printStickers({ getBatch, copies, sizeId }) {
  const win = window.open('', '_blank');
  if (!win) throw new Error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
  win.document.write('<p style="font-family:Arial;padding:16px">Preparing stickers…</p>');
  try {
    const batch = await getBatch();
    const size = STICKER_SIZES.find((candidate) => candidate.id === sizeId) || STICKER_SIZES[0];
    const count = Math.min(1000, Math.max(1, Math.floor(Number(copies) || 1)));
    const qrSrc = await stickerQrSrc(batch.code);
    win.document.open();
    win.document.write(stickerSheetHtml(batch, size, count, qrSrc));
    win.document.close();
    return batch;
  } catch (err) {
    win.close();
    throw err;
  }
}
