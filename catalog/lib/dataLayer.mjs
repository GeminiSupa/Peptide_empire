// Copied from the catalog (src/lib/dataLayer.mjs) by scripts/sync-catalog-checkout.mjs. Do not edit.
export function pushEvent(event, browser = typeof window !== 'undefined' ? window : null) {
  if (!browser) return false;
  try { const layer = browser.dataLayer = browser.dataLayer || []; if (event.ecommerce) layer.push({ ecommerce: null }); layer.push(event); return true; } catch { return false; }
}
const emitted = new Set();
export function pushReceiptOnce(event, storage, browser = typeof window !== 'undefined' ? window : null) {
  if (!event?.ecommerce?.transaction_id) return false;
  const key = `pcr_conversion:${event.event}:${event.ecommerce.transaction_id}`;
  try { if (storage.getItem(key)) return false; } catch { /* In-memory guard still handles rerenders. */ }
  if (emitted.has(key)) return false;
  if (!pushEvent(event, browser)) return false;
  emitted.add(key); try { storage.setItem(key, '1'); } catch { /* Storage may be blocked. */ } return true;
}
// begin_checkout, add_shipping_info and add_payment_info describe one trip
// through checkout, not one render of the form. The form re-renders on every
// keystroke, price refresh and cart edit, so each event may be claimed once
// until the checkout ends (the cart empties) and the gate is reset.
export const CHECKOUT_FUNNEL_EVENTS = new Set(['begin_checkout', 'add_shipping_info', 'add_payment_info']);
export function createCheckoutEventGate() {
  const sent = new Set();
  return { claim: name => { if (sent.has(name)) return false; sent.add(name); return true; }, reset: () => sent.clear() };
}
export function stashReceipt(orderNumber, token) {
  try { if (!token) return; sessionStorage.setItem(`pcr_receipt:${orderNumber}`, token); sessionStorage.setItem('pcr_receipt:last', orderNumber); } catch { /* Checkout must not depend on analytics. */ }
}
export const trackLead = formName => pushEvent({ event: 'generate_lead', form_name: formName });
export const WHATSAPP_LOCATIONS = new Set(['floating_button','product_question','back_in_stock','search_no_result','coa_request','contact_page','pro_page','affiliate','faq','thank_you_add_item','thank_you_help']);
export function whatsappLocation({ path = '', text = '', hint = '' } = {}) {
  const s = `${text} ${hint}`.toLowerCase();
  if (/stock|agotad|notify|avis/.test(s)) return 'back_in_stock';
  if (/coa|certificate|certificado/.test(s)) return 'coa_request';
  if (/search|sin resultado|no result/.test(s)) return 'search_no_result';
  if (path.startsWith('/thank-you')) return /add|forgot|agreg|olvid/.test(s) ? 'thank_you_add_item' : 'thank_you_help';
  if (/affiliate|afiliad/.test(path + s)) return 'affiliate';
  if (/profession|pro-account|pro_page/.test(path + s)) return 'pro_page';
  if (/faq|blog/.test(path)) return 'faq';
  if (/contact/.test(path + s)) return 'contact_page';
  if (/product|question|consulta|pregunta/.test(s)) return 'product_question';
  return 'floating_button';
}
