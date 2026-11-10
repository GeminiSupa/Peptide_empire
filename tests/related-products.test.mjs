import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compoundNameOfRow,
  normalizeRelatedSettings,
  relatedSettingFor,
  remapRelatedSettings,
  withRelatedSetting,
} from '../src/lib/relatedProducts.mjs';

test('a row\'s compound name is the grid\'s Product column', () => {
  assert.equal(compoundNameOfRow('GLPTZ 20mg', '20mg'), 'GLPTZ');
  assert.equal(compoundNameOfRow('GLP-1 (RT) - USA Manufactured 60', '60'), 'GLP-1 (RT) - USA Manufactured');
  assert.equal(compoundNameOfRow('CJC-1295 without DAC + Ipamorelin', ''), 'CJC-1295 without DAC + Ipamorelin');
});

test('no entry means automatic', () => {
  assert.deepEqual(relatedSettingFor({}, 'GLPTZ'), { mode: 'auto', picks: [] });
  assert.deepEqual(relatedSettingFor(null, 'GLPTZ'), { mode: 'auto', picks: [] });
});

test('saving none, picks and automatic', () => {
  let settings = withRelatedSetting({}, 'GLPTZ', { mode: 'none' });
  assert.deepEqual(settings, { products: { glptz: { mode: 'none' } } });

  settings = withRelatedSetting(settings, 'BPC-157', { mode: 'pick', picks: [' NAD+ ', 'Glutathione', 'nad+', 'BPC-157', ''] });
  assert.deepEqual(relatedSettingFor(settings, 'bpc-157'), { mode: 'pick', picks: ['NAD+', 'Glutathione'] });
  assert.equal(relatedSettingFor(settings, 'GLPTZ').mode, 'none');

  settings = withRelatedSetting(settings, 'GLPTZ', { mode: 'auto' });
  assert.deepEqual(Object.keys(settings.products), ['bpc-157']);
});

test('junk in the stored value is dropped', () => {
  const clean = normalizeRelatedSettings({ products: { A: { mode: 'none' }, B: { mode: 'weird' }, C: null, '': { mode: 'none' } } });
  assert.deepEqual(clean, { products: { a: { mode: 'none' } } });
  assert.deepEqual(normalizeRelatedSettings('nonsense'), { products: {} });
});

test('a rename carries the setting and the picks once the old name is gone', () => {
  const settings = {
    products: {
      glptz: { mode: 'none' },
      'bpc-157': { mode: 'pick', picks: ['GLPTZ', 'NAD+'] },
    },
  };
  const next = remapRelatedSettings(settings, [{ from: 'GLPTZ', to: 'GLP Test' }], ['GLP Test', 'BPC-157', 'NAD+']);
  assert.deepEqual(next.products['glp test'], { mode: 'none' });
  assert.equal(next.products.glptz, undefined);
  assert.deepEqual(next.products['bpc-157'].picks, ['GLP Test', 'NAD+']);
});

test('renaming one size leaves the compound\'s setting where it is', () => {
  const settings = { products: { glptz: { mode: 'none' } } };
  const next = remapRelatedSettings(settings, [{ from: 'GLPTZ', to: 'Other' }], ['GLPTZ', 'Other']);
  assert.deepEqual(next, settings);
});

test('a setting already on the new name is kept', () => {
  const settings = { products: { old: { mode: 'none' }, new: { mode: 'pick', picks: ['NAD+'] } } };
  const next = remapRelatedSettings(settings, [{ from: 'Old', to: 'New' }], ['New']);
  assert.deepEqual(next, { products: { new: { mode: 'pick', picks: ['NAD+'] } } });
});
