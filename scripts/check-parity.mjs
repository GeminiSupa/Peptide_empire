// Check every live URL against a running build of this site.
//
// Usage: node scripts/check-parity.mjs [base-url] [--group=<group>] [--limit=<n>]
//        (base defaults to http://localhost:3000)
//
// For each English and Spanish path in data/routes.json it fetches the page
// and checks what the brief keeps fixed through the redesign: the URL answers
// 200 at the same path, the <title> and meta description are the live site's
// (data/seo.json), and the page has exactly one H1. Writes a report to
// stdout and exits non-zero on any failure.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const args = process.argv.slice(2);
const base = (args.find((arg) => !arg.startsWith('--')) || 'http://localhost:3000').replace(/\/$/, '');
const group = args.find((arg) => arg.startsWith('--group='))?.split('=')[1];
const limit = Number(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || Infinity);

const routes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/routes.json'), 'utf8')).routes;
const seo = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/seo.json'), 'utf8')).pages;
const OMITTED = new Set(['/product/pt-141-10mgtest/']);

const decode = (text) => String(text || '')
  .replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

const paths = routes
  .filter((route) => !group || route.group === group)
  .filter((route) => !OMITTED.has(route.en))
  .flatMap((route) => [route.en, route.es].filter(Boolean))
  .slice(0, limit);

let failures = 0;
for (const urlPath of paths) {
  const problems = [];
  let html = '';
  let status = 0;
  try {
    const response = await fetch(`${base}${urlPath}`, { redirect: 'manual', signal: AbortSignal.timeout(300000) });
    status = response.status;
    html = await response.text();
  } catch (error) {
    problems.push(`fetch failed: ${error.message}`);
  }
  if (status && status !== 200) problems.push(`status ${status}`);
  if (status === 200) {
    const title = decode(html.match(/<title>([\s\S]*?)<\/title>/)?.[1]);
    const description = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1]);
    const h1s = (html.match(/<h1[\s>]/g) || []).length;
    const want = seo[urlPath];
    if (want?.title && decode(want.title) !== title) problems.push(`title "${title}" ≠ "${decode(want.title)}"`);
    if (want?.description && decode(want.description) !== description) problems.push('description differs');
    if (h1s !== 1) problems.push(`${h1s} H1s`);
  }
  if (problems.length) {
    failures += 1;
    console.log(`FAIL ${urlPath}  ${problems.join('; ')}`);
  }
}
console.log(`${paths.length} paths checked, ${failures} with problems`);
process.exit(failures ? 1 : 0);
