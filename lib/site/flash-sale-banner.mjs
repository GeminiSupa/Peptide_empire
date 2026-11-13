const percent = (deal) => {
  const direct = Number(deal?.discount_pct || 0);
  if (direct > 0) return Math.round(direct * 100);
  const items = Array.isArray(deal?.offers?.items) ? deal.offers.items : [];
  const flat = items.find((offer) => offer?.enabled && offer?.type === 'flat');
  return Math.round(Number(flat?.discount_pct || 0) * 100);
};

/** A site-header fallback when the shared admin banner row disappears. */
export function flashSaleBanner(deal, lang = 'es', href = '/shop/') {
  if (!deal?.id) return null;
  const pct = percent(deal);
  if (!(pct > 0)) return null;
  return {
    id: `deal-${deal.id}`,
    dealId: deal.id,
    text: lang === 'en'
      ? `FLASH SALE: ${pct}% OFF SELECTED PRODUCTS — AUTOMATIC AT CHECKOUT`
      : `OFERTA FLASH: ${pct}% DE DESCUENTO EN PRODUCTOS SELECCIONADOS — AUTOMÁTICO AL PAGAR`,
    href,
  };
}
