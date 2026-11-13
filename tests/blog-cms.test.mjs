import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWriting, blogPayload, buildFigureHtml, emptyBlog, normalizeFaq, seoChecklist, slugify } from '../src/lib/blogCms.mjs';

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
  assert.equal(checks.length, 11);
  assert.equal(checks.every((check) => typeof check.pass === 'boolean'), true);
});

test('analyzeWriting counts words, keyword density and passive voice', () => {
  const content = '<p>Peptide research is simple. The sample was tested by the lab. Researchers study peptide research daily.</p>';
  const stats = analyzeWriting(content, 'peptide research');
  assert.equal(stats.words, 16);
  assert.ok(stats.density > 0);
  assert.ok(stats.passivePct > 0); // "was tested" is passive
});

test('buildFigureHtml always carries alt text and escapes quotes', () => {
  const html = buildFigureHtml({ url: 'https://x/y.jpg', alt: 'A "vial" of BPC-157', caption: 'Lab shot' });
  assert.ok(html.includes('alt="A &quot;vial&quot; of BPC-157"'));
  assert.ok(html.includes('<figcaption>Lab shot</figcaption>'));
  assert.ok(html.includes('loading="lazy"'));
});

test('seoChecklist flags a body image with no alt text', () => {
  const withBad = seoChecklist({ ...emptyBlog(), content_en: '<img src="a.jpg">' }, 'en');
  assert.equal(withBad.find((c) => c.label === 'Every body image has alt text').pass, false);
  const withGood = seoChecklist({ ...emptyBlog(), content_en: '<img src="a.jpg" alt="a vial">' }, 'en');
  assert.equal(withGood.find((c) => c.label === 'Every body image has alt text').pass, true);
});

test('FAQ normalizer ignores completely blank rows', () => {
  assert.deepEqual(normalizeFaq([{ question: '', answer: '' }, { question: 'Q', answer: '' }]), [{ question: 'Q', answer: '' }]);
});
