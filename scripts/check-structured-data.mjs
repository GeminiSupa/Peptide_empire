#!/usr/bin/env node
/**
 * Audits the structured data (JSON-LD) of every page in a running site's
 * sitemap, against Google's rules and against what the page shows.
 *
 *   node scripts/check-structured-data.mjs                     # https://peptidescostarica.net
 *   node scripts/check-structured-data.mjs http://localhost:3001
 *   node scripts/check-structured-data.mjs <base> --sample 3   # 3 pages per page type
 *   node scripts/check-structured-data.mjs <base> --report out.json
 *
 * Per page it checks that:
 *  - every JSON-LD block parses, and there is at most one FAQPage;
 *  - each FAQ question is visible text on the page;
 *  - the BreadcrumbList runs 1..n and ends at the page's canonical URL;
 *  - each Product offer has a price > 0, a currency and availability, and the
 *    lowest offer's colón price is printed on the page;
 *  - every URL in the data is absolute and on the canonical host (social
 *    profiles in `sameAs` excepted);
 * and it compares the types found with what WordPress had on the same URL
 * (data/seo.json), so a type that disappeared is listed, never silent.
 *
 * Exit code 1 when any page has a problem.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const BASE = (args.find((a) => /^https?:\/\//.test(a)) || 'https://peptidescostarica.net').replace(/\/+$/, '');
const SAMPLE = Number(flag('--sample')) || 0;
const REPORT = flag('--report');
const CONCURRENCY = Number(flag('--concurrency')) || 6;

const seo = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/seo.json'), 'utf8')).pages;
const routes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/routes.json'), 'utf8')).routes;
const groupOf = new Map();
for (const r of routes) { groupOf.set(r.en, r.group); if (r.es) groupOf.set(r.es, r.group); }

const decode = (s) => String(s)
  .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#x27;|&#0?39;|&apos;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const norm = (s) => decode(s).replace(/\s+/g, ' ').trim().toLowerCase();
const typesOf = (node) => [].concat(node?.['@type'] || []);
const flatten = (data) => [].concat(data).flatMap((d) => (d && d['@graph'] ? d['@graph'] : [d])).filter(Boolean);

function wordpressTypes(p) {
  const s = seo[p]?.schemas || [];
  return new Set(s.flatMap((x) => flatten(x)).flatMap(typesOf));
}

function urlsIn(value, key = '', out = []) {
  if (Array.isArray(value)) value.forEach((v) => urlsIn(v, key, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) if (k !== 'sameAs') urlsIn(v, k, out);
  } else if (typeof value === 'string' && /^(url|item|@id|mainEntityOfPage)$/.test(key) && /^[a-z]+:\/\//i.test(value)) {
    out.push(value);
  }
  return out;
}

async function audit(url) {
  const problems = [];
  let html;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (res.status !== 200) return { url, problems: [`HTTP ${res.status}`], types: [] };
    html = await res.text();
  } catch (error) {
    return { url, problems: [`fetch failed: ${error.message}`], types: [] };
  }
  const canonical = decode(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || '');
  const host = canonical ? new URL(canonical).host : new URL(url).host;
  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const nodes = [];
  for (const block of blocks) {
    try { nodes.push(...flatten(JSON.parse(block))); } catch { problems.push('a JSON-LD block does not parse'); }
  }
  const visible = norm(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' '));
  const types = nodes.flatMap(typesOf);

  const faqs = nodes.filter((n) => typesOf(n).includes('FAQPage'));
  if (faqs.length > 1) problems.push(`${faqs.length} FAQPage blocks (Google allows one)`);
  for (const faq of faqs) {
    for (const q of faq.mainEntity || []) {
      if (!visible.includes(norm(q.name))) problems.push(`FAQ question not visible: "${q.name}"`);
      if (!q.acceptedAnswer?.text) problems.push(`FAQ question without answer: "${q.name}"`);
    }
  }

  for (const crumbs of nodes.filter((n) => typesOf(n).includes('BreadcrumbList'))) {
    const items = crumbs.itemListElement || [];
    items.forEach((item, i) => { if (item.position !== i + 1) problems.push('breadcrumb positions out of order'); });
    const last = items[items.length - 1]?.item;
    if (canonical && last !== canonical) problems.push(`breadcrumb ends at ${last}, not the canonical ${canonical}`);
  }

  for (const product of nodes.filter((n) => typesOf(n).includes('Product'))) {
    const offers = [].concat(product.offers || []);
    if (!product.name) problems.push('Product without name');
    if (!offers.length) problems.push('Product without offers');
    for (const offer of offers) {
      if (!(Number(offer.price) > 0)) problems.push(`offer "${offer.name}" has no price`);
      if (!offer.priceCurrency) problems.push(`offer "${offer.name}" has no currency`);
      if (!offer.availability) problems.push(`offer "${offer.name}" has no availability`);
    }
    const prices = offers.map((o) => Number(o.price)).filter((p) => p > 0);
    if (prices.length) {
      const shown = Math.min(...prices).toLocaleString('en-US');
      if (!html.includes(shown)) problems.push(`lowest offer price ${shown} is not printed on the page`);
    }
  }

  for (const article of nodes.filter((n) => typesOf(n).includes('BlogPosting'))) {
    if (!article.headline) problems.push('article without headline');
    for (const key of ['datePublished', 'dateModified']) {
      if (article[key] && Number.isNaN(Date.parse(article[key]))) problems.push(`article ${key} is not a date`);
    }
  }

  for (const value of urlsIn(nodes)) {
    try { if (new URL(value).host !== host) problems.push(`URL off the canonical host: ${value}`); } catch { problems.push(`bad URL: ${value}`); }
  }

  const p = new URL(url).pathname;
  const wp = wordpressTypes(p);
  const now = new Set(types);
  return { url, path: p, group: groupOf.get(p) || '(new)', problems, types: [...now], lost: [...wp].filter((t) => !now.has(t)) };
}

const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
let urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, BASE));
if (SAMPLE) {
  const per = new Map();
  urls = urls.filter((u) => {
    const g = groupOf.get(new URL(u).pathname) || '(new)';
    per.set(g, (per.get(g) || 0) + 1);
    return per.get(g) <= SAMPLE;
  });
}

const results = [];
let next = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < urls.length) {
    const url = urls[next++];
    results.push(await audit(url));
  }
}));
results.sort((a, b) => a.url.localeCompare(b.url));

const count = (list) => list.reduce((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map());
const typeCount = count(results.flatMap((r) => r.types));
const lostCount = count(results.flatMap((r) => r.lost.map((t) => `${t} (${r.group})`)));
const bad = results.filter((r) => r.problems.length);

console.log(`Base ${BASE} — ${results.length} pages${SAMPLE ? ` (sample of ${SAMPLE} per page type)` : ''}`);
console.log('\nTypes found (pages):');
for (const [t, n] of [...typeCount].sort((a, b) => b[1] - a[1])) console.log(`  ${t.padEnd(16)} ${n}`);
console.log('\nWordPress had, now absent (type (page type): pages):');
if (!lostCount.size) console.log('  none');
for (const [t, n] of [...lostCount].sort((a, b) => b[1] - a[1])) console.log(`  ${t.padEnd(34)} ${n}`);
console.log(`\nPages with problems: ${bad.length}`);
for (const r of bad.slice(0, 80)) console.log(`  ${r.path}\n    - ${r.problems.slice(0, 6).join('\n    - ')}`);
if (REPORT) fs.writeFileSync(REPORT, `${JSON.stringify(results, null, 2)}\n`);
process.exit(bad.length ? 1 : 0);
