/**
 * The lab report links on a product.
 *
 * A product's COA field usually holds one link, but a vial can have more than
 * one report (a purity test and an endotoxin test), so it may hold several,
 * separated by spaces or new lines. Every page that shows a COA reads the field
 * through here, so a second link never gets glued onto the first and breaks both.
 *
 * Relative imports only, so `node --test` can load this file directly.
 */

/** Every usable link in a COA field, in the order they were entered. */
export function coaLinks(value) {
  return String(value ?? '')
    .split(/\s+/)
    .map((piece) => piece.trim())
    .filter((piece) => piece && piece !== '—')
    .map((piece) => (/^https?:\/\//i.test(piece) ? piece : `https://${piece}`))
    .filter((link) => {
      try {
        return new URL(link).hostname.includes('.');
      } catch {
        return false;
      }
    });
}

/** The Janoshik task number in a verify link ("241360"), or '' for any other link. */
export function janoshikTaskNumber(link) {
  const match = String(link || '').match(/janoshik\.com\/tests\/(\d+)[_-]/i);
  return match ? match[1] : '';
}

/**
 * What a customer reads on the link. A Janoshik link opens the lab's own
 * verify page, so it says so; anything else is a certificate to download,
 * numbered when the product has more than one of those.
 */
export function coaLinkLabel(link, links = [link], lang = 'es') {
  const en = String(lang).toLowerCase().startsWith('en');
  const localReport = String(link).match(/catalog\.peptidescostarica\.net\/coa\/(\d+)$/);
  const relatedLabels = {
    '164620': en ? 'Related report: Epithalon 10mg (catalog 50mg)' : 'Informe relacionado: Epithalon 10mg (catálogo 50mg)',
    '164626': en ? 'Related report: Thymosin Alpha-1 5mg (catalog 10mg)' : 'Informe relacionado: Thymosin Alpha-1 5mg (catálogo 10mg)',
    '241369': en ? 'Related TB4 10mg report: endotoxins only; TB-500 match unconfirmed' : 'Informe TB4 10mg relacionado: solo endotoxinas; correspondencia con TB-500 sin confirmar',
  };
  if (localReport && relatedLabels[localReport[1]]) return relatedLabels[localReport[1]];
  if (localReport) return en ? `View lab report #${localReport[1]}` : `Ver informe de laboratorio #${localReport[1]}`;
  const task = janoshikTaskNumber(link);
  if (task) return en ? `Verify Janoshik lab report #${task}` : `Verificar informe Janoshik #${task}`;
  const downloads = links.filter((other) => !janoshikTaskNumber(other));
  const number = downloads.length > 1 ? ` ${downloads.indexOf(link) + 1}` : '';
  return en ? `Download certificate of analysis${number}` : `Descargar certificado de análisis${number}`;
}
