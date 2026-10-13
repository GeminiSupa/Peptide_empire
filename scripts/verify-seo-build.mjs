/** Verify every built page against the launch SEO snapshot in data/seo.json. */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import routeData from '../data/routes.json' with { type: 'json' };
import seoData from '../data/seo.json' with { type: 'json' };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUILT = resolve(ROOT, '.next/server/app');
const ORIGIN = 'https://peptidescostarica.net';
const SKIP_GROUPS = new Set(['excludeCandidate']);
const INTENTIONALLY_ABSENT = new Set(['/product/pt-141-10mgtest/']);

const fileFor = (path) => {
  const slug = path.replace(/^\/|\/$/g, '');
  return resolve(BUILT, slug ? `${slug}.html` : 'index.html');
};
const absolute = (path) => new URL(path, ORIGIN).toString();
const stable = (value) => JSON.stringify(value);

const paths = new Set();
for (const route of routeData.routes) {
  if (SKIP_GROUPS.has(route.group)) continue;
  paths.add(route.en);
  if (route.es) paths.add(route.es);
}

const issues = [];
const add = (path, kind, detail) => issues.push({ path, kind, detail });
let checked = 0;
let schemaPages = 0;

for (const path of paths) {
  if (INTENTIONALLY_ABSENT.has(path)) continue;
  const file = fileFor(path);
  if (!existsSync(file)) {
    add(path, 'MISSING_PAGE', file);
    continue;
  }
  const expected = seoData.pages[path];
  if (!expected) {
    add(path, 'NO_SNAPSHOT', 'path is absent from data/seo.json');
    continue;
  }

  const $ = cheerio.load(await readFile(file, 'utf8'));
  const title = $('head > title').first().text().trim();
  const description = $('meta[name="description"]').attr('content') || null;
  const canonical = $('link[rel="canonical"]').attr('href') || null;
  const hreflang = Object.fromEntries(
    $('link[rel="alternate"][hreflang]')
      .toArray()
      .map((element) => [$(element).attr('hreflang'), $(element).attr('href')]),
  );

  if (title !== expected.title) add(path, 'TITLE', `${title} != ${expected.title}`);
  if (description !== expected.description) {
    add(path, 'DESCRIPTION', `${description} != ${expected.description}`);
  }
  const wantedCanonical = expected.canonical || absolute(path);
  if (canonical !== wantedCanonical) add(path, 'CANONICAL', `${canonical} != ${wantedCanonical}`);

  for (const locale of ['en-US', 'es-CR']) {
    const wanted = expected.hreflang?.[locale];
    if (wanted && hreflang[locale] !== wanted) {
      add(path, 'HREFLANG', `${locale}: ${hreflang[locale]} != ${wanted}`);
    }
  }
  const wantedDefault = expected.hreflang?.['x-default'] || expected.hreflang?.['en-US'] || absolute('/');
  if (hreflang['x-default'] !== wantedDefault) {
    add(path, 'HREFLANG', `x-default: ${hreflang['x-default']} != ${wantedDefault}`);
  }

  const schemas = $('script[type="application/ld+json"]')
    .toArray()
    .map((element) => {
      try {
        return JSON.parse($(element).html());
      } catch {
        return null;
      }
    });
  if (expected.schemas?.length) schemaPages += 1;
  if (schemas.some((schema) => schema === null)) add(path, 'SCHEMA_INVALID', 'JSON parse failed');
  if (stable(schemas) !== stable(expected.schemas || [])) {
    add(path, 'SCHEMA_MISMATCH', `${schemas.length} built vs ${(expected.schemas || []).length} live`);
  }

  if (!$('meta[property="og:title"]').attr('content')) add(path, 'OG_TITLE', 'missing or blank');
  if (!$('meta[property="og:description"]').attr('content')) add(path, 'OG_DESCRIPTION', 'missing or blank');
  if (!$('meta[property="og:image"]').attr('content')) add(path, 'OG_IMAGE', 'missing');
  if (!$('meta[name="twitter:card"]').attr('content')) add(path, 'TWITTER_CARD', 'missing');

  checked += 1;
}

console.log(`SEO pages checked : ${checked}`);
console.log(`Schema pages kept : ${schemaPages}`);
console.log(`Issues            : ${issues.length}`);

const byKind = new Map();
for (const issue of issues) {
  if (!byKind.has(issue.kind)) byKind.set(issue.kind, []);
  byKind.get(issue.kind).push(issue);
}
for (const [kind, list] of byKind) {
  console.log(`\n${kind} (${list.length})`);
  for (const issue of list.slice(0, 10)) console.log(`  ${issue.path}: ${issue.detail}`);
  if (list.length > 10) console.log(`  …and ${list.length - 10} more`);
}

if (issues.length) process.exit(1);
console.log('\nEvery built page preserves its live SEO snapshot and structured data.');
