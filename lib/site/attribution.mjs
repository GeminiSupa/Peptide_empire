import { captureAdClick, readAdClick } from '../catalog-attribution/adClickAttribution.mjs';
import { readGaIdentity } from '../catalog-attribution/gaIdentity.mjs';
import { isUuid } from '../catalog-attribution/orderAttribution.mjs';

/**
 * Where a visitor came from, so the CRM can credit the order or lead to it.
 *
 * Every rule here is the catalog's own, so an order or lead from this site
 * is credited exactly as one from the catalog is:
 *
 * - UTM tags, referrer and `?referral=` links: catalog `src/app/catalog/page.js`
 *   (the "Capture Referral and UTM Campaign parameters" effect).
 * - `?sales_agent=` agent links: the same file, saved for checkout.
 * - Email journey / campaign links: catalog `src/components/UTMTracker.js`.
 * - Google Ads clicks (gclid, gbraid, wbraid): the catalog's
 *   `adClickAttribution.mjs`, vendored unchanged in `lib/catalog-attribution/`.
 * - GA4 client and session IDs: the catalog's `gaIdentity.mjs`, likewise.
 *
 * The storage keys are the catalog's too, so the two read the same way.
 *
 * Only fields the catalog's own checkout already writes are put on an order.
 * `/api/orders/create` inserts the order as sent, and a column the `orders`
 * table does not have fails the whole order, so nothing new is invented here.
 */

export const ATTRIBUTION_KEYS = {
  utmSource: 'lead_utm_source',
  utmMedium: 'lead_utm_medium',
  utmCampaign: 'lead_utm_campaign',
  referrer: 'lead_referrer',
  salesAgent: 'checkout_sales_agent',
  campaign: 'costa_attribution',
  // The paid-ad landing page's ?ref=, saved on arrival (catalog page.js), so a
  // sale can be traced to the page that produced the click.
  landingRef: 'landing_ref',
};

/** Matches the catalog's own cap before `orders.landing_ref` is written. */
const LANDING_REF_MAX_LENGTH = 200;

/** How long an email campaign or journey keeps the credit (UTMTracker). */
const CAMPAIGN_DAYS = 30;

function storeOf(win) {
  try {
    return win?.localStorage || null;
  } catch {
    return null;
  }
}

function read(store, key) {
  try {
    return store?.getItem(key) || '';
  } catch {
    return '';
  }
}

function write(store, key, value) {
  try {
    store?.setItem(key, value);
  } catch {
    // Private mode or a full quota: attribution is never worth an error.
  }
}

function remove(store, key) {
  try {
    store?.removeItem(key);
  } catch {
    // As above.
  }
}

/**
 * Save whatever the landing URL carries. Call once per page load.
 *
 * Never throws: a marketing tag must not break the page.
 */
export function captureAttribution(win = typeof window !== 'undefined' ? window : null, now = Date.now()) {
  if (!win?.location) return;
  try {
    const store = storeOf(win);
    const params = new URLSearchParams(win.location.search);

    // UTM tags, referrer and referral links — as the catalog page does.
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');
    const referralParam = params.get('referral') || params.get('affiliate') || params.get('ref');
    const ref = win.document?.referrer || '';
    if (utmSource) write(store, ATTRIBUTION_KEYS.utmSource, utmSource);
    if (utmMedium) write(store, ATTRIBUTION_KEYS.utmMedium, utmMedium);
    if (utmCampaign) write(store, ATTRIBUTION_KEYS.utmCampaign, utmCampaign);
    if (ref && !ref.includes(win.location.hostname)) write(store, ATTRIBUTION_KEYS.referrer, ref);
    if (referralParam) write(store, ATTRIBUTION_KEYS.referrer, `affiliate:${referralParam}`);

    // Which paid-ad landing page produced this visit. Read straight from ?ref=
    // (not the affiliate `referralParam` above, which also matches
    // ?referral= / ?affiliate=): this only records the landing page, and the
    // order carries it as landing_ref so a sale can be traced back to it.
    // Line for line with the catalog's own capture (src/app/catalog/page.js).
    const landingRefParam = params.get('ref');
    if (landingRefParam) {
      write(store, ATTRIBUTION_KEYS.landingRef, String(landingRefParam).slice(0, LANDING_REF_MAX_LENGTH));
    }

    // An agent's own link credits that agent's sale.
    const agentParam = params.get('sales_agent');
    if (agentParam) write(store, ATTRIBUTION_KEYS.salesAgent, agentParam);

    // Email campaigns and journeys — the catalog's UTMTracker, line for line.
    // These end up in uuid columns on `orders`, so a free-text campaign name
    // is dropped rather than kept to break checkout later.
    const enrollmentId = params.get('journey_enrollment');
    const stepId = params.get('utm_content');
    if (utmCampaign && !isUuid(utmCampaign)) {
      remove(store, ATTRIBUTION_KEYS.campaign);
    } else if (utmCampaign) {
      const expires = new Date(now);
      expires.setDate(expires.getDate() + CAMPAIGN_DAYS);
      write(store, ATTRIBUTION_KEYS.campaign, JSON.stringify({
        ...(utmMedium === 'email' && utmSource === 'journey'
          ? {
              journey_id: utmCampaign,
              journey_enrollment_id: isUuid(enrollmentId) ? enrollmentId : null,
              journey_step_id: isUuid(stepId) ? stepId : null,
            }
          : { campaign_id: utmCampaign }),
        expires: expires.getTime(),
      }));
    }

    // A Google Ads click, in the cookie the catalog reads too.
    if (win.document) captureAdClick(win.location, win.document, now);
  } catch {
    // Attribution is never worth breaking the page for.
  }
}

/** The campaign tags a lead is saved with (catalog `/api/leads/contact`). */
export function leadAttribution(win = typeof window !== 'undefined' ? window : null, now = Date.now()) {
  const store = storeOf(win);
  const out = {
    utm_source: read(store, ATTRIBUTION_KEYS.utmSource),
    utm_medium: read(store, ATTRIBUTION_KEYS.utmMedium),
    utm_campaign: read(store, ATTRIBUTION_KEYS.utmCampaign),
    referrer: read(store, ATTRIBUTION_KEYS.referrer),
  };
  // The Google Ads click. The lead posts to the catalog from this domain, so
  // the catalog cannot read this site's cookie itself: it goes in the body,
  // and the catalog's Google Ads upload copies it onto the customer's order.
  try {
    if (win?.document) out.ad_attribution = readAdClick(win.document, now);
  } catch {
    // Never worth the lead.
  }
  return Object.fromEntries(Object.entries(out).filter(([, value]) => value));
}

/** The email campaign or journey still holding the credit, if any. */
function storedCampaign(store, now) {
  try {
    const attr = JSON.parse(read(store, ATTRIBUTION_KEYS.campaign) || '{}');
    return attr && attr.expires > now ? attr : {};
  } catch {
    return {};
  }
}

/**
 * The attribution fields an order carries — the same ones the catalog's
 * checkout sends (`saveOrderToDatabase` and `applyStoredAttribution`).
 * Checkout re-validates every one of them on the server.
 */
export function orderAttribution(win = typeof window !== 'undefined' ? window : null, now = Date.now()) {
  if (!win) return {};
  const store = storeOf(win);
  const out = {};

  const agent = read(store, ATTRIBUTION_KEYS.salesAgent).trim();
  if (agent) out.sales_agent = agent;

  const campaign = storedCampaign(store, now);
  if (campaign.journey_id) {
    out.journey_id = campaign.journey_id;
    out.journey_enrollment_id = campaign.journey_enrollment_id || null;
    out.journey_step_id = campaign.journey_step_id || null;
  } else if (campaign.campaign_id) {
    out.campaign_id = campaign.campaign_id;
  }

  // Checkout keeps this column optional (it drops it if the table lacks it),
  // so it can never cost the order.
  const utmCampaign = read(store, ATTRIBUTION_KEYS.utmCampaign).trim();
  if (utmCampaign) out.utm_campaign = utmCampaign.slice(0, 180);

  // The paid-ad landing page's ?ref=, saved on arrival. The catalog's
  // /api/orders/create cleans and stores it as orders.landing_ref (dropped
  // defensively if the migration is unrun), so a sale traces to its page.
  const landingRef = read(store, ATTRIBUTION_KEYS.landingRef).trim();
  if (landingRef) out.landing_ref = landingRef;

  try {
    if (win.document) {
      out.ad_attribution = readAdClick(win.document);
      Object.assign(out, readGaIdentity(win.document));
    }
  } catch {
    // Never worth the order.
  }

  return out;
}
