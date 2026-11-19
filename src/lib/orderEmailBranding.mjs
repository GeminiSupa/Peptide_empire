import { ORDER_EMAIL_LOGO_BASE64 } from './orderEmailLogos.mjs';

export const ORDER_EMAIL_LOGO_CID = 'peptide-empire-logo@order-email';
export const ORDER_EMAIL_LOGO_SRC = `cid:${ORDER_EMAIL_LOGO_CID}`;

/**
 * The order-email logo for a country, embedded in the MIME message as base64
 * (not fetched from a URL), so every country's email shows its own logo and a
 * send never fails because a logo host is down or a domain is not live yet.
 * Falls back to Colombia's logo when the order has no country.
 */
export function getOrderEmailLogoAttachment(siteId) {
  const content = ORDER_EMAIL_LOGO_BASE64[siteId] || ORDER_EMAIL_LOGO_BASE64.co;
  return {
    filename: 'logo.png',
    content,
    encoding: 'base64',
    cid: ORDER_EMAIL_LOGO_CID,
    contentDisposition: 'inline',
  };
}
