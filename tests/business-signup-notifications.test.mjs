import test from 'node:test';
import assert from 'node:assert/strict';
import { sendBusinessSignupNotifications } from '../src/lib/businessSignupNotifications.mjs';

const business = { legal_name: 'Test Business', corporation_number: '3101999999', email: 'buyer@example.invalid', contact_name: 'Test buyer', phone: '88880000', billing_address: 'Test only', status: 'pending', discount_pct: 0 };
const smtp = { configured: true, host: 'transactional.test', port: 587, user: 'transactional', pass: 'test' };
const ownSmtp = { configured: true, host: 'own.test', port: 465, user: 'own', pass: 'test', from: 'info@peptidescostarica.net' };

test('new businesses notify Omer and info separately using the correct mail hosts', async () => {
  const messages = [];
  const result = await sendBusinessSignupNotifications(business, {
    mailSettings: { smtp, from: 'store@example.invalid' }, ownSmtp,
    createTransport: config => ({ async sendMail(message) { messages.push({ config, message }); return { rejected: [] }; } }),
  });
  assert.equal(result.every(row => row.sent), true);
  assert.equal(messages.length, 2);
  assert.deepEqual(messages.map(row => row.message.to).sort(), ['info@peptidescostarica.net', 'omerforce@gmail.com']);
  assert.equal(messages.find(row => row.message.to.startsWith('info@')).config.host, 'own.test');
  assert.equal(messages.find(row => row.message.to.startsWith('omerforce')).config.host, 'transactional.test');
  assert.match(messages[0].message.text, /3101999999/);
  assert.match(messages[0].message.text, /Status: pending/);
  assert.equal(messages[0].message.replyTo, business.email);
});

test('a rejected or unconfigured team inbox is reported without hiding the other result', async t => {
  t.mock.method(console, 'error', () => {});
  const result = await sendBusinessSignupNotifications(business, {
    mailSettings: { smtp, from: 'store@example.invalid' }, ownSmtp: { configured: false },
    createTransport: () => ({ async sendMail() { return { rejected: ['omerforce@gmail.com'] }; } }),
  });
  assert.equal(result.every(row => !row.sent), true);
  assert.match(result.find(row => row.destination.startsWith('info@')).error, /Own-domain SMTP/);
  assert.match(result.find(row => row.destination.startsWith('omerforce')).error, /rejected/);
});

test('an SMTP error does not discard a successful alert to the other inbox', async t => {
  t.mock.method(console, 'error', () => {});
  const result = await sendBusinessSignupNotifications(business, {
    mailSettings: { smtp, from: 'store@example.invalid' }, ownSmtp,
    createTransport: config => ({ async sendMail() { if (config.host === 'own.test') throw new Error('Timeout'); return {}; } }),
  });
  assert.equal(result.find(row => row.destination.startsWith('omerforce')).sent, true);
  assert.equal(result.find(row => row.destination.startsWith('info@')).sent, false);
});
