import crypto from 'crypto';

/**
 * Two gateways, one API.
 *
 * Givver (Nov 2026) is the same platform as Chargex — same endpoints, same
 * key header, same hosted payment form, same webhook signature — with its own
 * store, its own keys and a lower card rate. So nothing here is rewritten per
 * gateway: a payment only has to go to the right store.
 *
 * `CARD_GATEWAY` picks the store for card and crypto, `ACH_GATEWAY` the one
 * for bank transfer. ACH falls back to the card gateway, so the day Givver
 * turns bank transfer on, dropping `ACH_GATEWAY` sends everything to Givver.
 * Both unset keeps every payment on Chargex, as before.
 */
export const PAYMENT_GATEWAY_IDS = ['chargx', 'givver'];

function gatewayConfig(id) {
  if (id === 'givver') {
    return {
      id: 'givver',
      label: 'Givver',
      baseUrl: process.env.GIVVER_API_BASE_URL || 'https://api.givver.cards',
      key: (mode) => (mode === 'test'
        ? process.env.GIVVER_TEST_PUBLISHABLE_API_KEY
        : process.env.GIVVER_PUBLISHABLE_API_KEY),
      webhookSecret: () => process.env.GIVVER_WEBHOOK_SECRET,
    };
  }
  return {
    id: 'chargx',
    label: 'Chargex',
    baseUrl: process.env.CHARGX_API_BASE_URL || 'https://api.chargx.io',
    key: (mode) => (mode === 'test'
      ? process.env.CHARGX_TEST_PUBLISHABLE_API_KEY
      : process.env.CHARGX_PUBLISHABLE_API_KEY),
    webhookSecret: () => process.env.CHARGX_WEBHOOK_SECRET,
  };
}

function namedGateway(value) {
  const id = String(value || '').trim().toLowerCase();
  return PAYMENT_GATEWAY_IDS.includes(id) ? id : null;
}

/** Which store takes this payment type. An unknown name means Chargex. */
export function gatewayIdForPaymentType(type = 'card') {
  const cardGateway = namedGateway(process.env.CARD_GATEWAY) || 'chargx';
  if (normalizeChargxPaymentType(type) === 'ach') {
    return namedGateway(process.env.ACH_GATEWAY) || cardGateway;
  }
  return cardGateway;
}

/** "Givver" or "Chargex" — what the order, the CRM and the staff see. */
export function gatewayLabelForPaymentType(type = 'card') {
  return gatewayConfig(gatewayIdForPaymentType(type)).label;
}

function publishableKey(mode = 'live', type = 'card') {
  return gatewayConfig(gatewayIdForPaymentType(type)).key(mode);
}

export function isChargxConfigured(mode = 'live', type = 'card') {
  return Boolean(publishableKey(mode, type));
}

/** One named store, whatever the payment type is pointed at today. */
export function isGatewayConfigured(gatewayId, mode = 'live') {
  return Boolean(gatewayConfig(namedGateway(gatewayId) || 'chargx').key(mode));
}

function parseJson(text) {
  const clean = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!clean) return {};
  try {
    return JSON.parse(clean);
  } catch {
    return { message: clean.slice(0, 300) };
  }
}

async function chargxRequest(path, { mode = 'live', method = 'GET', body, type = 'card', gatewayId } = {}) {
  const gateway = gatewayConfig(gatewayId || gatewayIdForPaymentType(type));
  const key = gateway.key(mode);
  if (!key) throw new Error(`${gateway.label} credentials are not configured`);

  const response = await fetch(`${gateway.baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'x-publishable-api-key': key,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = parseJson(await response.text());
  return { ok: response.ok, status: response.status, data };
}

function assertHttpsTokenUrl(url) {
  let parsed;
  try {
    parsed = new URL(String(url || ''));
  } catch {
    throw new Error('Chargex did not return a card token address');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Chargex card token address is not secure');
  }
  return parsed.toString();
}

/**
 * Turn a tokenize response into the opaqueData object /transact expects.
 * Throws when the processor refused the card details.
 */
export function opaqueDataFromTokenResponse(data) {
  const opaque = data?.opaqueData;
  if (opaque?.dataDescriptor && opaque?.dataValue) {
    return { dataDescriptor: String(opaque.dataDescriptor), dataValue: String(opaque.dataValue) };
  }
  if (opaque?.token) return { token: String(opaque.token) };
  if (data?.token) return { token: String(data.token) };

  const resultCode = String(data?.messages?.resultCode || '');
  if (resultCode && resultCode.toLowerCase() !== 'ok') {
    const first = data.messages?.message?.[0];
    const text = typeof first === 'string' ? first : first?.text;
    throw new Error(text || 'Card could not be tokenized');
  }

  throw new Error('Chargex did not return a card token');
}

/**
 * Map a /transact body onto the status shape the checkout routes already store.
 * Returns null when the answer is not a clear approval or a clear decline.
 */
export function transactionFromChargxResponse(data, httpOk) {
  const message = String(data?.message || '').trim();
  const errors = Array.isArray(data?.error) ? data.error : [];
  const errorText = errors.map((entry) => entry?.errorText).filter(Boolean).join(' ').trim()
    || (typeof data?.error?.message === 'string' ? data.error.message.trim() : '');
  const theirId = data?.result?.orderId ? String(data.result.orderId) : null;
  const displayId = data?.result?.orderDisplayId ? String(data.result.orderDisplayId) : null;

  if (httpOk && /^ok$/i.test(message) && theirId) {
    return {
      id: theirId,
      status: 'Approved',
      authorization: displayId,
      descriptor_text: 'Chargex',
      message: 'Ok',
    };
  }

  if (errors.length || /declin|error/i.test(message)) {
    const reason = errorText || message || 'This transaction has been declined.';
    return {
      id: theirId,
      status: 'Declined',
      authorization: displayId,
      descriptor_text: 'Chargex',
      message: reason,
      error: { message: reason },
    };
  }

  return null;
}

function countryCode3(country) {
  const value = String(country || '').trim().toUpperCase();
  if (value === 'CR' || value === 'CRI' || value === 'COSTA RICA') return 'CRI';
  if (value === 'US' || value === 'USA' || value === 'UNITED STATES') return 'USA';
  if (/^[A-Z]{3}$/.test(value)) return value;
  return 'CRI';
}

function billingAddressForChargx(billing = {}, phone = '') {
  return {
    street: billing.address || 'N/A',
    unit: '',
    city: billing.city || 'San Jose',
    state: billing.state || 'San Jose',
    zipCode: billing.postal_code || '10101',
    countryCode: countryCode3(billing.country),
    phone: phone || undefined,
  };
}

/**
 * Tokenize the card with Chargex, then charge it.
 *
 * The card number is posted only to the token address Chargex just handed us.
 * It is not written to the order, and it is not included in the error text.
 *
 * mode 'test' refuses to continue when that key belongs to a live store.
 *
 * Chargex only: this is the admin sandbox tool, which charges the Chargex test
 * store. `CARD_GATEWAY` does not move it, so a live card is never typed here.
 */
export async function processChargxCardPayment({
  amount,
  orderId,
  customer = {},
  billing = {},
  card = {},
}, { mode = 'live' } = {}) {
  if (!isGatewayConfigured('chargx', mode)) {
    throw new Error('Chargex credentials are not configured');
  }

  const pre = await chargxRequest('/pretransact', { mode, gatewayId: 'chargx' });
  if (!pre.ok || !pre.data?.cardTokenRequestUrl || !pre.data?.cardTokenRequestParams) {
    throw new Error(`Chargex pretransact failed (${pre.status})`);
  }
  if (mode === 'test' && pre.data.isProduction === true) {
    throw new Error('Chargex test key belongs to a live store. Refusing the charge.');
  }

  const expirationDate = `${String(card.expiry_month || '').padStart(2, '0')}${String(card.expiry_year || '')}`;
  const tokenBody = JSON.parse(
    JSON.stringify(pre.data.cardTokenRequestParams)
      .replaceAll('#cardNumber#', String(card.number || ''))
      .replaceAll('#expirationDate#', expirationDate)
      .replaceAll('#cardCode#', String(card.cvv || '')),
  );

  const tokenUrl = assertHttpsTokenUrl(pre.data.cardTokenRequestUrl);
  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(tokenBody),
  });
  const tokenData = parseJson(await tokenResponse.text());
  if (!tokenResponse.ok && !tokenData?.opaqueData && !tokenData?.token) {
    throw new Error(`Chargex card tokenization failed (${tokenResponse.status})`);
  }
  const opaqueData = opaqueDataFromTokenResponse(tokenData);

  const charged = await chargxRequest('/transact', {
    mode,
    gatewayId: 'chargx',
    method: 'POST',
    body: {
      currency: 'USD',
      amount: String(amount),
      type: 'fiat',
      opaqueData,
      cvv: String(card.cvv || ''),
      customer: {
        name: customer.name,
        email: customer.email,
        ...(customer.phone ? { phone: customer.phone } : {}),
      },
      billingAddress: billingAddressForChargx(billing, customer.phone),
      orderId: String(orderId),
    },
  });

  const transaction = transactionFromChargxResponse(charged.data, charged.ok);
  if (!transaction) {
    throw new Error(`Chargex charge was not confirmed (${charged.status})`);
  }
  return transaction;
}

/** The three ways Chargex's hosted page can take payment (their `type` field). */
export const CHARGX_PAYMENT_TYPES = ['card', 'ach', 'crypto'];

/** Anything we do not recognise is a card, which is what every order was before. */
export function normalizeChargxPaymentType(value) {
  const type = String(value || '').trim().toLowerCase();
  return CHARGX_PAYMENT_TYPES.includes(type) ? type : 'card';
}

/**
 * Open the gateway's own payment page. The store refuses a card typed on our
 * site. Amount is dollars, as a number. The returned page says whether the key
 * is live. `type` picks card, ach or crypto — and with it the gateway, so a
 * card and a bank transfer can sit on two different stores at the same time.
 * The name stays because other code imports it.
 */
export async function createChargxCardCheckout({
  amount,
  successUrl,
  cancelUrl,
  type = 'card',
}, { mode = 'live' } = {}) {
  const paymentType = normalizeChargxPaymentType(type);
  const gateway = gatewayConfig(gatewayIdForPaymentType(paymentType));
  if (!gateway.key(mode)) {
    throw new Error(`${gateway.label} credentials are not configured`);
  }

  const dollars = Number(Number(amount).toFixed(2));
  if (!Number.isFinite(dollars) || dollars <= 0) {
    throw new Error(`${gateway.label} payment amount is not usable`);
  }

  const body = {
    amount: dollars,
    currency: 'usd',
    success_url: successUrl,
    type: paymentType,
  };
  if (cancelUrl) body.cancel_url = cancelUrl;

  const request = { mode, method: 'POST', body, gatewayId: gateway.id };
  let created = await chargxRequest('/v1/payment-request', request);
  if (!created.ok && cancelUrl && /cancel_url/i.test(String(created.data?.message || ''))) {
    delete body.cancel_url;
    created = await chargxRequest('/v1/payment-request', request);
  }

  const page = created.data?.payment_request;
  if (!created.ok || !page?.checkout_url) {
    throw new Error(created.data?.message || `${gateway.label} payment page failed (${created.status})`);
  }
  if (mode === 'test' && page.isProduction === true) {
    throw new Error(`${gateway.label} test key belongs to a live store. Refusing the charge.`);
  }

  return {
    id: String(page.id),
    status: 'Redirect',
    redirect_url: String(page.checkout_url),
    isProduction: page.isProduction === true,
    payment_type: paymentType,
    // Which store this payment is on. Written to the order as the descriptor,
    // so a refund, a dispute or a reconciliation goes to the right dashboard.
    gateway: gateway.id,
    gateway_label: gateway.label,
  };
}

/**
 * Put the order number and the address on Chargex's page so the customer
 * does not type them again. The order number is how their webhook finds us.
 */
export function withChargxCheckoutDetails(checkoutUrl, {
  orderNumber,
  email,
  phone,
  billing = {},
} = {}) {
  const url = new URL(checkoutUrl);
  if (orderNumber) url.searchParams.set('external_order_id', String(orderNumber));
  if (email) url.searchParams.set('email', String(email));
  if (phone) url.searchParams.set('phone-number', String(phone));
  if (billing.address) url.searchParams.set('street-address', String(billing.address));
  if (billing.city) url.searchParams.set('city', String(billing.city));
  if (billing.state) url.searchParams.set('state', String(billing.state));
  if (billing.postal_code) url.searchParams.set('zip-code', String(billing.postal_code));
  url.searchParams.set('country', String(billing.country || 'CR').toUpperCase() === 'USA' ? 'US' : 'CR');
  return url.toString();
}

/**
 * Which gateway signed this webhook, by trying every secret we hold.
 *
 * Both gateways sign the same way, and both deliver to the same handler, so
 * the secret that verifies is also the answer to "who is telling us this".
 * Returns `{ id, label }`, or null when nothing matched.
 */
export function gatewayForWebhookSignature({ timestamp, signatureHeader, rawBody }) {
  for (const id of PAYMENT_GATEWAY_IDS) {
    const gateway = gatewayConfig(id);
    const secret = gateway.webhookSecret();
    if (!secret) continue;
    if (verifyChargxWebhookSignature({ secret, timestamp, signatureHeader, rawBody })) {
      return { id: gateway.id, label: gateway.label };
    }
  }
  return null;
}

/** The gateways whose webhook secret is set, for "verification unavailable". */
export function webhookGatewayIds() {
  return PAYMENT_GATEWAY_IDS.filter((id) => Boolean(gatewayConfig(id).webhookSecret()));
}

/** HMAC of `{timestamp}.{rawBody}`, matching the Chargex webhook signature header. */
export function verifyChargxWebhookSignature({ secret, timestamp, signatureHeader, rawBody }) {
  if (!secret || !timestamp || !signatureHeader || rawBody == null) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const offered = String(signatureHeader)
    .split(/\s+/)
    .map((part) => (part.startsWith('v1=') ? part.slice(3) : part))
    .filter((part) => part.length === expected.length);

  const expectedBuf = Buffer.from(expected);
  return offered.some((part) => crypto.timingSafeEqual(Buffer.from(part), expectedBuf));
}

/**
 * A cardholder name the gateway will accept.
 *
 * Accents are stripped and anything that is not a letter or a space is
 * dropped: a Costa Rican name typed with tildes used to be rejected outright.
 * Lived in the old Shield Hub Pay client; it is a card-field rule, not that
 * gateway's, so it moved here when that gateway was removed.
 */
export function normalizeCardHolderName(value, fallback = 'Customer') {
  const clean = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean) return clean;
  if (fallback && fallback !== value) return normalizeCardHolderName(fallback, 'Customer');
  return 'Customer';
}
