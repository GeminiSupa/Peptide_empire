/**
 * The storefront's editorial copy, in one place.
 *
 * All of it is the designer's, from the supplied design. It lives here rather
 * than inside the components so the owner can change a promise, a rating or
 * the weekly deal without reading JSX — and so the Spanish lookups in
 * `i18n.mjs` have one set of English strings to key on.
 *
 * Product names, prices, strengths and stock are NOT here. They come from the
 * catalog's database every 60 seconds; see `feed.js`.
 */

/** The three claims in the dark bar above the header. */
export const ANNOUNCEMENTS = [
  { icon: 'redeem', text: 'Free BAC Water with every order' },
  { icon: 'sell', text: '15% off 5+ · 20% off 10+' },
  // The amount is filled in from the live free-delivery threshold, which is
  // $200 converted at the catalog's own rate — not a fixed colón figure.
  { icon: 'local_shipping', text: 'Free delivery over {amount}' },
];

export const HERO = {
  // "{count} research compounds" — counted from the live feed, so it cannot
  // claim 48 when the catalog is selling 49.
  eyebrow: '{count} research compounds · in stock in Costa Rica',
  headlineLines: ['Every batch tested.', 'Every vial documented.'],
  headlineEmphasis: 'At your door in 2–4 days.',
  body: 'Third-party tested with a Certificate of Analysis per batch, kept at 2–8 °C on site. Up to 20% off in bulk, and a free BAC Water with every order.',
};

export const PROMISES = [
  { icon: 'verified', title: 'Batch COA', note: 'Every batch tested' },
  { icon: 'ac_unit', title: '2–8 °C', note: 'Cold storage on site' },
  { icon: 'local_shipping', title: '2–4 days', note: 'No customs' },
  { icon: 'payments', title: 'Cash on delivery', note: 'Or SINPE, card' },
];

/**
 * Review scores.
 *
 * Stated by the designer. Google and Trustpilot use the logo files this site
 * already ships (the review wall on the legacy pages uses the same two);
 * Facebook has no file, so its mark is drawn inline — see `brand-marks.js`.
 * All three carry a mark, because two logos beside one bare word reads as a
 * broken image rather than as a choice.
 *
 * The catalog has a live `/api/trustpilot-rating` these could be wired to.
 */
export const RATINGS = [
  {
    platform: 'Google',
    score: '5.0',
    stars: true,
    logo: '/wp-content/uploads/2026/03/4de77119-3608-45d9-b440-e34488b88e61.png',
  },
  {
    platform: 'Trustpilot',
    score: '4.6',
    stars: true,
    logo: '/wp-content/uploads/2026/08/icons8-trustpilot.svg',
  },
  { platform: 'Facebook', score: '5.0', stars: false, mark: 'facebook' },
];

/**
 * Press mentions.
 *
 * The first two logos were mirrored in from the catalog's own public folder.
 * La Nación has no file yet, so it is set as a wordmark chip the same height
 * as the logos — deliberate-looking, where a third image would 404. Drop a
 * file into `public/storefront/` and add its path here to finish the set.
 */
export const PRESS = [
  { name: 'The Tico Times', logo: '/storefront/press-tico-times.png' },
  { name: 'The Costa Rica News', logo: '/storefront/press-costa-rica-news.png' },
  { name: 'La Nación', logo: null },
];

/** The bulk tiers, stated for the shopper. The real discount is checkout's. */
export const WEEKLY_DEAL = {
  title: 'Stock up, save more',
  tiers: [
    { label: '5+ vials', off: '15% off' },
    { label: '10+ vials', off: '20% off' },
  ],
  note: 'Any compound · applied automatically in your order',
};

export const FAQ = [
  [
    "What's in the vial?",
    'The compound and amount on the label, as lyophilized powder (or ready-to-use liquid for blends and waters). Every batch has a Certificate of Analysis confirming identity and purity.',
  ],
  [
    'How fast is delivery?',
    '2–4 business days anywhere in Costa Rica, tracked, from our own cold storage. No customs or import fees.',
  ],
  ['How do I pay?', 'SINPE Móvil, bank transfer, card, or cash when it arrives.'],
  [
    'What discounts are there?',
    'The best discount applies automatically. Every order includes a free BAC Water 3 ml.',
  ],
  [
    'Is this for personal use?',
    "No. All products are for laboratory research use only. We don't provide dosing or medical advice.",
  ],
];

export const REVIEWS = [
  [
    'Trustpilot',
    'Excellent service, quality, and price. For me, they are the best in Costa Rica; I hope they never change.',
    'Daniel Manzanares Quesada · Trustpilot',
  ],
  [
    'Trustpilot',
    'Hay stock y son rápidos y asesoran muy bien, confiable los pagos y el producto llega en buen estado.',
    'Botanical Cosmetic · Trustpilot',
  ],
  ['Google', 'Son excelentes, mil estrellas.', 'Lic. Juan Alfonso Mata Chavarría · Google'],
];

/** Why-order-from-us tiles on the product view. */
export const WHY = [
  { icon: 'science', title: 'Third-party tested', note: 'Every batch, with its own COA' },
  { icon: 'ac_unit', title: 'Cold storage on site', note: '2–8 °C until dispatch' },
  { icon: 'local_shipping', title: '2–4 day delivery', note: 'Local stock, no customs' },
  { icon: 'autorenew', title: 'Replacement promise', note: 'Damaged or off-batch? Replaced' },
];

export const DISCLAIMER = 'All products are supplied for laboratory research. Not for human or veterinary use. Not approved for the diagnosis, treatment, cure or prevention of any condition. We do not provide dosing or medical advice.';

/** The WhatsApp number orders and questions go to. */
export const WHATSAPP_NUMBER = '50684046973';

export const CONTACT_LINE = 'Peptides Costa Rica · Curridabat, San José · +506 8404-6973';

/**
 * Card-statement notice.
 *
 * Shown before a card payment because the charge does not read as the shop's
 * name, which is what generates chargebacks. The processor and descriptor are
 * the catalog's own.
 */
export const CARD_NOTICE = {
  processor: 'Chargex',
  descriptor: 'AGILE DISRUPTIVE TECH',
};
