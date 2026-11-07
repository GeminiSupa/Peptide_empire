/** The live 3 ml BAC Water photo used for the free gift in the cart. */
export function freeBacWaterImage(compounds) {
  const bac = (compounds || []).find((compound) => (
    compound?.slug === 'bac-water' || /^bac water$/i.test(String(compound?.name || '').trim())
  ));
  if (!bac) return '';

  const threeMl = (bac.variants || []).find((variant) => (
    String(variant?.size || '').replace(/\s+/g, '').toLowerCase() === '3ml'
  ));
  return threeMl?.image || bac.image || '';
}
