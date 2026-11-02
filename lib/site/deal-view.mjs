// How the Deal of the Week is described on the page: its name, its one-line
// headline, its spend ladder and when it ends. Everything comes from the deal
// as the CRM saved it; nothing here decides a price (see quote.mjs).
//
// Relative imports so the unit tests can load this directly.

import { dealOfferSummaries, normalizeDealOffers } from '../catalog-pricing/dealOffers.mjs';

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
  let headline;
  if (spend.length) {
    headline = es ? `Hasta ${top}% de descuento en todo tu pedido` : `Up to ${top}% off your whole order`;
  } else if (top > 0) {
    headline = es ? `Hasta ${top}% de descuento esta semana` : `Up to ${top}% off this week`;
  } else {
    headline = es ? 'Ofertas de esta semana' : 'This week\'s offers';
  }

  return {
    id: deal.id,
    name,
    headline,
    tiers: spend,
    rules: spend.length ? [] : dealOfferSummaries(deal.offers, lang),
    endsAt: deal.ends_at || null,
    productNames: deal.product_names || [],
    note: es
      ? 'El mejor descuento se aplica automáticamente. No se combina con los precios por volumen.'
      : 'The best discount applies automatically. Not combined with volume pricing.',
  };
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
