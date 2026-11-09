import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildRouteIndex, canonicalPath, isLandingCopy, isSitemapPath, languagePair,
} from '../lib/seo-links.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'));
const { routes } = read('routes.json');
const OMITTED = new Set(['/product/pt-141-10mgtest/']); // lib/routes.js OMITTED_ROUTE_PATHS
const index = buildRouteIndex(routes, OMITTED);
const allPaths = [...new Set(routes.filter((r) => !OMITTED.has(r.en)).flatMap((r) => [r.en, r.es]).filter(Boolean))];

test('every page except an ad landing copy is its own canonical', () => {
  for (const path of allPaths) {
    if (isLandingCopy(path) && canonicalPath(path, index) !== path) continue;
    assert.equal(canonicalPath(path, index), path, path);
  }
});

test('the 15 Spanish mixing guides are now their own canonical', () => {
  const guides = allPaths.filter((p) => p.startsWith('/es/blog/guia/'));
  assert.ok(guides.length >= 15);
  for (const p of guides) assert.equal(canonicalPath(p, index), p);
});

test('ad landing copies point at their product and leave the sitemap', () => {
  assert.equal(canonicalPath('/product/lp-ghk-cu-50mg/', index), '/product/ghk-cu-50mg/');
  assert.equal(languagePair('/product/lp-ghk-cu-50mg/', index), null);
  assert.equal(isSitemapPath('/product/lp-ghk-cu-50mg/', index), false);
  assert.equal(isSitemapPath('/product/ghk-cu-50mg/', index), true);
});

test('every language pair is reciprocal: each page names the other', () => {
  for (const path of allPaths) {
    const pair = languagePair(path, index);
    if (!pair) continue;
    const self = path.startsWith('/es/') || path === '/es/' ? pair.es : pair.en;
    assert.equal(self, path, `${path} must list itself`);
    if (pair.en && pair.es) {
      assert.deepEqual(languagePair(pair.en, index), pair, `${pair.en} <-> ${pair.es}`);
      assert.deepEqual(languagePair(pair.es, index), pair, `${pair.es} <-> ${pair.en}`);
    }
    for (const p of [pair.en, pair.es].filter(Boolean)) {
      assert.equal(canonicalPath(p, index), p, `${path} names a non-canonical page ${p}`);
    }
  }
});

test('the wrong WordPress translations are fixed', () => {
  const expect = {
    '/ghrp-6-costa-rica/': '/es/ghrp-6-costa-rica/',
    '/hmg-75-iu-costa-rica/': '/es/hmg-75-iu-costa-rica/',
    '/snap-8-costa-rica/': '/es/snap-8-costa-rica/',
    '/vip-5-costa-rica/': '/es/vip-5-costa-rica/',
    '/oxytocin-acetate-costa-rica/': '/es/acetato-de-oxitocina-costa-rica/',
    '/aa-water-costa-rica/': '/es/agua-aa-costa-rica/',
    '/blog/bpc-157-for-gut-health/': '/es/blog/bpc-157-para-la-salud-intestinal/',
    '/blog/glutathione-for-liver-health-detoxification/': '/es/blog/glutation-para-la-salud-del-higado-y-desintoxicacion/',
  };
  for (const [en, es] of Object.entries(expect)) {
    assert.deepEqual(languagePair(en, index), { en, es }, en);
    assert.deepEqual(languagePair(es, index), { en, es }, es);
  }
  // Adamax's Spanish page names only Adamax.
  assert.equal(languagePair('/es/adamax-costa-rica/', index).en, '/adamax-costa-rica/');
});

test('a page the new design adds uses the pair it is given', () => {
  assert.deepEqual(
    languagePair('/our-process/', index, { en: '/our-process/', es: '/es/nuestro-proceso/' }),
    { en: '/our-process/', es: '/es/nuestro-proceso/' },
  );
});
