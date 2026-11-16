/**
 * Browser half of channel attribution: on each page load, fold this arrival
 * into the visitor's first/last touch and save it in the `pcr_touch` cookie.
 *
 * The cookie lives on .peptidescostarica.net, so the main site and the catalog
 * read and write the same one, and checkout (same site) receives it with the
 * order. The visitor id is the analytics tracker's shared `pcr_visitor_id`.
 */

import {
  TOUCH_COOKIE,
  TOUCH_TTL_MS,
  encodeTouchState,
  mergeTouch,
  readTouchCookie,
  touchFromVisit,
} from './channelAttribution.mjs';

const VISITOR_COOKIE = 'pcr_visitor_id';

function readCookie(document, name) {
  const raw = String(document.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!raw) return '';
  try {
    return decodeURIComponent(raw.slice(name.length + 1));
  } catch {
    return '';
  }
}

/** Save this page load as a touch. Returns the visitor's state, or null. */
export function captureTouch(location, document, now = Date.now()) {
  try {
    const touch = touchFromVisit({ href: location.href, referrer: document.referrer || '', now });
    const previous = readTouchCookie(document.cookie, now);
    // A page reached from our own site, with nothing new, changes nothing.
    if (!touch && previous) return previous;
    const visitor = readCookie(document, VISITOR_COOKIE).replace(/^visitor_/, '').slice(0, 64);
    const state = mergeTouch({ ...(previous || {}), ...(previous?.v ? {} : { v: visitor }) }, touch, now);
    if (!state.ft && !state.lt) return null;
    const host = location.hostname || '';
    const shared = host === 'peptidescostarica.net' || host.endsWith('.peptidescostarica.net');
    document.cookie = `${TOUCH_COOKIE}=${encodeTouchState(state)}; Max-Age=${TOUCH_TTL_MS / 1000}; Path=/; SameSite=Lax`
      + `${location.protocol === 'https:' ? '; Secure' : ''}${shared ? '; Domain=.peptidescostarica.net' : ''}`;
    return state;
  } catch {
    return null;
  }
}

/** The visitor's saved state, for a form or checkout to send along. */
export function readTouch(document, now = Date.now()) {
  try {
    return readTouchCookie(document.cookie, now);
  } catch {
    return null;
  }
}
