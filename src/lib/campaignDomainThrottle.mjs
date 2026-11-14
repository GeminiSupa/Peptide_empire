/**
 * Per-domain send throttle for email campaigns.
 *
 * Phase 1 made a campaign drain continuously. That is right for Gmail and most
 * mailboxes, but a few providers (Microsoft's Hotmail/Outlook/Live/MSN and
 * Apple's iCloud/me/mac) throttle and spam-fold a sender who arrives in a rush
 * while their reputation is still building. So those domains are sent LAST and
 * on a slow clock, while every other address keeps full speed.
 *
 * This file only decides which addresses are "slow" and in what order they go.
 * The actual pacing is the existing send loop: it sleeps `slowSendDelayMs`
 * after a slow-domain send instead of `sendDelayMs`, and the 240s function
 * budget plus Phase 1's chaining spread the slow ones across many runs. A
 * ~12s slow delay therefore works out to roughly 300 slow emails an hour,
 * which is the "a few hundred per hour" the owner asked for, without making
 * anyone else wait.
 *
 * Both lists are overridable from the server environment with no deploy:
 *   EMAIL_CAMPAIGN_SLOW_DOMAINS       comma list; empty string turns it OFF
 *   EMAIL_CAMPAIGN_SLOW_SEND_DELAY_MS ms between slow-domain sends
 */

export const DEFAULT_SLOW_DOMAINS = Object.freeze([
  // Microsoft consumer mail — one reputation across all of these.
  'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.es', 'hotmail.it',
  'hotmail.de', 'outlook.com', 'outlook.es', 'outlook.fr', 'outlook.de',
  'live.com', 'live.co.uk', 'live.fr', 'msn.com', 'windowslive.com',
  // Apple mail.
  'icloud.com', 'me.com', 'mac.com',
]);

/**
 * Parse the slow-domain list from an env string. `undefined`/`null` keeps the
 * default; an empty or whitespace string is a deliberate "throttle nothing".
 */
export function parseSlowDomains(raw, fallback = DEFAULT_SLOW_DOMAINS) {
  if (raw === undefined || raw === null) return [...fallback];
  return String(raw)
    .split(',')
    .map(part => part.trim().toLowerCase())
    .filter(Boolean);
}

/** The domain part of an address, lowercased. '' when there is no '@'. */
export function emailDomain(email) {
  const value = String(email || '').trim().toLowerCase();
  const at = value.lastIndexOf('@');
  return at === -1 ? '' : value.slice(at + 1);
}

/** True when this address belongs to a throttled (slow-reputation) provider. */
export function isSlowDomain(email, slowDomains = DEFAULT_SLOW_DOMAINS) {
  if (!Array.isArray(slowDomains) || slowDomains.length === 0) return false;
  const domain = emailDomain(email);
  return domain ? slowDomains.includes(domain) : false;
}

/**
 * Fast-reputation addresses first, slow ones last, order otherwise preserved.
 *
 * Because the send walks this list from the front and each run takes a slice,
 * the fast majority drains in the first runs at full speed and the slow tail
 * trickles out afterwards on its own clock. Returns the input untouched when
 * throttling is off.
 */
export function orderFastFirst(targets, slowDomains = DEFAULT_SLOW_DOMAINS) {
  if (!Array.isArray(targets) || !Array.isArray(slowDomains) || slowDomains.length === 0) {
    return targets;
  }
  const fast = [];
  const slow = [];
  for (const target of targets) {
    if (isSlowDomain(target?.email, slowDomains)) slow.push(target);
    else fast.push(target);
  }
  return [...fast, ...slow];
}
