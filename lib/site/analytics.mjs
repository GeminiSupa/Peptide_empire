// Tracking events, in the catalog's exact shape.
//
// Both sites report to the same Google Tag Manager container (GTM-M2GVDQ44),
// so the tags and conversions set up there for the catalog must fire here
// unchanged. That means the same event names and the same `ecommerce` object
// as the catalog's src/lib/dataLayer.mjs and src/lib/ecommerceAnalytics.mjs:
// values in US dollars, one item per compound and strength, and a cleared
// `ecommerce` before each new one.
//
// Card purchases are not reported here: they finish on the catalog's own
// /pay-card and thank-you pages, which fire `purchase` themselves.
//
// Relative imports so the unit tests can load this directly.

const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const slug = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Push one event; analytics must never break the page. */
export function pushEvent(event, browser = typeof window !== 'undefined' ? window : null) {
  if (!browser) return false;
  try {
    const layer = browser.dataLayer = browser.dataLayer || [];
    if (event.ecommerce) layer.push({ ecommerce: null });
    layer.push(event);
    return true;
  } catch {
    return false;
  }
}

/**
 * One GA4 item for a cart line or `{ name, size, priceUsd, qty, category }`.
 * `discountPct` (0–1) is the share taken off, as checkout charged it.
 */
export function analyticsItem(line, discountPct = 0) {
  const isWater = /bac water/i.test(line.name);
  const size = String(line.size || '').replace(/\s+/g, '');
  const price = money(line.priceUsd);
  return {
    item_id: slug(`${line.name}-${size}`),
    item_name: line.name,
    item_variant: String(line.size || ''),
    item_category: line.category || '',
    price,
    quantity: Math.max(1, Number(line.qty) || 1),
    discount: isWater ? 0 : money(price * discountPct),
  };
}

/** The `ecommerce` object for `lines`: USD, net of the discount. */
export function ecommerceData(lines, { discountPct = 0, extras = {} } = {}) {
  const items = (lines || []).map((line) => analyticsItem(line, discountPct));
  const value = money(items.reduce((sum, item) => sum + (item.price - item.discount) * item.quantity, 0));
  return { currency: 'USD', value, items, ...extras };
}

/** A lead form sent: the catalog's `generate_lead`. */
export const trackLead = (formName) => pushEvent({ event: 'generate_lead', form_name: formName });

/** The catalog's WhatsApp click locations, so its click tags keep working. */
export function whatsappLocation({ path = '', text = '' } = {}) {
  const s = String(text).toLowerCase();
  if (/stock|agotad|notify|avis/.test(s)) return 'back_in_stock';
  if (/coa|certificate|certificado/.test(s)) return 'coa_request';
  if (/search|sin resultado|no result/.test(s)) return 'search_no_result';
  if (/thank-you|gracias/.test(path)) return /add|forgot|agreg|olvid/.test(s) ? 'thank_you_add_item' : 'thank_you_help';
  if (/affiliate|afiliad/.test(path + s)) return 'affiliate';
  if (/profession|para-profesionales/.test(path + s)) return 'pro_page';
  if (/faq|preguntas|blog/.test(path)) return 'faq';
  if (/contact/.test(path + s)) return 'contact_page';
  if (/product|question|consulta|pregunta/.test(s)) return 'product_question';
  return 'floating_button';
}

/**
 * A WhatsApp order, reported once: the catalog's `whatsapp_order`. Values are
 * converted to dollars at the rate the order was priced with.
 */
export function whatsappOrderEvent(order) {
  if (!order?.orderNumber || !order.lines?.length) return null;
  const toUsd = (amount) => (order.currency === 'USD' ? Number(amount) : Number(amount) / Number(order.exchangeRate || 1));
  const subtotal = order.lines.reduce((sum, line) => sum + Number(line.priceUsd) * line.qty, 0);
  const shipping = money(toUsd(order.shipping || 0));
  const net = Math.max(0, toUsd(order.total) - shipping);
  const discountPct = subtotal > 0 ? Math.max(0, 1 - net / subtotal) : 0;
  return {
    event: 'whatsapp_order',
    payment_type: 'whatsapp',
    ecommerce: {
      ...ecommerceData(order.lines, { discountPct }),
      value: money(net),
      shipping,
      transaction_id: order.orderNumber,
      coupon: '',
    },
  };
}
