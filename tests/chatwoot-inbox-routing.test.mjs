import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  chatwootLeadInboxIds,
  inboxIdForLeadSource,
  normalizeInboxId,
  saveChatwootLeadSetting,
} from '../src/lib/chatwootInboxes.mjs';
import { handoverLeadToChatwoot, sendAdLeadToChatwoot } from '../src/lib/chatwootLead.mjs';

// '34' is the original Google Ads WhatsApp number's inbox; '99' stands for the
// catalog number's own inbox, the one saved in the admin portal.
const ENV = {
  CHATWOOT_BASE_URL: 'https://chat.example.com/',
  CHATWOOT_ACCOUNT_ID: '12',
  CHATWOOT_INBOX_ID: '34',
  CHATWOOT_INBOX_IDUSA: '152489',
  CHATWOOT_API_ACCESS_TOKEN: 'server-secret',
};

const INBOXES = { adInboxId: '34', catalogInboxId: '99' };

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** Enough Supabase for the handover: the setting row and the status write. */
function fakeSupabase(setting = { enabled: true, catalogInboxId: '99' }) {
  const updates = [];
  return {
    updates,
    from(table) {
      if (table === 'site_settings') {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data: { value: setting }, error: null }),
        };
        return query;
      }
      if (table === 'catalog_leads') {
        return {
          update: (row) => {
            updates.push(row);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (table === 'admin_profiles') {
        return { select: async () => ({ data: [], error: null }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

test('ad and TikTok leads keep the original inbox, catalog leads get the catalog one', () => {
  assert.equal(inboxIdForLeadSource('adwords_lp', INBOXES), '34');
  assert.equal(inboxIdForLeadSource('glp1_lp', INBOXES), '34');
  assert.equal(inboxIdForLeadSource('tiktok_form', INBOXES), '34');
  assert.equal(inboxIdForLeadSource('catalog_gate', INBOXES), '99');
  assert.equal(inboxIdForLeadSource('catalog_reprompt', INBOXES), '99');
  assert.equal(inboxIdForLeadSource('catalog_whatsapp', INBOXES), '99');
  // Anything that is not a paid-ad source counts as catalog, so a source nobody
  // has thought of yet cannot quietly land in the Google Ads inbox.
  assert.equal(inboxIdForLeadSource('contact_form', INBOXES), '99');
  assert.equal(inboxIdForLeadSource('', INBOXES), '99');
});

test('an unset catalog inbox never falls back to the ad inbox', () => {
  assert.equal(inboxIdForLeadSource('catalog_gate', { adInboxId: '34', catalogInboxId: '' }), '');
  assert.equal(inboxIdForLeadSource('catalog_gate', { adInboxId: '34' }), '');
  // The ad side is unaffected by the catalog inbox being missing.
  assert.equal(inboxIdForLeadSource('adwords_lp', { adInboxId: '34' }), '34');
});

test('the inbox list for reading Chatwoot back covers both and drops blanks', () => {
  assert.deepEqual(chatwootLeadInboxIds(INBOXES), ['34', '99']);
  assert.deepEqual(chatwootLeadInboxIds({ adInboxId: '34', catalogInboxId: '' }), ['34']);
  assert.deepEqual(chatwootLeadInboxIds({ adInboxId: '34', catalogInboxId: '34' }), ['34']);
  assert.deepEqual(chatwootLeadInboxIds({}), []);
  assert.deepEqual(
    chatwootLeadInboxIds({ adInboxId: '34', usaInboxId: '152489', catalogInboxId: '99' }),
    ['34', '152489', '99'],
  );
});

test('the admin field takes an inbox id and refuses a pasted URL or phone number', () => {
  assert.deepEqual(normalizeInboxId('7'), { ok: true, inboxId: '7' });
  assert.deepEqual(normalizeInboxId('  99 '), { ok: true, inboxId: '99' });
  assert.deepEqual(normalizeInboxId(''), { ok: true, inboxId: '' });
  assert.equal(normalizeInboxId('https://chat.example.com/app/accounts/12/inboxes/7').ok, false);
  assert.equal(normalizeInboxId('+15415969834').ok, false);
  assert.equal(normalizeInboxId('(541) 596-9834').ok, false);
});

test('no inbox for a lead means no Chatwoot call and a reason an admin can act on', async () => {
  let called = false;
  const result = await sendAdLeadToChatwoot({
    leadId: 'lead-1', source: 'catalog_gate', inboxId: '', env: ENV,
    fetchImpl: async () => { called = true; },
  });
  assert.equal(called, false);
  assert.equal(result.configured, false);
  assert.equal(result.sent, false);
  assert.match(result.error, /catalog WhatsApp inbox ID/);
});

test('the chosen inbox wins over the environment inbox', async () => {
  const calls = [];
  const replies = [
    response({ inbox_identifier: 'catalog-inbox-key' }),
    response({ id: 50, source_id: 'contact-source' }),
    response({ id: 60 }),
    response({ id: 70 }),
  ];
  const result = await sendAdLeadToChatwoot({
    leadId: 'lead-2', phone: '50688887777', source: 'catalog_gate', inboxId: '99', env: ENV,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return replies.shift();
    },
  });
  assert.equal(result.sent, true);
  assert.match(calls[0].url, /\/api\/v1\/accounts\/12\/inboxes\/99$/);
  assert.match(calls[1].url, /\/public\/api\/v1\/inboxes\/catalog-inbox-key\/contacts$/);
  assert.equal(JSON.parse(calls[1].options.body).identifier, 'crm-lead-lead-2');
});

test('an ad lead is handed to the ad inbox', async () => {
  const seen = [];
  const queue = [
    response({ inbox_identifier: 'key' }),
    response({ id: 1, source_id: 'src' }),
    response({ id: 2 }),
    response({ id: 3 }),
  ];
  await handoverLeadToChatwoot(fakeSupabase(), {
    id: 'lead-6', phone: '50688887777', lead_source: 'adwords_lp',
  }, {
    env: ENV,
    fetchImpl: async (url) => { seen.push(url); return queue.shift(); },
  });
  assert.match(seen[0], /\/inboxes\/34$/, 'ad lead uses the Google Ads inbox');
});

test('a USA-qualified ad lead is handed to CHATWOOT_INBOX_IDUSA', async () => {
  const seen = [];
  const queue = [
    response({ inbox_identifier: 'usa-key' }),
    response({ id: 1, source_id: 'src' }),
    response({ id: 2 }),
    response({ id: 3 }),
  ];
  await handoverLeadToChatwoot(fakeSupabase(), {
    id: 'lead-us',
    phone: '13055550100',
    lead_source: 'adwords_lp',
    qualification_data: { location: 'United States' },
  }, {
    env: ENV,
    fetchImpl: async (url) => { seen.push(url); return queue.shift(); },
  });
  assert.match(seen[0], /\/inboxes\/152489$/, 'USA lead uses its own inbox');
});

test('a WhatsApp catalog opt-in is handed to the catalog inbox', async () => {
  const supabase = fakeSupabase({ enabled: true, catalogInboxId: '99' });
  const seen = [];
  const queue = [
    response({ inbox_identifier: 'catalog-key' }),
    response({ id: 1, source_id: 'src' }),
    response({ id: 2 }),
    response({ id: 3 }),
  ];
  const result = await handoverLeadToChatwoot(supabase, {
    id: 'lead-5', phone: '50688887777', whatsapp_consent: true, consent_source: 'catalog_gate',
  }, {
    env: ENV,
    fetchImpl: async (url) => { seen.push(url); return queue.shift(); },
  });

  assert.match(seen[0], /\/inboxes\/99$/, 'catalog lead uses the catalog inbox');
  assert.equal(result.sent, true);
  assert.equal(supabase.updates[0].chatwoot_status, 'sent');
});

test('every surface that reads Chatwoot back asks for both inboxes', async () => {
  // Each of these filtered on CHATWOOT_INBOX_ID alone, which would drop or
  // ignore every catalog chat the moment catalog leads moved inbox.
  const files = [
    'src/app/api/webhooks/chatwoot/route.js',
    'src/app/api/cron/chatwoot-owner-sync/route.js',
    'src/app/api/admin/chatwoot-assignees/route.js',
  ];
  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /chatwootLeadInboxIds\(/, `${file} must read every lead inbox`);
    assert.match(source, /CHATWOOT_INBOX_IDUSA/, `${file} must include the USA inbox`);
    assert.doesNotMatch(
      source,
      /inbox_id=\$\{encodeURIComponent\(config\.inboxId\)\}/,
      `${file} must not query one inbox only`,
    );
  }
});

test('the admin portal can set the catalog inbox without a redeploy', async () => {
  const [adminRoute, teamScreen] = await Promise.all([
    readFile(new URL('../src/app/api/admin/notification-recipients/route.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/admin/TeamManagement.js', import.meta.url), 'utf8'),
  ]);
  assert.match(adminRoute, /chatwootCatalogInboxId/);
  assert.match(adminRoute, /normalizeInboxId\(/);
  // The switch and the inbox share one settings row, so both must merge into it
  // rather than replace it.
  assert.match(adminRoute, /saveChatwootLeadSetting\(supabase, \{ enabled \}\)/);
  assert.match(adminRoute, /saveChatwootLeadSetting\(supabase, \{ catalogInboxId: inboxId \}\)/);
  assert.match(teamScreen, /Catalog WhatsApp inbox/);
  assert.match(teamScreen, /chatwootCatalogInboxId/);
});

/* Meta (Facebook/Instagram) lead-form leads: their own API inbox in Chatwoot,
   set in the admin like the catalog one. */
const META_INBOXES = { adInboxId: '34', catalogInboxId: '99', metaInboxId: '55' };

test('Meta leads go to the Meta inbox, never the ad or catalog one', () => {
  assert.equal(inboxIdForLeadSource('meta_lead_ads', META_INBOXES), '55');
  assert.equal(inboxIdForLeadSource('adwords_lp', META_INBOXES), '34');
  assert.equal(inboxIdForLeadSource('tiktok_form', META_INBOXES), '34');
  assert.equal(inboxIdForLeadSource('catalog_gate', META_INBOXES), '99');
  assert.equal(
    inboxIdForLeadSource('meta_lead_ads', { adInboxId: '34', catalogInboxId: '99' }),
    '',
    'no Meta inbox saved means no inbox, not the ad inbox',
  );
});

test('the Meta inbox is one of the inboxes read back', () => {
  assert.deepEqual(chatwootLeadInboxIds(META_INBOXES), ['34', '99', '55']);
  assert.deepEqual(chatwootLeadInboxIds({ adInboxId: '34', metaInboxId: '55' }), ['34', '55']);
});

test('a Meta lead is handed to the Meta inbox with its own contact identifier', async () => {
  const calls = [];
  const queue = [
    response({ inbox_identifier: 'meta-key' }),
    response({ id: 1, source_id: 'src' }),
    response({ id: 2 }),
    response({ id: 3 }),
  ];
  const supabase = fakeSupabase({ enabled: true, catalogInboxId: '99', metaInboxId: '55' });
  const result = await handoverLeadToChatwoot(supabase, {
    id: 'lead-meta', name: 'Ana Perez', email: 'ana@example.com', phone: '50688887777',
    lead_source: 'meta_lead_ads', utm_source: 'facebook_ads', utm_medium: 'lead_form',
  }, {
    env: ENV,
    fetchImpl: async (url, options) => { calls.push({ url, options }); return queue.shift(); },
  });

  assert.equal(result.sent, true);
  assert.match(calls[0].url, /\/api\/v1\/accounts\/12\/inboxes\/55$/, 'Meta inbox, not 34 or 99');
  assert.equal(JSON.parse(calls[1].options.body).identifier, 'meta-lead-lead-meta');
  assert.match(JSON.parse(calls[3].options.body).content, /^New Meta ad lead\n/);
  assert.equal(supabase.updates[0].chatwoot_status, 'sent');
});

test('a Meta lead with no Meta inbox saved waits, and says which field to fill in', async () => {
  let called = false;
  const supabase = fakeSupabase({ enabled: true, catalogInboxId: '99' });
  const result = await handoverLeadToChatwoot(supabase, {
    id: 'lead-meta-2', phone: '50688887777', lead_source: 'meta_lead_ads',
  }, {
    env: ENV,
    fetchImpl: async () => { called = true; },
  });

  assert.equal(called, false, 'nothing is sent anywhere, least of all the ad inbox');
  assert.equal(result.sent, false);
  assert.match(result.error, /Meta Ads inbox ID/);
  assert.equal(supabase.updates[0].chatwoot_status, 'not_configured', 'the 15-minute retry picks it up');
});

test('the Facebook lead handler sends each new lead to Chatwoot, and the admin can set the Meta inbox', async () => {
  const [facebook, adminRoute, teamScreen] = await Promise.all([
    readFile(new URL('../src/app/api/facebook/webhook/route.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/api/admin/notification-recipients/route.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/admin/TeamManagement.js', import.meta.url), 'utf8'),
  ]);
  assert.match(facebook, /handoverLeadToChatwoot\(/);
  assert.match(facebook, /lead_source: META_LEAD_SOURCE/);
  assert.match(adminRoute, /chatwootMetaInboxId/);
  assert.match(adminRoute, /saveChatwootLeadSetting\(supabase, \{ metaInboxId: inboxId \}\)/);
  assert.match(teamScreen, /Meta Ads inbox/);
  assert.match(teamScreen, /chatwootMetaInboxId/);

  for (const file of [
    'src/app/api/webhooks/chatwoot/route.js',
    'src/app/api/cron/chatwoot-owner-sync/route.js',
    'src/app/api/admin/chatwoot-assignees/route.js',
  ]) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /metaInboxId: await loadMetaInboxId\(/, `${file} must read the Meta inbox too`);
  }
});

test('saving one field keeps the other: the switch and the inbox share a row', async () => {
  const writes = [];
  const stored = { enabled: false, catalogInboxId: '99' };
  const supabase = {
    from: () => ({
      select: function () { return this; },
      eq: function () { return this; },
      maybeSingle: async () => ({ data: { value: stored }, error: null }),
      upsert: async (row) => { writes.push(row); return { error: null }; },
    }),
  };

  await saveChatwootLeadSetting(supabase, { enabled: true });
  assert.deepEqual(writes[0].value, { enabled: true, catalogInboxId: '99' }, 'the inbox survives a switch save');

  await saveChatwootLeadSetting(supabase, { catalogInboxId: '7' });
  assert.deepEqual(writes[1].value, { enabled: false, catalogInboxId: '7' }, 'the switch survives an inbox save');
  assert.equal(writes[1].id, 'google_ads_chatwoot');
});
