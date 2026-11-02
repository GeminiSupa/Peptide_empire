import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVialSlug, resolveVialPage } from '../lib/site/product-pages.mjs';
import { liveCopy } from '../lib/site/live-copy.mjs';

const compound = (name, sizes) => ({ name, variants: sizes.map((size) => ({ size })) });
const COMPOUNDS = [
  compound('GLP-1', ['5 mg', '10 mg', '20 mg']),
  compound('HCG', ['10000 IU']),
  compound('VIP', ['5 mg']),
  compound('MT-II', ['10 mg']),
  compound('BPC-157 + TB-500', ['20 mg']),
  compound('5-Amino-1MQ', ['50 mg']),
];

test('vial slugs split into compound and strength', () => {
  assert.deepEqual(parseVialSlug('hcg-10000-iu'), { prefix: 'hcg', amount: 10000, unit: 'iu' });
  assert.deepEqual(parseVialSlug('lp-ghk-cu-100mg'), { prefix: 'ghk-cu', amount: 100, unit: 'mg' });
  assert.deepEqual(parseVialSlug('mt-ii'), { prefix: 'mt-ii', amount: null, unit: null });
});

test('vial pages resolve to a compound and preselect their strength', () => {
  assert.deepEqual(resolveVialPage('reta-10mg', COMPOUNDS).size, '10 mg');
  assert.equal(resolveVialPage('retatrutide-20mg', COMPOUNDS).compound.name, 'GLP-1');
  assert.equal(resolveVialPage('hcg-10000-iu', COMPOUNDS).size, '10000 IU');
  assert.equal(resolveVialPage('vip-5-mg', COMPOUNDS).size, '5 mg');
  assert.equal(resolveVialPage('bpc-157-tb-500-20mg-wolverine-stack', COMPOUNDS).compound.name, 'BPC-157 + TB-500');
  // No strength in the slug, or one no longer stocked: the default opens.
  assert.equal(resolveVialPage('mt-ii', COMPOUNDS).size, null);
  assert.equal(resolveVialPage('5-amino-1mq-5mg', COMPOUNDS).size, null);
  // A product the catalog does not sell resolves to nothing.
  assert.equal(resolveVialPage('pt-141-10mgtest', COMPOUNDS), null);
});

test('live copy keeps every heading, paragraph, item and FAQ', () => {
  const sections = [
    { type: 'group', content: { children: [
      { type: 'heading', content: { level: 1, text_en: 'BPC-157' } },
      { type: 'paragraph', content: { text_en: 'Intro.' } },
    ] } },
    { type: 'tabs', content: { items: [{ label_en: 'Description', body_en: 'One.Two sentences.' }] } },
    { type: 'group', content: { children: [
      { type: 'heading', content: { level: 2, text_en: 'Why researchers choose it' } },
      { type: 'group', content: { children: [
        { type: 'group', content: { children: [
          { type: 'heading', content: { level: 0, text_en: '01' } },
          { type: 'heading', content: { level: 2, text_en: 'Defined' } },
          { type: 'paragraph', content: { text_en: 'One sequence.' } },
        ] } },
        { type: 'group', content: { children: [
          { type: 'heading', content: { level: 0, text_en: '02' } },
          { type: 'heading', content: { level: 2, text_en: 'Documented' } },
          { type: 'paragraph', content: { text_en: 'Batch COA.' } },
        ] } },
      ] } },
    ] } },
    { type: 'faq', content: { items: [{ q_en: 'Q?', a_en: 'A.' }] } },
    { type: 'button', content: { text_en: 'Guide', href: '/bpc-157-complete-guide/' } },
  ];
  const copy = liveCopy(sections, 'en');
  assert.equal(copy.h1, 'BPC-157');
  assert.deepEqual(copy.blocks[0].paras, ['Intro.']);
  assert.deepEqual(copy.blocks[1], { title: 'Description', paras: ['One.', 'Two sentences.'], items: [], links: [], faq: [] });
  assert.deepEqual(copy.blocks[2].items, [
    { title: 'Defined', text: 'One sequence.' },
    { title: 'Documented', text: 'Batch COA.' },
  ]);
  assert.deepEqual(copy.faq, [['Q?', 'A.']]);
  assert.deepEqual(copy.blocks[2].links, [{ text: 'Guide', href: '/bpc-157-complete-guide/' }]);
});

test('city H1s get their town where the live template left a placeholder', async () => {
  const { cityH1, cityPlace } = await import('../lib/site/city.mjs');
  const page = { slug: 'sarchi-alajuela', head: { title_en: 'Research Products in Sarchí, Alajuela – Peptides Costa Rica', title_es: 'Productos de investigación en Sarchí, Alajuela – Peptides Costa Rica' } };
  assert.deepEqual(cityPlace(page, 'en'), { town: 'Sarchí', region: 'Alajuela' });
  assert.equal(cityH1('Premium Peptides in [location] Alajuela', page, 'en'), 'Premium Peptides in Sarchí, Alajuela');
  assert.equal(cityH1('Péptidos Premium en [location], [region]', page, 'es'), 'Péptidos Premium en Sarchí, Alajuela');
  // An H1 with no placeholder is the live one, untouched.
  assert.equal(cityH1('Premium Peptides in Alajuela', { slug: 'alajuela', head: {} }, 'en'), 'Premium Peptides in Alajuela');
});
