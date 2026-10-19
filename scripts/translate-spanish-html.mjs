/** Translate English-only blog body text without changing its HTML tags. */
import { readFile, writeFile } from 'node:fs/promises';
import { Parser } from 'htmlparser2';

const apply = process.argv.includes('--apply');
const local = process.argv.includes('--local');
const limit = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 0);
const file = 'data/pages/blogPost.json';
const document = JSON.parse(await readFile(file, 'utf8'));
const store = JSON.parse(await readFile('data/wp/store-products.json', 'utf8'));
const names = new Set(store.products.map((product) => product.name.toLowerCase()));
const protectedNames = [...new Set([
  ...store.products.map((product) => product.name),
  'Peptides Costa Rica', 'Trustpilot', 'WhatsApp', 'Ozempic', 'Wegovy',
  'Mounjaro', 'Zepbound', 'Novo Nordisk', 'Eli Lilly', 'FDA', 'EMA',
])].filter((value) => value.length >= 4).sort((a, b) => b.length - a.length);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const protectPattern = new RegExp(
  `&(?:#\\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);|https?:\\/\\/[^\\s)]+|` +
  `(?<![A-Za-z0-9])(?:${protectedNames.map(escapeRegex).join('|')})(?![A-Za-z0-9])|` +
  `\\b\\d+(?:[.,]\\d+)?\\s*(?:mg|mcg|ml|µg|kg|%)\\b`, 'gi',
);
const cachePath = '.spanish-html-cache.json';
let cache = {};
try { cache = JSON.parse(await readFile(cachePath, 'utf8')); } catch { /* first pass */ }

const articles = [];
const unique = new Map();
function findArticles(node) {
  if (Array.isArray(node)) return node.forEach(findArticles);
  if (!node || typeof node !== 'object') return;
  if (typeof node.html_en === 'string' && node.html_en === node.html_es) {
    const ranges = [];
    const html = node.html_en;
    let ignored = 0;
    const parser = new Parser({
      onopentag(name) { if (['script', 'style', 'code', 'pre', 'svg'].includes(name)) ignored += 1; },
      onclosetag(name) { if (['script', 'style', 'code', 'pre', 'svg'].includes(name)) ignored -= 1; },
      ontext(raw) {
        if (ignored || !/[a-z]{3}/i.test(raw)) return;
        const english = raw.trim();
        if (english.length < 4 || names.has(english.toLowerCase())) return;
        if (/^(?:https?:\/\/|[A-Z][A-Z0-9+\-./ ]{1,30})$/.test(english)) return;
        const start = parser.startIndex;
        const end = parser.endIndex + 1;
        if (html.slice(start, end) !== raw) throw new Error(`HTML offset mismatch ${start}-${end}`);
        ranges.push({ start, end, english, leading: raw.match(/^\s*/)[0], trailing: raw.match(/\s*$/)[0] });
        if (!unique.has(english)) unique.set(english, null);
      },
    }, { decodeEntities: false });
    parser.end(html);
    articles.push({ node, html, ranges });
  }
  for (const value of Object.values(node)) if (typeof value === 'object') findArticles(value);
}
findArticles(document);

function protect(value) {
  const holds = [];
  const text = value.replace(protectPattern, (match) => {
    const index = holds.push(match) - 1;
    return `[[PCR_HOLD_${index}]]`;
  });
  return { text, holds };
}

const jobs = [];
for (const english of unique.keys()) {
  const plan = protect(english);
  plan.ids = [];
  let remaining = plan.text;
  while (remaining.length) {
    if (remaining.length <= 2200) {
      const id = jobs.length;
      plan.ids.push(id);
      jobs.push({ id, text: remaining });
      break;
    }
    let split = remaining.lastIndexOf('. ', 2200);
    if (split < 900) split = remaining.lastIndexOf(' ', 2200);
    if (split < 0) split = 2200;
    const id = jobs.length;
    plan.ids.push(id);
    jobs.push({ id, text: remaining.slice(0, split).trim() });
    remaining = remaining.slice(split).trim();
  }
  unique.set(english, plan);
}

const batches = [];
let batch = [];
let length = 0;
for (const job of jobs) {
  if (batch.length && length + job.text.length + 30 > 2800) {
    batches.push(batch);
    batch = [];
    length = 0;
  }
  batch.push(job);
  length += job.text.length + 30;
}
if (batch.length) batches.push(batch);
console.log(JSON.stringify({ articles: articles.length, textNodes: articles.reduce((sum, article) => sum + article.ranges.length, 0), unique: unique.size, jobs: jobs.length, batches: batches.length, cached: jobs.filter((job) => cache[job.text]).length, apply, local }));
if (!apply) process.exit(0);

async function translateBatch(items) {
  if (local) {
    const response = await fetch('http://127.0.0.1:8765/translate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: items.map((item) => item.text.replace(/\[\[PCR_HOLD_(\d+)\]\]/g, 'ZXQHOLD$1ZXQ')) }),
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error(`Local HTTP ${response.status}`);
    const data = await response.json();
    if (data.items?.length !== items.length) throw new Error('Local count mismatch');
    return new Map(items.map((item, index) => [item.id, data.items[index].replace(/ZXQHOLD(\d+)ZXQ/g, '[[PCR_HOLD_$1]]')]));
  }
  const input = items.map((item) => `[[PCR_ITEM_${item.id}]]\n${item.text}`).join('\n');
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  for (const [key, value] of Object.entries({ client: 'gtx', sl: 'en', tl: 'es', dt: 't', q: input })) url.searchParams.set(key, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const output = data[0].map((row) => row[0]).join('');
  const markers = [...output.matchAll(/\[\[PCR_ITEM_(\d+)\]\]/g)];
  if (markers.length !== items.length) throw new Error(`Marker mismatch ${markers.length}/${items.length}`);
  const translated = new Map();
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const end = markers[index + 1]?.index ?? output.length;
    translated.set(Number(marker[1]), output.slice(marker.index + marker[0].length, end).trim());
  }
  if (items.some((item) => !translated.get(item.id))) throw new Error('Empty translation');
  return translated;
}

let completed = 0;
let failed = 0;
let next = 0;
let stop = false;
const selected = limit ? batches.slice(0, limit) : batches;
async function worker() {
  while (!stop && next < selected.length) {
    const index = next++;
    const missing = selected[index].filter((job) => !cache[job.text]);
    try {
      if (missing.length) {
        const translated = await translateBatch(missing);
        for (const [id, value] of translated) cache[jobs[id].text] = value;
      }
      completed += 1;
    } catch (error) {
      failed += 1;
      console.error(`Batch ${index + 1}/${selected.length}: ${error.message}`);
      if (/429/.test(error.message) || failed >= 3) stop = true;
    }
    if ((completed + failed) % 10 === 0) {
      await writeFile(cachePath, JSON.stringify(cache));
      console.log(`Batches ${completed}/${selected.length}; failed ${failed}`);
    }
  }
}
await Promise.all(Array.from({ length: local ? 1 : 2 }, worker));
await writeFile(cachePath, JSON.stringify(cache));

const translations = new Map();
let rejected = 0;
for (const [english, plan] of unique) {
  if (plan.ids.some((id) => !cache[jobs[id].text])) continue;
  let translated = plan.ids.map((id) => cache[jobs[id].text]).join(' ');
  if (plan.holds.some((_, index) => !translated.includes(`[[PCR_HOLD_${index}]]`))) { rejected += 1; continue; }
  for (let index = 0; index < plan.holds.length; index += 1) translated = translated.replaceAll(`[[PCR_HOLD_${index}]]`, plan.holds[index]);
  if (/\[\[PCR_(?:ITEM|HOLD)_/.test(translated)) { rejected += 1; continue; }
  translations.set(english, translated);
}

let updated = 0;
for (const article of articles) {
  if (article.ranges.some((range) => !translations.has(range.english))) continue;
  let html = article.html;
  for (const range of [...article.ranges].reverse()) {
    const translated = translations.get(range.english)
      .replace(/&(?!#(?:\d+|x[0-9a-f]+);|[a-z][a-z0-9]+;)/gi, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.slice(0, range.start) + range.leading + translated + range.trailing + html.slice(range.end);
  }
  article.node.html_es = html;
  updated += 1;
}
if (updated) await writeFile(file, `${JSON.stringify(document, null, 2)}\n`);
console.log(JSON.stringify({ completed, failed, translated: translations.size, rejected, updatedArticles: updated, remainingArticles: articles.length - updated }));
