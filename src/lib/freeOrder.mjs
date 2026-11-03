// A $0 order: a 100%-off code left nothing to pay.
//
// Strict on purpose. `Number(null)` and `Number('')` are both 0, so a row that
// simply has no total would read as "free" and be waved through as paid. Both
// money columns must hold a real number, and both must be exactly zero.
const isZero = (value) => value !== null && value !== undefined && String(value).trim() !== ''
  && Number.isFinite(Number(value)) && Number(value) === 0;

export function hasNothingToPay(order) {
  return isZero(order?.total_usd) && isZero(order?.total_crc);
}

// A card order may skip the charge only when a promo code explains the $0. A
// total of 0 with no code behind it looks like a pricing fault, and that must
// still stop at the card route rather than ship as "Paid".
export function isFreeCardOrder(order) {
  return hasNothingToPay(order) && Boolean(String(order?.promo_code ?? '').trim());
}
