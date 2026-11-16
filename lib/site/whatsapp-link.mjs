/**
 * Every WhatsApp button on the site opens through this site's own
 * `/api/whatsapp/open` (the catalog's route, synced into app/api). It adds a
 * short "Ref: PCR-…" to the message and saves where the visitor came from, so
 * the order staff later create from that chat is credited to the right channel
 * in the CRM's Revenue by channel report.
 *
 * The route then redirects to wa.me. If it cannot save (no server key on this
 * deployment, database down) it still redirects, with the message unchanged —
 * a WhatsApp button never breaks for tracking. No catalog subdomain involved.
 */

export const WHATSAPP_OPEN_PATH = '/api/whatsapp/open/';

export function whatsappHref(phone, text = '') {
  const params = new URLSearchParams({ phone: String(phone || '').replace(/\D/g, '') });
  if (text) params.set('text', String(text));
  return `${WHATSAPP_OPEN_PATH}?${params.toString()}`;
}
