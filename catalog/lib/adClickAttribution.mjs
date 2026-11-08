// Copied from the catalog (src/lib/adClickAttribution.mjs) by scripts/sync-catalog-checkout.mjs. Do not edit.
export const CLICK_COOKIE = 'pcr_google_click';
export const CLICK_TTL = 90 * 86400000;
export function sanitizeAdAttribution(value, now = Date.now()) {
  if (!value || typeof value !== 'object') return null;
  const at = Number(value.clicked_at);
  if (!Number.isFinite(at) || at > now + 60000 || now - at > CLICK_TTL) return null;
  const result = { clicked_at: at };
  for (const key of ['gclid', 'gbraid', 'wbraid']) if (/^[A-Za-z0-9_.~+=/-]{1,512}$/.test(String(value[key] || ''))) result[key] = String(value[key]);
  return Object.keys(result).length > 1 ? result : null;
}
export function captureAdClick(location, document, now = Date.now()) {
  try {
    const params = new URLSearchParams(location.search);
    const click = sanitizeAdAttribution({ gclid: params.get('gclid'), gbraid: params.get('gbraid'), wbraid: params.get('wbraid'), clicked_at: now }, now);
    if (click) document.cookie = `${CLICK_COOKIE}=${encodeURIComponent(JSON.stringify(click))}; Max-Age=${CLICK_TTL / 1000}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}${location.hostname.endsWith('.peptidescostarica.net') || location.hostname === 'peptidescostarica.net' ? '; Domain=.peptidescostarica.net' : ''}`;
    return click;
  } catch { return null; }
}
export function readAdClick(document, now = Date.now()) {
  try { const raw = document.cookie.split(';').map(s => s.trim()).find(s => s.startsWith(`${CLICK_COOKIE}=`)); return raw ? sanitizeAdAttribution(JSON.parse(decodeURIComponent(raw.slice(CLICK_COOKIE.length + 1))), now) : null; } catch { return null; }
}
