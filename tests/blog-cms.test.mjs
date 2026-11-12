import test from 'node:test';
import assert from 'node:assert/strict';
import { blogPaths, blogToPage, metadataForBlog, sanitizeBlogHtml } from '../lib/blog-cms.mjs';

const row = { slug: 'research-one', slug_es: 'investigacion-uno', title_en: 'Research One', title_es: 'Investigación Uno', excerpt_en: 'English summary', excerpt_es: 'Resumen español', content_en: '<h2>Safe</h2><p onclick="bad()">Body<script>alert(1)</script></p>', content_es: '## Seguro\n\nTexto', published_at: '2026-11-13T00:00:00Z', tags: ['research'] };

test('CMS paths preserve separate English and Spanish slugs', () => assert.deepEqual(blogPaths(row), { en: '/blog/research-one/', es: '/es/blog/investigacion-uno/' }));
test('CMS content is sanitized and Markdown becomes article HTML', () => {
  const page = blogToPage(row);
  assert.match(page.sections[1].content.html_en, /<h2>Safe<\/h2>/);
  assert.doesNotMatch(page.sections[1].content.html_en, /script|onclick/);
  assert.match(page.sections[1].content.html_es, /<h2>Seguro<\/h2>/);
});
test('unsafe links and embedded documents are removed', () => {
  const html = sanitizeBlogHtml('<iframe src="https://bad.test"></iframe><a href="javascript:bad()">bad</a>');
  assert.doesNotMatch(html, /iframe|javascript:/);
});
test('CMS metadata points both languages at the canonical website', () => {
  const metadata = metadataForBlog(row, 'es');
  assert.equal(metadata.alternates.canonical, 'https://peptidescostarica.net/es/blog/investigacion-uno/');
  assert.equal(metadata.openGraph.type, 'article');
});
