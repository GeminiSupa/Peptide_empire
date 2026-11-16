import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyTouch,
  decodeTouchState,
  encodeTouchState,
  gclidFromConversionLinker,
  mergeTouch,
  orderAttributionColumns,
  readTouchCookie,
  touchFromVisit,
  agentSourceColumns,
  leadAttributionColumns,
} from '../src/lib/channelAttribution.mjs';

const now = Date.parse('2026-11-16T18:00:00Z');
const visit = (href, referrer = '') => touchFromVisit({ href, referrer, now });

test('each channel rule from the brief, first match wins', () => {
  assert.equal(visit('https://peptidescostarica.net/?gclid=abc').ch, 'google_ads');
  assert.equal(visit('https://peptidescostarica.net/?gbraid=abc').ch, 'google_ads');
  assert.equal(visit('https://peptidescostarica.net/?utm_source=google&utm_medium=cpc').ch, 'google_ads');
  assert.equal(visit('https://peptidescostarica.net/?fbclid=x&utm_medium=paid').ch, 'meta_ads');
  assert.equal(visit('https://peptidescostarica.net/?utm_source=instagram&utm_medium=paid_social').ch, 'meta_ads');
  assert.equal(visit('https://peptidescostarica.net/?ttclid=E.C.P').ch, 'tiktok_ads');
  assert.equal(visit('https://peptidescostarica.net/?utm_source=tiktok&utm_medium=cpc').ch, 'tiktok_ads');
  assert.equal(visit('https://peptidescostarica.net/?utm_medium=email&utm_campaign=bf').ch, 'email');
  assert.equal(visit('https://peptidescostarica.net/?utm_medium=whatsapp').ch, 'whatsapp_sms_campaign');
  assert.equal(visit('https://peptidescostarica.net/?utm_medium=sms').ch, 'whatsapp_sms_campaign');
  assert.equal(visit('https://peptidescostarica.net/bpc-157/', 'https://www.google.com/').ch, 'organic_search');
  assert.equal(visit('https://peptidescostarica.net/', 'https://duckduckgo.com/').ch, 'organic_search');
  assert.equal(visit('https://peptidescostarica.net/', 'https://l.instagram.com/').ch, 'organic_social');
  assert.equal(visit('https://peptidescostarica.net/?fbclid=abc', 'https://l.facebook.com/').ch, 'organic_social', 'fbclid with no paid medium is organic');
  assert.equal(visit('https://peptidescostarica.net/', 'https://somedoctor.cr/links').ch, 'referral');
  assert.equal(visit('https://peptidescostarica.net/').ch, 'direct');
});

test("the media buyer's ?ref= names the platform", () => {
  assert.equal(visit('https://peptidescostarica.net/?ref=tiktok-glp1-a&cid=abc').ch, 'tiktok_ads');
  assert.equal(visit('https://peptidescostarica.net/?ref=meta-bpc&cid=abc').ch, 'meta_ads');
});

test('server-side sources: agent, partner site, Meta lead form', () => {
  assert.equal(classifyTouch({ via: 'agent_referral' }), 'agent_referral');
  assert.equal(classifyTouch({ via: 'partner_site', detail: 'peptidesjaco.com' }), 'partner_site');
  assert.equal(classifyTouch({ via: 'meta_lead_form' }), 'meta_lead_form');
});

test('our own sites and the payment page are never the source', () => {
  assert.equal(visit('https://catalog.peptidescostarica.net/catalog', 'https://peptidescostarica.net/'), null);
  assert.equal(visit('https://catalog.peptidescostarica.net/thank-you', 'https://dashboard.chargx.io/pay'), null);
  // A tagged link inside our own site still counts as an arrival.
  assert.equal(visit('https://peptidescostarica.net/?utm_medium=email', 'https://peptidescostarica.net/x').ch, 'email');
});

test('first touch is kept; last touch follows every non-direct arrival only', () => {
  const ads = visit('https://peptidescostarica.net/?gclid=abc');
  let state = mergeTouch({ v: 'visitor-1234' }, ads, now);
  assert.equal(state.ft.ch, 'google_ads');
  state = mergeTouch(state, { ...visit('https://peptidescostarica.net/'), at: now + 1000 }, now + 1000);
  assert.equal(state.lt.ch, 'google_ads', 'a direct return does not steal the credit');
  state = mergeTouch(state, { ...visit('https://peptidescostarica.net/?utm_medium=email'), at: now + 2000 }, now + 2000);
  assert.equal(state.ft.ch, 'google_ads');
  assert.equal(state.lt.ch, 'email');
  assert.equal(state.v, 'visitor-1234');
});

test('touches older than 90 days are forgotten', () => {
  const old = { ...visit('https://peptidescostarica.net/?gclid=abc'), at: now - 91 * 86400000 };
  const state = mergeTouch({ v: 'visitor-1234', ft: old, lt: old }, visit('https://peptidescostarica.net/?utm_medium=email'), now);
  assert.equal(state.ft.ch, 'email');
});

test('the cookie round-trips and refuses junk', () => {
  const state = mergeTouch({ v: 'visitor-1234' }, visit('https://peptidescostarica.net/?gclid=abc&utm_campaign=glp1'), now);
  const header = `a=1; pcr_touch=${encodeTouchState(state)}; b=2`;
  assert.deepEqual(readTouchCookie(header, now), state);
  assert.equal(decodeTouchState('%7Bnot json', now), null);
  assert.equal(readTouchCookie('pcr_touch=%7B%22v%22%3A%22x%22%7D', now), null);
});

test('a gclid kept by the Conversion Linker', () => {
  const seconds = Math.floor(now / 1000) - 3600;
  assert.deepEqual(gclidFromConversionLinker(`_gcl_aw=GCL.${seconds}.Cj0KCQabc`, now), { gclid: 'Cj0KCQabc', clicked_at: seconds * 1000 });
  assert.equal(gclidFromConversionLinker(`_gcl_aw=GCL.${seconds - 100 * 86400}.old`, now), null);
});

test('order columns from a visitor state', () => {
  const state = mergeTouch({ v: 'visitor-1234' }, visit('https://peptidescostarica.net/?gclid=abc'), now);
  const cols = orderAttributionColumns(mergeTouch(state, visit('https://peptidescostarica.net/?utm_medium=email'), now), 'website');
  assert.equal(cols.ft_channel, 'google_ads');
  assert.equal(cols.lt_channel, 'email');
  assert.equal(cols.captured_by, 'website');
  assert.equal(cols.visitor_id, 'visitor-1234');
  assert.deepEqual(orderAttributionColumns(null), {});
});

test('the Source dropdown on a hand-made order', () => {
  const cols = agentSourceColumns('meta_ads', 'saw it on Instagram', now);
  assert.equal(cols.lt_channel, 'meta_ads');
  assert.equal(cols.captured_by, 'agent');
  assert.equal(cols.agent_source, 'meta_ads');
  assert.equal(cols.source_note, 'saw it on Instagram');
  assert.equal(agentSourceColumns('returning', '', now).lt_channel, 'direct');
  assert.deepEqual(agentSourceColumns('not_sure', '', now), { agent_source: 'not_sure' });
  assert.deepEqual(agentSourceColumns('made_up', '', now), {});
});

test('a lead form keeps its source from the cookie, the posted touch, or its UTM tags', () => {
  const state = mergeTouch({ v: 'visitor-1234' }, visit('https://peptidescostarica.net/lp?gclid=abc'), now);
  assert.equal(leadAttributionColumns({ cookie: 'pcr_touch=' + encodeTouchState(state) }, now).lt_channel, 'google_ads');
  assert.equal(leadAttributionColumns({ touch: state }, now).lt_channel, 'google_ads');
  assert.equal(leadAttributionColumns({ utmSource: 'facebook', utmMedium: 'paid' }, now).lt_channel, 'meta_ads');
  assert.equal(leadAttributionColumns({ adClick: { gclid: 'x' } }, now).lt_channel, 'google_ads');
  assert.deepEqual(leadAttributionColumns({ referrer: 'https://peptidescostarica.net/lp' }, now), {}, 'our own page is not a source');
});
