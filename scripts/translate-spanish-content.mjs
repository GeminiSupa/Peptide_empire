/** Fill English-only Spanish fields in the harvested public page copy.
 *
 * Dry run: node scripts/translate-spanish-content.mjs
 * Apply:   node scripts/translate-spanish-content.mjs --apply [--group homeBlocks]
 *
 * The source WordPress site also leaves many /es/ strings in English. This
 * script translates only fields where the Spanish value still equals English.
 * It preserves product names, dosages, URLs and shortcode placeholders, and
 * refuses a result if numbered markers or spintax delimiters change.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const local = args.includes('--local');
const group = args.find((arg) => arg.startsWith('--group='))?.slice('--group='.length);
const limit = Number(args.find((arg) => arg.startsWith('--limit='))?.slice('--limit='.length) || 0);
const files = (await readdir('data/pages'))
  .filter((file) => file.endsWith('.json') && (!group || file === `${group}.json`))
  .map((file) => join('data/pages', file));
const store = JSON.parse(await readFile('data/wp/store-products.json', 'utf8'));
const known = JSON.parse(await readFile('data/translations.json', 'utf8')).entries;
const productNames = [...new Set(store.products.map((product) => product.name.trim()))];
const productNameSet = new Set(productNames.map((name) => name.toLowerCase()));
const brandNames = ['Tico Times', 'The Costa Rica News', 'Peptides Costa Rica', 'Trustpilot', 'WhatsApp'];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const terms = [...brandNames, 'SINPE Móvil', ...productNames]
  .filter((name) => name.length >= 4)
  .sort((a, b) => b.length - a.length);
const protectedPattern = new RegExp(
  `https?:\\/\\/[^\\s)]+|[\\w.+-]+@[\\w.-]+|\\[[^\\]]{1,160}\\]|` +
  `(?<![A-Za-z0-9])(?:${terms.map(escapeRegex).join('|')})(?![A-Za-z0-9])|` +
  `\\b\\d+(?:[.,]\\d+)?\\s*(?:mg|mcg|ml|µg|kg|%)\\b`,
  'gi',
);
const cachePath = '.spanish-translation-cache.json';
let cache = {};
try { cache = JSON.parse(await readFile(cachePath, 'utf8')); } catch { /* first run */ }

const documents = new Map();
const originals = new Map();
const references = new Map();
const stats = { fields: 0, skippedNames: 0, skippedHtml: 0, known: 0, machine: 0, rejected: 0 };

const isTechnical = (value) =>
  /^(?:[A-Z][a-z]?[0-9₀-₉]+){3,}$/.test(value)
  || /^(?:[A-Z][a-z]{0,3}-){3,}/.test(value)
  || /^[<>≥≤]?[=]?\d+(?:[.,]\d+)?\s*%\s*\([^)]+\)$/.test(value)
  || /^GHRP-\d+$/i.test(value)
  || /^KP-10, Metastin\b/.test(value);

const wantsTranslation = (english) => english.length > 4
  && /[a-z]/i.test(english)
  && !isTechnical(english)
  && !/^Infografía en español\b/.test(english)
  && !productNameSet.has(english.toLowerCase())
  && !brandNames.some((name) => name.toLowerCase() === english.toLowerCase())
  && !/^(?:https?:\/\/|\S+@\S+|[\d\s+(),.:%/-]+$)/.test(english);

function collect(node, file) {
  if (Array.isArray(node)) return node.forEach((value) => collect(value, file));
  if (!node || typeof node !== 'object') return;
  function collectArrayPairs(englishItems, spanishItems) {
    if (!Array.isArray(englishItems) || !Array.isArray(spanishItems)) return;
    englishItems.forEach((english, index) => {
      const spanish = spanishItems[index];
      if (Array.isArray(english)) return collectArrayPairs(english, spanish);
      if (typeof english !== 'string' || typeof spanish !== 'string' || english.trim() !== spanish.trim()) return;
      if (!wantsTranslation(english)) return;
      stats.fields += 1;
      if (!references.has(english)) references.set(english, []);
      references.get(english).push({ node: spanishItems, key: index, file });
      originals.set(english, english);
    });
  }
  for (const [key, english] of Object.entries(node)) {
    if (key.endsWith('_en') && Array.isArray(english)) {
      collectArrayPairs(english, node[`${key.slice(0, -3)}_es`]);
    }
    if (key.endsWith('_en') && typeof english === 'string' && english.trim()) {
      const spanishKey = `${key.slice(0, -3)}_es`;
      const spanish = node[spanishKey];
      if (typeof spanish === 'string' && spanish.trim() === english.trim()) {
        if (key === 'html_en') stats.skippedHtml += 1;
        else if (!wantsTranslation(english)) stats.skippedNames += 1;
        else {
          stats.fields += 1;
          if (!references.has(english)) references.set(english, []);
          references.get(english).push({ node, key: spanishKey, file });
          originals.set(english, english);
        }
      }
    }
    if (english && typeof english === 'object') collect(english, file);
  }
}

for (const file of files) {
  const document = JSON.parse(await readFile(file, 'utf8'));
  documents.set(file, document);
  collect(document, file);
}

function protect(text) {
  const holds = [];
  const value = text.replace(protectedPattern, (match) => {
    const index = holds.push(match) - 1;
    return `[[PCR_HOLD_${index}]]`;
  });
  return { value, holds };
}

function splitLong(text, maxLength = 2200) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    let split = remaining.lastIndexOf('\n', maxLength);
    if (split < maxLength * 0.55) split = remaining.lastIndexOf('. ', maxLength);
    if (split < maxLength * 0.55) split = remaining.lastIndexOf(' ', maxLength);
    if (split < maxLength * 0.55) split = remaining.indexOf(' ', maxLength);
    if (split < 0) split = maxLength;
    chunks.push(remaining.slice(0, split).trim());
    remaining = remaining.slice(split).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

const jobs = [];
const planned = new Map();
for (const english of originals.keys()) {
  const sourced = known[english];
  if (sourced && sourced !== english) {
    planned.set(english, { translation: sourced, source: 'existing' });
    stats.known += 1;
    continue;
  }
  const item = protect(english);
  // Translate each spintax alternative on its own. Sending braces and pipes to
  // a translator can reorder or remove them, breaking the rotating city copy.
  const parts = /[{}|]/.test(item.value) ? item.value.split(/([{}|])/) : [item.value];
  const ids = [];
  const recipe = [];
  for (const part of parts) {
    if (/^[{}|]$/.test(part) || !part) {
      recipe.push(part);
      continue;
    }
    const chunkIds = [];
    for (const chunk of splitLong(part)) {
      const id = jobs.length;
      ids.push(id);
      chunkIds.push(id);
      jobs.push({ id, text: chunk, english });
    }
    recipe.push(chunkIds);
  }
  planned.set(english, { ...item, ids, recipe, source: 'machine' });
}

const batches = [];
let batch = [];
let batchLength = 0;
for (const job of jobs) {
  const length = job.text.length + 32;
  if (batch.length && batchLength + length > 2900) {
    batches.push(batch);
    batch = [];
    batchLength = 0;
  }
  batch.push(job);
  batchLength += length;
}
if (batch.length) batches.push(batch);
console.log(JSON.stringify({ files: files.length, identicalFields: stats.fields, uniqueStrings: originals.size, knownTranslations: stats.known, skippedProductNames: stats.skippedNames, htmlFieldsForSeparatePass: stats.skippedHtml, jobs: jobs.length, cachedJobs: jobs.filter((job) => cache[job.text]).length, batches: batches.length, apply, limit }));
if (args.includes('--list')) {
  for (const english of originals.keys()) {
    if (args.includes('--long') && english.length < 100) continue;
    console.log(JSON.stringify({ english, references: references.get(english).length }));
  }
}
if (!apply) process.exit(0);

const results = new Map();
const changedFiles = new Set();
let completed = 0;
let failed = 0;
const selectedBatches = limit ? batches.slice(0, limit) : batches;

async function translateBatch(items) {
  if (local) {
    const response = await fetch('http://127.0.0.1:8765/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: items.map((item) => item.text.replace(/\[\[PCR_HOLD_(\d+)\]\]/g, 'ZXQHOLD$1ZXQ')) }),
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error(`Local translator HTTP ${response.status}`);
    const data = await response.json();
    if (data.items?.length !== items.length) throw new Error('Local translation count mismatch');
    return new Map(items.map((item, index) => [item.id, data.items[index].replace(/ZXQHOLD(\d+)ZXQ/g, '[[PCR_HOLD_$1]]')]));
  }
  const input = items.map((item) => `[[PCR_ITEM_${item.id}]]\n${item.text}`).join('\n');
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  for (const [key, value] of Object.entries({ client: 'gtx', sl: 'en', tl: 'es', dt: 't', q: input })) url.searchParams.set(key, value);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
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
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 900 * 2 ** attempt));
    }
  }
}

let nextBatch = 0;
async function worker() {
  while (nextBatch < selectedBatches.length) {
    const index = nextBatch++;
    const items = selectedBatches[index];
    const uncached = items.filter((item) => !cache[item.text]);
    try {
      if (uncached.length) {
        const translated = await translateBatch(uncached);
        for (const [id, value] of translated) cache[jobs[id].text] = value;
      }
      for (const item of items) results.set(item.id, cache[item.text]);
      completed += 1;
    } catch (error) {
      failed += 1;
      console.error(`Batch ${index + 1}/${selectedBatches.length}: ${error.message}`);
    }
    if ((completed + failed) % 20 === 0) {
      await writeFile(cachePath, JSON.stringify(cache));
      console.log(`Translated ${completed}/${selectedBatches.length} batches; failed ${failed}`);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(1, selectedBatches.length) }, worker));
await writeFile(cachePath, JSON.stringify(cache));

for (const [english, plan] of planned) {
  if (plan.source === 'machine') {
    if (plan.ids.some((id) => !results.has(id))) continue;
    let translated = plan.recipe.map((part) => Array.isArray(part)
      ? part.map((id) => results.get(id)).join(' ')
      : part).join('');
    let valid = true;
    for (let i = 0; i < plan.holds.length; i += 1) {
      const token = `[[PCR_HOLD_${i}]]`;
      if (!translated.includes(token)) valid = false;
      translated = translated.replaceAll(token, plan.holds[i]);
    }
    if (/[\[\]]\[PCR_(?:ITEM|HOLD)_/.test(translated)) valid = false;
    if ((english.match(/\{/g) ?? []).length !== (translated.match(/\{/g) ?? []).length) valid = false;
    if ((english.match(/\}/g) ?? []).length !== (translated.match(/\}/g) ?? []).length) valid = false;
    if ((english.match(/\|/g) ?? []).length !== (translated.match(/\|/g) ?? []).length) valid = false;
    if (!valid) {
      stats.rejected += 1;
      console.error(`Rejected translation: ${english.slice(0, 90)} ... ${translated.slice(0, 160)}`);
      continue;
    }
    plan.translation = translated;
    stats.machine += 1;
  }
  for (const reference of references.get(english)) {
    reference.node[reference.key] = plan.translation;
    changedFiles.add(reference.file);
  }
}

for (const file of changedFiles) await writeFile(file, `${JSON.stringify(documents.get(file), null, 2)}\n`);
console.log(JSON.stringify({ completed, failed, translatedStrings: stats.machine, existingStrings: stats.known, rejectedStrings: stats.rejected, cache: cachePath }));
