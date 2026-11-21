import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCustomerRefundEmail, buildTeamRefundEmail } from '../src/lib/refundEmail.mjs';
import * as templates from '../src/lib/orderEmailTemplates.mjs';

/**
 * Every Empire email used to say "PEPTIDES COSTA RICA" in its header, whatever
 * country the order came from. Each now names the order's own brand.
 */

const plan = { currency: 'USD', refundUsd: 50, keptUsd: 0, fullyRefunded: true };
const brands = { co: 'PEPTIDOS COLOMBIA', mx: 'PEPTIDOS MEXICO', ar: 'PEPTIDOS ARGENTINA', ca: 'PEPTIDES CANADA' };

test('refund emails name the order\'s own country, never Costa Rica', () => {
  for (const [site, brand] of Object.entries(brands)) {
    const order = { order_number: 'PE-1', site_id: site, customer_name: 'Test' };
    for (const lang of ['en', 'es']) {
      const mail = buildCustomerRefundEmail({ order, plan, lang });
      assert.match(mail.html, new RegExp(`>${brand}<`), `${site}/${lang} header`);
      assert.match(mail.subject.toUpperCase(), new RegExp(brand), `${site}/${lang} subject`);
      assert.doesNotMatch(`${mail.subject} ${mail.html}`, /costa rica/i);
    }
    const team = buildTeamRefundEmail({ order, plan });
    assert.match(team.html, new RegExp(`>${brand}<`));
    assert.doesNotMatch(team.html, /costa rica/i);
  }
});

test('order email templates carry no fixed Costa Rica header', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../src/lib/orderEmailTemplates.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /PEPTIDES COSTA RICA/);
  assert.ok(Object.keys(templates).length > 0);
});
