import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('the sitemap can build without Preview database credentials', () => {
  const source = fs.readFileSync('src/app/sitemap.js', 'utf8');
  const staticUrls = source.indexOf('const staticUrls =');
  const noDatabaseFallback = source.indexOf('if (!supabase) return staticUrls;');
  const firstDatabaseQuery = source.indexOf(".from('blog_posts')");

  assert.ok(staticUrls >= 0, 'static sitemap entries must exist');
  assert.ok(noDatabaseFallback > staticUrls, 'fallback must be created after static entries');
  assert.ok(firstDatabaseQuery > noDatabaseFallback, 'database must not be queried before the fallback');
});
