const percent = (deal) => {
  const direct = Number(deal?.discount_pct || 0);
  if (direct > 0) return Math.round(direct * 100);
  const items = Array.isArray(deal?.offers?.items) ? deal.offers.items : [];
  const flat = items.find((offer) => offer?.enabled && offer?.type === 'flat');
  return Math.round(Number(flat?.discount_pct || 0) * 100);
};

/** A storefront fallback when the admin banner row is missing or was overwritten. */
export function flashSaleBanner(deal, lang = 'es', href = '/catalog') {
  if (!deal?.id) return null;
  const pct = percent(deal);
  if (!(pct > 0)) return null;
  const en = lang === 'en';
  return {
    id: `deal-${deal.id}`,
    dealId: deal.id,
    textEn: `FLASH SALE: ${pct}% OFF SELECTED PRODUCTS — AUTOMATIC AT CHECKOUT`,
    textEs: `OFERTA FLASH: ${pct}% DE DESCUENTO EN PRODUCTOS SELECCIONADOS — AUTOMÁTICO AL PAGAR`,
    text: en
      ? `FLASH SALE: ${pct}% OFF SELECTED PRODUCTS — AUTOMATIC AT CHECKOUT`
      : `OFERTA FLASH: ${pct}% DE DESCUENTO EN PRODUCTOS SELECCIONADOS — AUTOMÁTICO AL PAGAR`,
    href,
    isActive: true,
  };
}
