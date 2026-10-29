import test from 'node:test';
import assert from 'node:assert/strict';
import { businessEmailAgentFromProfile, resolveBusinessEmailAgent } from '../src/lib/businessEmailAgent.mjs';
import { buildBusinessAccountEmail, businessEmailAttachments } from '../src/lib/businessAccountEmail.mjs';
import { sendBusinessSignupNotifications } from '../src/lib/businessSignupNotifications.mjs';

const profile = { user_id: 'dani', name: 'Dani', email: 'dani@example.invalid', status: 'active', tier: 'staff', avatar_url: 'https://example.invalid/dani.jpg', whatsapp_number: '+506 8888 7777' };
const business = { id: 'company', rep_user_id: 'dani', legal_name: 'Test Business', email: 'buyer@example.invalid', preferred_language: 'en', status: 'approved', discount_pct: 20 };
const db = value => ({ from(table) { assert.equal(table, 'admin_profiles'); return { select() { return this; }, eq(key, id) { assert.equal(key, 'user_id'); assert.equal(id, 'dani'); return this; }, async maybeSingle() { return { data: value }; } }; } });

test('the selected agent supplies name, photo, WhatsApp and the queued MIME attachment', async () => {
  const agent = await resolveBusinessEmailAgent(db(profile), business);
  const letter = buildBusinessAccountEmail(business, undefined, { agent });
  assert.match(letter.html, /Meet Dani, your account manager/);
  assert.match(letter.html, /phone=50688887777/);
  assert.doesNotMatch(letter.html, /Korinne|72004080/);
  // The outbox only persists HTML; attachment recovery must use that HTML.
  assert.equal(businessEmailAttachments(letter.html)[1].path, profile.avatar_url);
});

test('unassigned, inactive and incomplete profiles never use Korinne as fallback', async () => {
  for (const value of [null, { ...profile, status: 'suspended' }, { ...profile, avatar_url: '', whatsapp_number: '' }]) {
    const agent = businessEmailAgentFromProfile(value);
    const letter = buildBusinessAccountEmail(business, undefined, { agent });
    assert.doesNotMatch(letter.html, /Korinne|72004080|phone=|cid:business-agent/);
    assert.equal(businessEmailAttachments(letter.html).length, 1);
  }
  assert.equal((await resolveBusinessEmailAgent({}, { ...business, rep_user_id: null })).name, '');
});

test('assigned agents receive separate staff notifications and duplicate recipients are removed', async () => {
  for (const email of [profile.email, 'omerforce@gmail.com']) {
    const messages = [];
    const results = await sendBusinessSignupNotifications(business, {
      admin: db({ ...profile, email }),
      mailSettings: { smtp: { configured: true }, from: 'store@example.invalid' }, ownSmtp: { configured: true },
      createTransport: () => ({ async sendMail(letter) { messages.push(letter); return {}; } }),
    });
    assert.ok(results.every(row => row.sent));
    assert.equal(messages.filter(letter => letter.to === email).length, 1);
    assert.equal(messages.length, email === profile.email ? 3 : 2);
    assert.ok(messages.every(letter => !letter.cc && !letter.bcc));
  }
});
