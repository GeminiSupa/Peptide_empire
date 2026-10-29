import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { businessDetails, findBusinessAccount } from '../src/lib/businessAccounts.mjs';
import { readBearerToken } from '../src/lib/customerOrderOwnership.mjs';
import { writeDroppingMissingColumns } from '../src/lib/optionalColumns.mjs';
import { canManageBusiness } from '../src/lib/businessSuite.mjs';

// Exercise the real route handlers with isolated Auth, database and SMTP
// adapters. No production account is created and no real email is sent.
function fixture() {
  const rows = [];
  const mail = [];
  const notifications = [];
  const admin = {
    auth: { async getUser(token) {
      if (token === 'expired') return { error: new Error('Expired') };
      return { data: { user: { email: `${token}@example.invalid`, email_confirmed_at: token === 'unverified' ? null : '2026-10-28T00:00:00Z' } } };
    } },
    from(table) {
      if(table==='business_members')return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:null};}};
      assert.equal(table, 'business_accounts');
      let input;
      let email;
      return {
        insert(value) { input = value; return this; },
        select() { return this; },
        eq(key, value) { assert.equal(key, 'email'); email = value; return this; },
        async maybeSingle() { return { data: rows.find(row => row.email === email) || null }; },
        async single() {
          if (rows.some(row => row.email === input.email || row.corporation_number === input.corporation_number)) return { error: { code: '23505' } };
          const row = { id: `test-${rows.length}`, status: 'pending', discount_pct: 0, ...input };
          rows.push(row);
          return { data: row };
        },
      };
    },
  };
  const dependencies = {
    getSupabaseAdmin: () => admin,
    readBearerToken, businessDetails, findBusinessAccount, writeDroppingMissingColumns, canManageBusiness,
    nodemailer: { createTransport: () => ({ async sendMail(message) { mail.push(message); } }) },
    getOrderMailSettings: () => ({ smtp: { configured: true }, from: 'store@example.invalid' }),
    getPublicSiteUrl: () => 'https://example.invalid',
    buildBusinessAccountEmail: business => ({ subject: 'Application received', text: business.legal_name }),
    getOrderEmailLogoAttachment: () => ({}),
    sendBusinessSignupNotifications: async business => { notifications.push(business); return [{ sent: true }, { sent: true }]; },
    businessProductPrices:async()=>[],
    publicBusiness:business=>business,
    referralBusinessPatch:async()=>({}),
  };
  const source = readFileSync(new URL('../src/app/api/account/business/route.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/export async function /g, 'async function ');
  const handlers = new Function(...Object.keys(dependencies), `${source}\nreturn { GET, POST };`)(...Object.values(dependencies));
  return { ...handlers, rows, mail, notifications };
}

const application = { legal_name: 'Test Business', corporation_number: '3-101-999999', contact_name: 'Test contact', phone: '88880000', billing_address: 'Test address — do not deliver' };
const request = (token, body) => new Request('https://example.invalid/api/account/business', {
  method: body ? 'POST' : 'GET', headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {},
  ...(body ? { body: JSON.stringify(body) } : {}),
});

test('a test business application is saved pending, acknowledged and alerts the team', async () => {
  const f = fixture();
  const response = await f.POST(request('buyer', { ...application, email: 'attacker@example.invalid', status: 'approved', discount_pct: 90 }));
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.business.email, 'buyer@example.invalid');
  assert.equal(data.business.status, 'pending');
  assert.equal(data.business.discount_pct, 0);
  assert.equal(data.business.corporation_number, '3101999999');
  assert.equal(data.business.preferred_language, 'es');
  assert.equal(data.emailSent, true);
  assert.equal(data.staffNotified, true);
  assert.equal(f.mail[0].to, 'buyer@example.invalid');
  assert.equal(f.notifications.length, 1);
  const own = await f.GET(request('buyer'));
  assert.equal((await own.json()).business.legal_name, application.legal_name);
  const other = await f.GET(request('other'));
  assert.equal((await other.json()).business, null);
});

test('anonymous, expired and unverified sessions cannot register or read business accounts', async () => {
  const f = fixture();
  for (const token of [null, 'expired', 'unverified']) {
    assert.equal((await f.GET(request(token))).status, 401);
    assert.equal((await f.POST(request(token, application))).status, 401);
  }
  assert.equal(f.rows.length, 0);
  assert.equal(f.mail.length, 0);
});

test('duplicate applications cannot overwrite terms or send another signup alert', async () => {
  const f = fixture();
  await f.POST(request('buyer', application));
  f.rows[0].status = 'approved'; f.rows[0].discount_pct = 25;
  const duplicate = await f.POST(request('buyer', { ...application, discount_pct: 99 }));
  assert.equal(duplicate.status, 409);
  assert.equal(f.rows[0].discount_pct, 25);
  assert.equal(f.mail.length, 1);
  assert.equal(f.notifications.length, 1);
});

test('an application filled in English makes English the business language', async () => {
  const f = fixture();
  const response = await f.POST(request('buyer', { ...application, lang: 'en' }));
  assert.equal(response.status, 201);
  assert.equal(f.rows[0].preferred_language, 'en');
});
