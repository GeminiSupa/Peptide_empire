// Copied from the catalog (src/lib/cardDeclineRules.mjs) by scripts/sync-catalog-checkout.mjs. Do not edit.
/**
 * What a card customer is told about bank declines, before and after one.
 *
 * The rule (owner, 17 Nov 2026): 3 tries per order; after the first decline
 * the customer should call their bank before trying again; after 3 tries card
 * payment is blocked for an hour. The block is real: /api/chargx/process-card
 * refuses a 4th attempt on the same order within the hour; its two numbers
 * are checked against these by tests/card-decline-rules.test.mjs.
 *
 * Shown on the checkout's card panel, the /pay-card page and /payment-help.
 * The website (branch main) shows the same three lines in its cart.
 */

export const CARD_TRIES_PER_ORDER = 3;
export const CARD_TRY_BLOCK_MINUTES = 60;

const RULES = {
  en: {
    title: 'If your bank declines the card',
    lines: [
      `You have ${CARD_TRIES_PER_ORDER} tries to pay this order by card.`,
      'After the first decline, call your bank and ask them to approve the charge before you try again.',
      `After ${CARD_TRIES_PER_ORDER} tries, card payment is blocked for 1 hour.`,
    ],
  },
  es: {
    title: 'Si su banco rechaza la tarjeta',
    lines: [
      `Tiene ${CARD_TRIES_PER_ORDER} intentos para pagar este pedido con tarjeta.`,
      'Después del primer rechazo, llame a su banco y pídale que apruebe el cargo antes de intentar de nuevo.',
      `Después de ${CARD_TRIES_PER_ORDER} intentos, el pago con tarjeta se bloquea por 1 hora.`,
    ],
  },
};

/**
 * @param {string} lang 'en' or anything else for Spanish
 * @returns {{ title: string, lines: string[] }}
 */
export function cardDeclineRules(lang) {
  return lang === 'en' ? RULES.en : RULES.es;
}
