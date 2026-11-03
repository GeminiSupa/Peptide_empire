import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBusinessAccountEmail, buildBusinessTermsEmail, businessEmailAttachments } from '../src/lib/businessAccountEmail.mjs';
import { planFirstOrderExtraSetting } from '../src/lib/businessFirstOrderExtra.mjs';
import { missingColumnFrom } from '../src/lib/notificationPreferences.mjs';

const company = { id: 'company', email: 'business@example.invalid', legal_name: 'Test Business', contact_name: 'Buyer', status: 'approved', preferred_language: 'en', discount_pct: 25, updated_at: '2026-10-29' };
function fixture(previous = null) {
  const queued = [], sent = [];
  const db = { from(table) { return {
    select() { return this; }, eq() { return this; }, update() { return this; }, insert() { return this; },
    async maybeSingle() { return { data: table === 'business_accounts' ? previous : null }; },
    async single() { return { data: company }; },
  }; } };
  const dependencies = {
    verifyAdminSession: async () => ({}), getSupabaseAdmin: () => db,
    businessDetails: body => ({ legal_name: body.legal_name }), validateBusinessTerms: () => ({}),
    validatedBusinessRep: async () => {}, writeDroppingMissingColumns: (row, _columns, write) => write(row),
    sendBusinessSignupNotifications: async () => [],
    queueBusinessEmail: async (_db, business, letter) => { queued.push({ recipient: business.email, ...letter }); return { sent: true }; },
    buildBusinessAccountEmail, buildBusinessTermsEmail, businessEmailAttachments,
    planFirstOrderExtraSetting, missingColumnFrom,
    resolveBusinessEmailAgent: async () => ({ name: 'Korinne Dankers', photoUrl: 'https://catalog.peptidescostarica.net/team/korinne-dankers.jpg', whatsapp: '50672004080', phone: '+50672004080' }),
    getPublicSiteUrl: () => 'https://catalog.peptidescostarica.net', rateLimit: () => true,
    getOrderMailSettings: () => ({ smtp: { host: 'smtp', user: 'user', pass: 'pass' }, from: 'store@example.invalid' }),
    nodemailer: { createTransport: () => ({ sendMail: async letter => { sent.push(letter); return {}; } }) },
  };
  const source = readFileSync(new URL('../src/app/api/admin/business-accounts/route.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export async function /g, 'async function ');
  const POST = new Function(...Object.keys(dependencies), `${source}\nreturn POST;`)(...Object.values(dependencies));
  return { queued, sent, run: body => POST(new Request('https://example.invalid/api/admin/business-accounts', { method: 'POST', body: JSON.stringify(body) })) };
}

for (const previous of [null, { ...company, status: 'pending' }]) {
  test(`approving ${previous ? 'an existing manual pending account' : 'a new manual account'} queues the styled welcome for the business email`, async () => {
    const f = fixture(previous);
    const response = await f.run({ ...company, id: previous ? company.id : undefined });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).customerNotification.welcome, true);
    assert.equal(f.queued.length, 1);
    assert.equal(f.queued[0].recipient, company.email);
    assert.match(f.queued[0].html, /Korinne Dankers/);
    assert.match(f.queued[0].html, /cid:business-agent/);
  });
}

test('saving an unchanged approved account does not send another welcome', async () => {
  const f = fixture(company);
  assert.equal((await f.run(company)).status, 200);
  assert.equal(f.queued.length, 0);
});

test('resending the welcome sends to the business login email and reports that recipient', async () => {
  const f = fixture(company);
  const response = await f.run({ action: 'invite', id: company.id });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).recipient, company.email);
  assert.equal(f.sent[0].to, company.email);
  assert.ok(f.sent[0].attachments.some(file => file.cid === 'business-agent@peptidescostarica'));
});
