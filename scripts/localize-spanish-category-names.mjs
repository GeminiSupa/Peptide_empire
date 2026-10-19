/** Replace English category names retained inside otherwise translated Spanish fields. */
import { readFile, readdir, writeFile } from 'node:fs/promises';

const apply = process.argv.includes('--apply');
const global = JSON.parse(await readFile('data/global.json', 'utf8'));
const categories = global.nav.find((item) => item.label_en === 'SHOP BY CATEGORY')?.children ?? [];
const labels = categories
  .filter((item) => item.label_en && item.label_es && item.label_en !== item.label_es)
  .map((item) => [item.label_en, item.label_es])
  .sort((a, b) => b[0].length - a[0].length);

let replacements = 0;
function localize(value) {
  if (typeof value === 'string') {
    for (const [english, spanish] of labels) {
      const count = value.split(english).length - 1;
      if (count) {
        value = value.replaceAll(english, spanish);
        replacements += count;
      }
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(localize);
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) value[key] = localize(child);
  }
  return value;
}

const files = (await readdir('data/pages')).filter((file) => file.endsWith('.json'));
const changedFiles = [];
for (const name of files) {
  const path = `data/pages/${name}`;
  const document = JSON.parse(await readFile(path, 'utf8'));
  const before = replacements;
  function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key.endsWith('_es')) node[key] = localize(value);
      else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(document);
  if (replacements > before) {
    changedFiles.push({ file: name, replacements: replacements - before });
    if (apply) await writeFile(path, `${JSON.stringify(document, null, 2)}\n`);
  }
}
console.log(JSON.stringify({ apply, replacements, changedFiles }));
