import ES from './es-dictionary.mjs';

/**
 * Translating the storefront.
 *
 * The design applied its Spanish with a MutationObserver that rewrote text
 * nodes after every render. This site already serves each language from its
 * own route group — `(en)` and `(es)` — so strings are translated while
 * rendering and nothing rewrites the DOM afterwards. Same translations, no
 * observer fighting React over the same text nodes.
 */

/**
 * Strings that carry a value, which an exact-match dictionary cannot key on.
 *
 * Each entry gets the captured groups and returns the Spanish. Keeping the
 * plural rules in code rather than in the dictionary is what lets "1 compound"
 * and "9 compounds" both read correctly.
 */
const ES_PATTERNS = [
  [/^(\d+) compounds?$/, (n) => `${n} ${n === '1' ? 'compuesto' : 'compuestos'}`],
  [/^(\d+) options?$/, (n) => `${n} ${n === '1' ? 'opción' : 'opciones'}`],
  [/^(\d+) vials?$/, (n) => `${n} ${n === '1' ? 'vial' : 'viales'}`],
  [/^(\d+) in order$/, (n) => `${n} en el pedido`],
  [/^Add (.+) for free delivery$/, (amount) => `Agregue ${amount} para envío gratis`],
  [/^(.+) away from free delivery$/, (amount) => `${amount} para envío gratis`],
  [/^\+(\d+) for (\d+)% off$/, (n, pct) => `+${n} para ${pct}% de descuento`],
  [/^(.+) added$/, (what) => `${what} agregado`],
  [/^Save (.+)$/, (amount) => `Ahorre ${amount}`],
  [/^You save (.+)$/, (amount) => `Ahorra ${amount}`],
  [/^Incl\. (.+) delivery$/, (amount) => `Incluye ${amount} de envío`],
  [/^More in (.+)$/, (what) => `Más en ${what}`],
  [/^(\d+) strengths?$/, (n) => `${n} ${n === '1' ? 'presentación' : 'presentaciones'}`],
  // The new design's chrome and home (1 Nov 2026).
  [/^Spend (.+)\+$/, (amount) => `Gasta ${amount}+`],
  [/^(\d+)% off$/, (pct) => `${pct}% menos`],
  [/^Shop the (.+)$/, (name) => `Comprar la ${name}`],
  [/^from (.+)$/, (amount) => `desde ${amount}`],
  [/^Search (\d+) compounds$/, (n) => `Buscar ${n} compuestos`],
  [/^Free delivery over (.+)$/, (amount) => `Envío gratis sobre ${amount}`],
  [/^See all (\d+) compounds$/, (n) => `Ver los ${n} compuestos`],
  [/^(\d+) items? · (.+)$/, (n, amount) => `${n} ${n === '1' ? 'artículo' : 'artículos'} · ${amount}`],
  [/^(.+) to free delivery · free BAC Water included$/, (amount) => `${amount} para envío gratis · BAC Water gratis incluida`],
  [/^(\d+) results?$/, (n) => `${n} ${n === '1' ? 'resultado' : 'resultados'}`],
  [/^No compound matches “(.+)”$/, (q) => `Ningún compuesto coincide con “${q}”`],
  [/^Hi! Do you have (.+)\?$/, (q) => `¡Hola! ¿Tienen ${q}?`],
  // The product view and catalog (2 Nov 2026).
  [/^Catalog · (\d+) research compounds in stock$/, (n) => `Catálogo · ${n} compuestos de investigación en stock`],
  [/^(\d+)% bulk discount$/, (pct) => `${pct}% de descuento por volumen`],
  [/^An agent confirms stock, sends payment details to (.+)\.$/, (phone) => `Un agente confirma el stock y envía los datos de pago al ${phone}.`],
  [/^You saved (.+)$/, (amount) => `Ahorró ${amount}`],
  [/^(\d+)% off unlocked$/, (pct) => `${pct}% de descuento desbloqueado`],
  [/^Every extra vial is (\d+)% off too\.$/, (pct) => `Cada vial extra también tiene ${pct}% de descuento.`],
  [/^up to (\d+)% off$/, (pct) => `hasta ${pct}% de descuento`],
  [/^Browse all (\d+) compounds$/, (n) => `Ver los ${n} compuestos`],
  [/^Add (\d+) more to unlock (\d+%) off$/, (n, pct) => `Agregue ${n} más para obtener ${pct} de descuento`],
  [/^Add (\d+) to order$/, (n) => `Agregar ${n} al pedido`],
  [/^(\d+) min read$/, (n) => `${n} min de lectura`],
  [/^Researching (.+)\?$/, (name) => `¿Investigando ${name}?`],
  [/^What are (.+)\?$/, (name) => `¿Qué son los ${name}?`],
  [/^How much do (.+) cost in Colombia\?$/, (name) => `¿Cuánto cuestan los ${name} en Colombia?`],
  [/^From (.+) per vial\. 15% off 5\+ vials and 20% off 10\+ of the same product, applied automatically\.$/, (amount) => `Desde ${amount} por vial. 15% de descuento en 5+ viales y 20% en 10+ del mismo producto, aplicado automáticamente.`],
  [/^Stocking up on (.+)\?$/, (name) => `¿Abasteciéndose de ${name}?`],
  [/^Buying (.+) in Colombia$/, (name) => `Comprar ${name} en Colombia`],
  [/^(\d+) compounds in local stock, each with a batch Certificate of Analysis, delivered in 2–4 days\.$/, (n) => `${n} compuestos en stock local, cada uno con Certificado de Análisis por lote, entregados en 2–4 días.`],
  [/^Add (\d+) more to save$/, (n) => `Agregue ${n} más para ahorrar`],
  [/^(\d+)% off your whole order$/, (pct) => `${pct}% de descuento en todo tu pedido`],
  [/^(\d+) items added$/, (n) => `${n} artículos agregados`],
  [/^(.+) FAQ$/, (name) => `Preguntas frecuentes sobre ${name}`],
  [/^What is (.+)\?$/, (name) => `¿Qué es ${name}?`],
  [/^How much does (.+) cost in Colombia\?$/, (name) => `¿Cuánto cuesta ${name} en Colombia?`],
  [/^From (.+) per vial\. 15% off 5\+ vials, 20% off 10\+\.$/, (amount) => `Desde ${amount} por vial. 15% de descuento en 5+ viales, 20% en 10+.`],
  [
    /^15% off 5\+ vials of the same product, 20% off 10\+\. The best discount applies automatically\. Every order includes a free BAC Water 3 ml, and delivery is free over (.+)\.$/,
    (amount) => `15% de descuento en 5+ viales del mismo producto, 20% en 10+. El mejor descuento se aplica automáticamente. Cada pedido incluye una BAC Water de 3 ml gratis, y el envío es gratis sobre ${amount}.`,
  ],
  // The catalog's other payment options (8 Nov 2026), worded as its checkout words them.
  [/^Pay from any participating bank in colones: (.+)\. We will show the SINPE number after you place the order\.$/, (amount) => `Pague desde cualquier banco participante en colones: ${amount}. Mostraremos el número SINPE después de enviar el pedido.`],
  [/^Transfer from any bank in (CRC|USD)\. We will show the receiving account after you place the order and confirm payment after the funds arrive\.$/, (cur) => `Transfiera desde cualquier banco en ${cur}. Mostraremos la cuenta receptora después de enviar el pedido y confirmaremos el pago cuando lleguen los fondos.`],
];

/**
 * Translate one string.
 *
 * An exact dictionary hit wins; otherwise the value patterns are tried; if
 * neither matches, the English comes back. A missing translation shows as
 * English text — never as a blank, and never as a key.
 */
export function translate(text, lang = 'en') {
  if (lang !== 'es') return text;
  const key = String(text ?? '').trim();
  if (!key) return text;

  const exact = ES[key];
  if (exact != null) return exact;

  for (const [pattern, build] of ES_PATTERNS) {
    const match = key.match(pattern);
    if (match) return build(...match.slice(1));
  }
  return text;
}

/** A translator bound to one language, for a component to take as a prop. */
export function translator(lang) {
  return (text) => translate(text, lang);
}

/**
 * Money, in the currency the shopper picked.
 *
 * Colón prices are shown to the colón and dollar prices to the cent, which is
 * how the catalog shows them. The USD figure is the authoritative one in the
 * database; the colón figure is derived from it at the catalog's own rate, so
 * this never divides a colón price back into dollars.
 */
export function formatMoney(amountCrc, amountUsd, currency) {
  if (currency === 'USD') {
    return `$${Number(amountUsd || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `$${Math.round(Number(amountCrc || 0)).toLocaleString('en-US')}`;
}
