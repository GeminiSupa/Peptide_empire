// The WordPress harvest contains old product prices and shipping thresholds in
// prose, FAQ answers, icon copy and card data. Hide those claims at render and
// import time; the catalog supplies current commerce information separately.
const COLON = /₡/;
const OWN_MEDIA = /https?:\/\/(?:www\.)?peptidescostarica\.net\/wp-content/gi;
export const USD_COMMERCE_GROUPS = new Set(['city', 'productLander', 'category', 'wooCategory', 'index', 'legal']);
export const scrubUsdForPage = (group, path) => USD_COMMERCE_GROUPS.has(group) || path === '/info-center/';

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
  if (typeof node === 'string') return node.replace(OWN_MEDIA, '/wp-content');
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
      return [key, withoutMoneySentence(value, money).replace(OWN_MEDIA, '/wp-content')];
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
