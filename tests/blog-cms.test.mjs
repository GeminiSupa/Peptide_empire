import test from 'node:test';
import assert from 'node:assert/strict';
import { blogPayload, emptyBlog, normalizeFaq, seoChecklist, slugify } from '../src/lib/blogCms.mjs';

test('slugify creates stable URL segments in both languages', () => {
  assert.equal(slugify('¿Qué Son los Péptidos?'), 'que-son-los-peptidos');
});

test('blog payload removes editor-only values and normalizes arrays', () => {
  const payload = blogPayload({ ...emptyBlog(), title_en: 'A', slug: 'My Post', tags: [' seo ', ''], faq_en: [{ question: ' Q ', answer: ' A ' }] }, '2026-11-13T00:00:00.000Z');
  assert.equal(payload.slug, 'my-post');
  assert.deepEqual(payload.tags, ['seo']);
  assert.deepEqual(payload.faq_en, [{ question: 'Q', answer: 'A' }]);
  assert.equal('_slugAuto' in payload, false);
});

test('SEO checklist reports each actionable publishing check', () => {
  const checks = seoChecklist({ ...emptyBlog(), focus_keyword_en: 'peptide research' }, 'en');
  assert.equal(checks.length, 8);
  assert.equal(checks.every((check) => typeof check.pass === 'boolean'), true);
});

test('FAQ normalizer ignores completely blank rows', () => {
  assert.deepEqual(normalizeFaq([{ question: '', answer: '' }, { question: 'Q', answer: '' }]), [{ question: 'Q', answer: '' }]);
});
