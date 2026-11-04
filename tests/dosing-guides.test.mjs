import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { cleanDosingGuideTitle, listDosingGuides, readDosingGuide } from '../src/lib/dosingGuides.mjs';

test('the account library lists the private PDF guides with clean titles', async () => {
  const guides = await listDosingGuides();
  assert.equal(guides.length, 100);
  assert.ok(guides.every((guide) => guide.filename.endsWith('.pdf') && guide.title));
  assert.equal(cleanDosingGuideTitle('Copy of Tirzepatide 40mg 3ML Dosing Guide.pdf'), 'Tirzepatide 40mg 3ML Dosing Guide');
});

test('guide reads stay inside the private guide directory', async () => {
  assert.equal(await readDosingGuide('../package.json'), null);
  assert.equal(await readDosingGuide('package.json'), null);
  const first = (await listDosingGuides())[0];
  const pdf = await readDosingGuide(first.filename);
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
});

test('both guide API routes require the verified customer-session resolver', async () => {
  const listRoute = await readFile(new URL('../src/app/api/account/dosing-guides/route.js', import.meta.url), 'utf8');
  const fileRoute = await readFile(new URL('../src/app/api/account/dosing-guides/[filename]/route.js', import.meta.url), 'utf8');
  for (const source of [listRoute, fileRoute]) {
    assert.match(source, /resolveCustomerOrderOwner/);
    assert.match(source, /authorization/);
    assert.match(source, /Sign in required/);
    assert.match(source, /private, no-store/);
  }
});
