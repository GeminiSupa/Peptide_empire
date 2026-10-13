/**
 * Compare SEO-critical <head> data on the live WordPress site with a built
 * Next.js page. This deliberately checks structured data as well as ordinary
 * metadata: a migration can keep titles/canonicals and still lose rich-result
 * eligibility by dropping JSON-LD.
 *
 * Usage:
 *   node scripts/audit-seo.mjs --path /
 *   node scripts/audit-seo.mjs --sample
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://peptidescostarica.net';
const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? null : args[index + 1];
};

const samples = [
  '/',
  '/bpc-157-costa-rica/',
  '/product/bpc-157-10mg/',
  '/blog/peptides-guide/',
  '/es/',
];
const paths = args.includes('--sample') ? samples : [value('path') || '/'];

function builtPath(path) {
  const slug = path.replace(/^\/|\/$/g, '');
  return resolve(ROOT, '.next/server/app', slug ? `${slug}.html` : 'index.html');
}

function schemaType(value) {
  if (!value || typeof value !== 'object') return 'invalid';
  if (Array.isArray(value)) return value.flatMap(schemaType);
  if (Array.isArray(value['@graph'])) return value['@graph'].flatMap(schemaType);
  return value['@type'] || 'untyped';
}

function extract(html) {
  const $ = cheerio.load(html);
  const schema = $('script[type="application/ld+json"]')
    .toArray()
    .map((element) => {
      try {
        return JSON.parse($(element).html());
      } catch {
        return null;
      }
    });

  return {
    title: $('head > title').first().text().trim(),
    description: $('meta[name="description"]').attr('content') || null,
    canonical: $('link[rel="canonical"]').attr('href') || null,
    robots: $('meta[name="robots"]').attr('content') || null,
    hreflang: Object.fromEntries(
      $('link[rel="alternate"][hreflang]')
        .toArray()
        .map((element) => [$(element).attr('hreflang'), $(element).attr('href')]),
    ),
    openGraph: Object.fromEntries(
      $('meta[property^="og:"]')
        .toArray()
        .map((element) => [$(element).attr('property'), $(element).attr('content')]),
    ),
    twitter: Object.fromEntries(
      $('meta[name^="twitter:"]')
        .toArray()
        .map((element) => [$(element).attr('name'), $(element).attr('content')]),
    ),
    verification: $('meta[name="google-site-verification"]')
      .toArray()
      .map((element) => $(element).attr('content')),
    icons: $('link[rel="icon"], link[rel="apple-touch-icon"]')
      .toArray()
      .map((element) => ({
        rel: $(element).attr('rel'),
        sizes: $(element).attr('sizes') || null,
        href: $(element).attr('href'),
      })),
    schemaCount: schema.length,
    schemaTypes: schema.flatMap(schemaType),
    invalidSchemaCount: schema.filter((entry) => entry === null).length,
  };
}

for (const path of paths) {
  const response = await fetch(ORIGIN + path, {
    headers: { 'user-agent': 'peptidescostarica-rebuild-seo-audit' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`${path}: live site returned HTTP ${response.status}`);

  const live = extract(await response.text());
  const file = builtPath(path);
  const built = existsSync(file) ? extract(await readFile(file, 'utf8')) : null;
  console.log(JSON.stringify({ path, live, built }, null, 2));
}
