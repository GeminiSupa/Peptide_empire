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
  return `₡${Math.round(Number(amountCrc || 0)).toLocaleString('en-US')}`;
}
