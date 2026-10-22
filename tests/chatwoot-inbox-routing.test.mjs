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

/* The catalog form opened a fresh conversation per submission, so a customer
   already chatting on WhatsApp collected several, each with a different agent.
   The conversation layer brings catalog leads in now; nothing is opened here,
   and no chatwoot_* column is written, so the Leads tab does not claim a
   failed handover and the 15-minute retry leaves these alone. */
test('a WhatsApp catalog lead is not handed over from the CRM at all', async () => {
  const supabase = fakeSupabase({ enabled: true, catalogInboxId: '99' });
  let called = false;
  const result = await handoverLeadToChatwoot(supabase, {
    id: 'lead-5', phone: '50688887777', whatsapp_consent: true, consent_source: 'catalog_gate',
  }, {
    env: ENV,
    fetchImpl: async () => { called = true; },
  });

  assert.equal(called, false, 'nothing is sent to Chatwoot');
  assert.equal(result.skipped, true);
  assert.equal(result.sent, false);
  assert.equal(supabase.updates.length, 0, 'and no lead row is touched');
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
