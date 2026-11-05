import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEAD_HONEYPOT_FIELD, LEAD_SOURCES, leadPayload, saveLead } from '../lib/site/leads.mjs';

test('the lead is posted to the catalog\'s CRM route in the shape it reads', async () => {
  let posted;
  const fetchImpl = async (url, options) => {
    posted = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ success: true, leadId: 'lead-1' }), { status: 200 });
  };

  const result = await saveLead({
    name: ' Ana Rojas ', email: 'ana@example.test', phone: '+506 8404 6973',
    source: LEAD_SOURCES.affiliate, lang: 'en', honeypot: '', formMs: 41000,
  }, { fetchImpl });

  assert.equal(result.ok, true);
  assert.equal(posted.url, 'https://catalog.peptidescostarica.net/api/leads/contact');
  assert.equal(posted.options.method, 'POST');
  assert.deepEqual(posted.body, {
    name: 'Ana Rojas',
    email: 'ana@example.test',
    phone: '+506 8404 6973',
    language: 'en',
    source: 'website_affiliate',
    [LEAD_HONEYPOT_FIELD]: '',
    form_ms: 41000,
  });
});

test('the bot filter fields are the ones the catalog route reads', () => {
  // catalog src/lib/leadSpam.mjs: HONEYPOT_FIELD = 'subject', duration in form_ms.
  const body = leadPayload({ name: 'A', email: 'a@b.co', source: 'x', formMs: 3000 });
  assert.equal(LEAD_HONEYPOT_FIELD, 'subject');
  assert.equal(body.form_ms, 3000);
});

test('no qualification answers are sent, so the lead is not filed as a paid ad lead', () => {
  const body = leadPayload({ name: 'A', email: 'a@b.co', source: 'x', formMs: 3000 }, { utm_source: 'google' });
  for (const key of ['category', 'location', 'volume', 'qualification_data', 'marketing_consent']) {
    assert.equal(key in body, false, `${key} would make the route treat this as an ad lead`);
  }
  assert.equal(body.utm_source, 'google');
});

test('every form has a source that is not mistaken for a Google Ads lead', () => {
  for (const source of Object.values(LEAD_SOURCES)) {
    assert.ok(source.length <= 60);
    assert.equal(/adwords/i.test(source), false);
  }
});

test('a CRM failure is reported, never thrown', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const down = await saveLead({ name: 'A', email: 'a@b.co', source: 'x' }, {
      fetchImpl: async () => { throw new Error('offline'); },
    });
    assert.deepEqual(down, { ok: false, error: 'network' });

    const refused = await saveLead({ name: 'A', email: 'a@b.co', source: 'x' }, {
      fetchImpl: async () => new Response(JSON.stringify({ error: 'contact_required' }), { status: 400 }),
    });
    assert.deepEqual(refused, { ok: false, error: 'contact_required' });
  } finally {
    console.warn = warn;
  }
});
