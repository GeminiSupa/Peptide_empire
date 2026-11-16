// How the Deal of the Week is described on the page: its name, its one-line
// headline, its spend ladder and when it ends. Everything comes from the deal
// as the CRM saved it; nothing here decides a price (see quote.mjs).
//
// Relative imports so the unit tests can load this directly.

import { dealOfferSummaries, normalizeDealOffers } from '../catalog-pricing/dealOffers.mjs';
import { dealProductNamesMatch } from '../catalog-pricing/catalogFilters.mjs';

/** True while `deal` is running at `now`. */
export function dealLive(deal, now = Date.now()) {
  if (!deal) return false;
  const t = typeof now === 'number' ? now : now.getTime();
  if (deal.starts_at && t < Date.parse(deal.starts_at)) return false;
  if (deal.ends_at && t > Date.parse(deal.ends_at)) return false;
  return true;
}

/**
 * The deal, reduced to what the bar, hero card and deal page show.
 *
 * `tiers` is the spend ladder (`[{ minUsd, pct }]`, cheapest first) when the
 * deal is a Spend & Save; empty otherwise, in which case `rules` carries the
 * catalog's own one-line summary of each offer.
 */
export function describeDeal(deal, lang = 'en', now = Date.now()) {
  if (!dealLive(deal, now)) return null;
  const es = lang === 'es';
  const offers = deal.pricing_mode === 'offers'
    ? normalizeDealOffers(deal.offers).items.filter((item) => item.enabled)
    : [];

  const spend = offers
    .filter((item) => item.type === 'spend')
    .map((item) => ({ minUsd: item.min_total_usd, pct: Math.round(item.discount_pct * 100) }))
    .sort((a, b) => a.minUsd - b.minUsd);

  const named = offers.find((item) => (es ? item.name_es : item.name_en));
  const name = named
    ? (es ? named.name_es : named.name_en)
    : (es ? 'Oferta de la semana' : 'Deal of the Week');

  const top = spend.length
    ? Math.max(...spend.map((tier) => tier.pct))
    : Math.round(Number(deal.discount_pct || 0) * 100);

  // The hero headline. A Spend & Save keeps its ladder wording; every other
  // offer type (buy X get Y, free gift, 2nd-vial, free shipping, flat %) says
  // what it actually gives, so a non-percentage deal is never announced as
  // "0% off" or hidden as "no deal". The primary offer is the first one that
  // isn't free shipping (a perk that rides along), else the first offer.
  const primary = offers.find((item) => item.type !== 'free_shipping') || offers[0] || null;
  const offerPct = (item) => Math.round((Number(item?.discount_pct) || 0) * 100);
  let headline;
  if (spend.length) {
    headline = es ? `Hasta ${top}% de descuento en todo tu pedido` : `Up to ${top}% off your whole order`;
  } else if (primary?.type === 'bundle') {
    headline = es ? `Compra ${primary.buy_qty}, llévate ${primary.free_qty} gratis` : `Buy ${primary.buy_qty}, get ${primary.free_qty} free`;
  } else if (primary?.type === 'gift') {
    headline = es ? `Regalo gratis con ${primary.min_units}+ viales` : `Free gift with ${primary.min_units}+ vials`;
  } else if (primary?.type === 'pair') {
    headline = es ? `${offerPct(primary)}% de descuento en tu 2.º vial` : `${offerPct(primary)}% off your 2nd vial`;
  } else if (primary?.type === 'flat') {
    headline = es ? `${offerPct(primary)}% de descuento` : `${offerPct(primary)}% off`;
  } else if (primary?.type === 'free_shipping') {
    headline = es ? 'Envío gratis esta semana' : 'Free shipping this week';
  } else if (top > 0) {
    headline = es ? `Hasta ${top}% de descuento en todo tu pedido` : `Up to ${top}% off your whole order`;
  } else {
    headline = es ? 'Ofertas de esta semana' : 'This week\'s offers';
  }

  return {
    id: deal.id,
    name,
    headline,
    tiers: spend,
    // Every enabled offer's one-line rule, for surfaces that show a deal with
    // no spend ladder (buy X get Y, free gift, etc.).
    rules: spend.length ? [] : dealOfferSummaries(deal.offers, lang),
    endsAt: deal.ends_at || null,
    productNames: deal.product_names || [],
    note: es
      ? 'El mejor descuento se aplica automáticamente. No se combina con los precios por volumen.'
      : 'The best discount applies automatically. Not combined with volume pricing.',
  };
}

/**
 * A live flash sale, reduced to what the product page shows: its label, the
 * single deepest percentage off, which products it covers, and when it ends.
 *
 * A flash sale is a `flat` offer — a straight % off selected products, no
 * minimum. It beats volume pricing, so a covered product hides its quantity
 * presets and shows this instead. Nothing here decides a price; the price
 * comes from the pooled quote exactly as checkout charges it (see quote.mjs).
 *
 * `flash` is the Deal of the Week API's separate flash row; null when none.
 */
export function describeFlash(flash, lang = 'en', now = Date.now()) {
  if (!dealLive(flash, now)) return null;
  const es = lang === 'es';
  const flats = flash.pricing_mode === 'offers'
    ? normalizeDealOffers(flash.offers).items.filter((item) => item.enabled && item.type === 'flat')
    : [];
  const pct = flats.length
    ? Math.round(Math.max(...flats.map((item) => item.discount_pct)) * 100)
    : Math.round(Number(flash.discount_pct || 0) * 100);
  if (!(pct > 0)) return null;
  const productNames = flats.length
    ? [...new Set(flats.flatMap((item) => item.product_names || []))]
    : (flash.product_names || []);
  if (!productNames.length) return null;
  return {
    id: flash.id,
    name: es ? 'Oferta Relámpago' : 'Flash Sale',
    pct,
    productNames,
    endsAt: flash.ends_at || null,
  };
}

/** True when a running flash sale covers any of these product names. */
export function flashCoversProduct(flashView, productNames = []) {
  if (!flashView || !Array.isArray(flashView.productNames) || !flashView.productNames.length) return false;
  const names = Array.isArray(productNames) ? productNames : [productNames];
  return names.some((name) => flashView.productNames.some((flashName) => dealProductNamesMatch(flashName, name)));
}

/** "13h 41m" / "2d 4h" until `endsAt`, or '' once it has passed. */
export function timeLeft(endsAt, now = Date.now()) {
  if (!endsAt) return '';
  const ms = Date.parse(endsAt) - now;
  if (ms <= 0) return '';
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${mins % 60}m`;
}
