// Copied from the catalog (src/lib/gaIdentity.mjs) by scripts/sync-catalog-checkout.mjs. Do not edit.
// The shopper's GA4 client and session IDs live in their Google cookies. They are
// saved on the order at checkout so a later server-side purchase (a WhatsApp sale
// confirmed hours or days afterwards) can be tied to the same visit in GA4.
const CLIENT_RE = /^\d{5,12}\.\d{5,12}$/;
const SESSION_RE = /^\d{9,12}$/;

// _ga = GA1.1.<number>.<number>; the client ID is the last two parts.
export function parseGaClientId(cookie) {
  const match = /^GA\d\.\d+\.(\d{5,12}\.\d{5,12})$/.exec(String(cookie || '').trim());
  return match ? match[1] : null;
}

// _ga_<STREAM> is GS1.1.<session>.<n>... on older tags and GS2.1.s<session>$o1... on newer ones.
export function parseGaSessionId(cookie) {
  const value = String(cookie || '').trim();
  const match = /^GS1\.\d+\.(\d{9,12})\./.exec(value) || /^GS2\.\d+\.s(\d{9,12})(?:\$|$)/.exec(value);
  return match ? match[1] : null;
}

export function readGaIdentity(document) {
  try {
    const jar = new Map(document.cookie.split(';').map(part => part.trim()).filter(Boolean).map(part => {
      const at = part.indexOf('=');
      return [part.slice(0, at), decodeURIComponent(part.slice(at + 1))];
    }));
    const ga_client_id = parseGaClientId(jar.get('_ga'));
    // More than one GA4 stream can leave a cookie; the newest session is the visit that bought.
    let ga_session_id = null;
    for (const [name, value] of jar) {
      if (!/^_ga_[A-Z0-9]+$/.test(name)) continue;
      const session = parseGaSessionId(value);
      if (session && (!ga_session_id || Number(session) > Number(ga_session_id))) ga_session_id = session;
    }
    return { ...(ga_client_id ? { ga_client_id } : {}), ...(ga_session_id ? { ga_session_id } : {}) };
  } catch { return {}; }
}

// What the browser sent is a claim: keep it only if it is shaped like a real ID.
export function sanitizeGaIdentity(value) {
  const client = String(value?.ga_client_id || '');
  const session = String(value?.ga_session_id || '');
  return { ga_client_id: CLIENT_RE.test(client) ? client : null, ga_session_id: SESSION_RE.test(session) ? session : null };
}
