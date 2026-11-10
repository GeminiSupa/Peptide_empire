import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  companionCompound,
  relatedCompounds,
  relatedKey,
  relatedSettingFor,
} from '../lib/site/related-products.mjs';

const c = (slug, storedName, shelf, extra = {}) => ({ slug, name: storedName, storedName, shelf, inStock: true, ...extra });

const glptz = c('glptz', 'GLPTZ', 'weight');
const compounds = [
  glptz,
  c('glp-1', 'GLP-1 (RT) – Agonista Triple', 'weight', { name: 'GLP-1', best: true }),
  c('tirzepatide', 'Tirzepatide', 'weight'),
  c('retatrutide', 'Retatrutide', 'weight', { inStock: false }),
  c('nad', 'NAD+', 'longevity'),
  c('glutathione', 'Glutathione', 'longevity'),
];

const slugs = (list) => list.map((entry) => entry.slug);

test('no entry: same shelf, in stock, as before', () => {
  assert.deepEqual(slugs(relatedCompounds(glptz, compounds, {}, 4)), ['glp-1', 'tirzepatide']);
  assert.equal(companionCompound(glptz, compounds, {}).slug, 'glp-1');
  assert.equal(relatedSettingFor({}, glptz).mode, 'auto');
});

test('mode none: no other products anywhere on the page', () => {
  const settings = { products: { glptz: { mode: 'none' } } };
  assert.deepEqual(relatedCompounds(glptz, compounds, settings, 4), []);
  assert.equal(companionCompound(glptz, compounds, settings), null);
  // Other products keep the automatic list.
  assert.deepEqual(slugs(relatedCompounds(compounds[2], compounds, settings, 4)), ['glptz', 'glp-1']);
});

test('mode pick: only the chosen products, in the chosen order, on sale and in stock', () => {
  const settings = { products: { glptz: { mode: 'pick', picks: ['Glutathione', 'Retatrutide', 'Gone', 'NAD+', 'GLPTZ', 'nad+'] } } };
  assert.deepEqual(slugs(relatedCompounds(glptz, compounds, settings, 4)), ['glutathione', 'nad']);
  assert.equal(companionCompound(glptz, compounds, settings).slug, 'glutathione');
});

test('matched on the stored name, case and spacing ignored', () => {
  const settings = { products: { 'glp-1 (rt) – agonista triple': { mode: 'none' } } };
  assert.equal(relatedSettingFor(settings, compounds[1]).mode, 'none');
  assert.equal(relatedKey('  NAD+   Plus '), 'nad+ plus');
});

test('setting unread (null): offers no other products', () => {
  assert.deepEqual(relatedCompounds(glptz, compounds, null, 4), []);
  assert.equal(companionCompound(glptz, compounds, null), null);
});

test('malformed entries fall back to automatic', () => {
  for (const entry of [null, 'none', { mode: 'other' }, { mode: 'pick', picks: 'NAD+' }]) {
    const settings = { products: { glptz: entry } };
    const mode = relatedSettingFor(settings, glptz).mode;
    assert.ok(mode === 'auto' || (entry?.mode === 'pick' && mode === 'pick'));
  }
  assert.deepEqual(relatedCompounds(glptz, compounds, { products: { glptz: { mode: 'pick', picks: 'NAD+' } } }, 4), []);
});
