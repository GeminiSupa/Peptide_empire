// The WordPress harvest contains old product prices and shipping thresholds in
// prose, FAQ answers, icon copy and card data. Hide those claims at render and
// import time; the catalog supplies current commerce information separately.
const COLON = /₡/;
const OWN_MEDIA = /https?:\/\/(?:www\.)?peptidescostarica\.net\/wp-content/gi;
const LEGACY_ORDERING_EN = 'We arrange delivery within Costa Rica. Now get easy online checkout with all the given payment options. Simply add your preferred product in cart and place your order. We also handle orders directly to make sure your items are available before you pay.';
const LEGACY_ORDERING_ES = 'Realizamos entregas dentro de Costa Rica. Ahora disfrute de un proceso de pago en línea fácil con todas las opciones de pago disponibles. Simplemente agregue su producto preferido al carrito y haga su pedido. También gestionamos los pedidos directamente para asegurarnos de que sus artículos estén disponibles antes de que pague.';
export const USD_COMMERCE_GROUPS = new Set(['city', 'productLander', 'category', 'wooCategory', 'index', 'legal']);
export const scrubUsdForPage = (group, path) => USD_COMMERCE_GROUPS.has(group) || path === '/info-center/';

function currentCommerceCopy(text) {
  return String(text)
    .replaceAll(LEGACY_ORDERING_EN, 'For current availability, delivery options, and checkout, visit our catalog.')
    .replaceAll(LEGACY_ORDERING_ES, 'Para consultar la disponibilidad actual, las opciones de entrega y completar su compra, visite nuestro catálogo.')
    .replace(OWN_MEDIA, '/wp-content');
}

function withoutMoneySentence(text, money) {
  return String(text)
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !money.test(sentence))
    .join(' ')
    .trim();
}

export function withoutHarvestedCommerce(node, { scrubUsd = false } = {}) {
  const money = scrubUsd ? /₡|\$\s*\d/ : COLON;
  if (Array.isArray(node)) {
    return node.map((item) => withoutHarvestedCommerce(item, { scrubUsd })).filter((item) => item !== null);
  }
  if (typeof node === 'string') return currentCommerceCopy(node);
  if (!node || typeof node !== 'object') return node;

  // These are independently rendered blocks or FAQ/list/card items. Keeping
  // only half their copy could make a pricing claim read incorrectly.
  const copy = node.content && typeof node.content === 'object' ? node.content : node;
  if (
    node.type
    && ['text_en', 'text_es', 'body_en', 'body_es', 'a_en', 'a_es', 'html_en', 'html_es']
      .some((key) => money.test(copy[key] || ''))
  ) return null;
  if (
    node.type
    && ['items_en', 'items_es', 'rows_en', 'rows_es']
      .some((key) => Array.isArray(copy[key]) && money.test(JSON.stringify(copy[key])))
  ) return null;
  if (
    !node.type
    && ['text_en', 'text_es', 'body_en', 'body_es', 'a_en', 'a_es', 'html_en', 'html_es']
      .some((key) => money.test(node[key] || ''))
  ) return null;

  return Object.fromEntries(Object.entries(node).map(([key, value]) => {
    if (typeof value === 'string' && money.test(value)) {
      if (key === 'price') return [key, null];
      return [key, currentCommerceCopy(withoutMoneySentence(value, money))];
    }
    return [key, withoutHarvestedCommerce(value, { scrubUsd })];
  }));
}

export function withoutHarvestedGlobal(global) {
  const announcement = global.announcement || {};
  return {
    ...global,
    announcement: {
      ...announcement,
      text_en: COLON.test(announcement.text_en || '')
        ? 'Current shipping offers are shown in our catalog'
        : announcement.text_en,
      text_es: COLON.test(announcement.text_es || '')
        ? 'Las ofertas de envío vigentes están en nuestro catálogo'
        : announcement.text_es,
    },
  };
}
