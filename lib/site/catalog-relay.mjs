/**
 * Which of the catalog's public endpoints this site may relay to.
 *
 * The catalog's own pages call these from the browser. They answer only the
 * catalog's origin (no CORS headers), so a browser on this site cannot reach
 * them — the request is blocked before it is sent. `app/api/catalog/[endpoint]`
 * makes the same call server to server instead. Nothing is computed or stored
 * here: the catalog validates, prices and saves exactly as it does for its own
 * checkout.
 *
 * Only the endpoints named below are relayed, each with a size cap and the
 * fields it takes. Anything else is refused, so the relay can never become a
 * general door into the catalog's API.
 */

const text = (value, max) => {
  const out = String(value ?? '').trim();
  return out ? out.slice(0, max) : null;
};

const lang = (value) => (value === 'en' ? 'en' : 'es');

/** One cart line in the shape the catalog's own cart stores. */
function cartItem(line) {
  return {
    product: text(line?.product, 160),
    category: text(line?.category, 120),
    priceUsd: line?.priceUsd ?? null,
    priceCrc: line?.priceCrc ?? null,
    qty: Math.max(1, Math.min(99, Math.floor(Number(line?.qty) || 1))),
    // The catalog's recovery message reads `quantity`; its cart reads `qty`.
    quantity: Math.max(1, Math.min(99, Math.floor(Number(line?.qty) || 1))),
    imageUrl: text(line?.imageUrl || line?.image, 500),
    vialSize: text(line?.vialSize || line?.size, 40),
    inventoryCount: null,
  };
}

export const RELAYS = {
  // Affiliate and promo codes. Checkout re-checks the code when the order
  // arrives; this only tells the shopper early.
  'promo-validate': {
    path: '/api/promo/validate',
    maxBytes: 16 * 1024,
    body: (b) => ({
      code: text(b?.code, 60),
      lang: lang(b?.lang),
      unitCount: Number.isFinite(Number(b?.unitCount)) ? Number(b.unitCount) : undefined,
      items: Array.isArray(b?.items)
        ? b.items.slice(0, 60).map((item) => ({ product: text(item?.product, 160), qty: Math.max(0, Math.floor(Number(item?.qty) || 0)) }))
        : undefined,
    }),
    // What the cart needs. The affiliate's commission rate stays on the server.
    reply: (r) => ({
      valid: r?.valid === true,
      pending: r?.pending === true,
      error: r?.error || null,
      code: r?.code || null,
      discount_pct: r?.discount_pct ?? null,
      min_units: r?.min_units ?? 0,
      max_units: r?.max_units ?? null,
      target_product: r?.target_product || null,
      is_flash_sale: r?.is_flash_sale === true,
      affiliate_id: r?.affiliate_id || null,
    }),
  },
  // Abandoned carts, for the WhatsApp recovery job and the admin's cart list.
  'cart-track': {
    path: '/api/cart/track',
    maxBytes: 64 * 1024,
    body: (b) => {
      const action = ['save', 'clear'].includes(b?.action) ? b.action : null;
      if (!action) return null;
      return {
        action,
        sessionId: text(b?.sessionId, 128),
        ...(action === 'save' ? {
          cart: Array.isArray(b?.cart) ? b.cart.slice(0, 60).map(cartItem) : [],
          customerName: text(b?.customerName, 120),
          customerPhone: text(b?.customerPhone, 30),
          customerEmail: text(b?.customerEmail, 160),
          lang: lang(b?.lang),
          currency: b?.currency === 'USD' ? 'USD' : 'CRC',
          metadata: { source: 'website' },
        } : {}),
      };
    },
    reply: (r) => ({ ok: r?.ok === true }),
  },
  // The footer's newsletter box.
  newsletter: {
    path: '/api/newsletter',
    maxBytes: 2 * 1024,
    body: (b) => {
      const email = text(b?.email, 160);
      return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email } : null;
    },
    reply: (r) => ({ success: r?.success === true, error: r?.error || null }),
  },
  // QR codes and agent / affiliate links: one landing, counted.
  'referral-scan': {
    path: '/api/referral-scan',
    maxBytes: 4 * 1024,
    body: (b) => ({
      salesAgent: text(b?.salesAgent, 120),
      promoCode: text(b?.promoCode, 60),
      referral: text(b?.referral, 120),
      utmSource: text(b?.utmSource, 60),
      utmMedium: text(b?.utmMedium, 60),
      utmCampaign: text(b?.utmCampaign, 60),
      sessionId: text(b?.sessionId, 80),
      isFirstVisit: b?.isFirstVisit !== false,
    }),
    reply: (r) => ({ ok: r?.ok === true, recorded: r?.recorded === true }),
  },
  // "Send me WhatsApp updates" at checkout: the consent the catalog's
  // WhatsApp follow-ups (cart recovery included) require before messaging.
  'whatsapp-optin': {
    path: '/api/leads/optin',
    maxBytes: 2 * 1024,
    body: (b) => {
      const phone = text(b?.phone, 30);
      return phone ? { phone, language: lang(b?.language) } : null;
    },
    reply: (r) => ({ ok: !r?.error, error: r?.error || null }),
  },
};

/** The relay for `name`, or null. */
export function relayFor(name) {
  return Object.prototype.hasOwnProperty.call(RELAYS, name) ? RELAYS[name] : null;
}
