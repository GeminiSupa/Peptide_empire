import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const dictionary = JSON.parse(await readFile('data/translations.json', 'utf8')).entries;
const found = new Map();
function walk(current, original, file) {
  if (Array.isArray(current)) return current.forEach((value, index) => walk(value, original?.[index], file));
  if (!current || typeof current !== 'object') return;
  for (const [key, english] of Object.entries(current)) {
    if (key.endsWith('_en') && typeof english === 'string') {
      const spanish = current[`${key.slice(0, -3)}_es`];
      if (original?.[`${key.slice(0, -3)}_es`] === english && dictionary[english] === spanish && spanish !== english) {
        if (!found.has(english)) found.set(english, { spanish, refs: [] });
        found.get(english).refs.push({ node: current, key: `${key.slice(0, -3)}_es`, file });
      }
    }
    if (typeof english === 'object') walk(english, original?.[key], file);
  }
}
const documents = new Map();
for (const name of (await readdir('data/pages')).filter((name) => name.endsWith('.json'))) {
  const file = `data/pages/${name}`;
  const current = JSON.parse(await readFile(file, 'utf8'));
  const original = JSON.parse(execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 }));
  documents.set(file, current);
  walk(current, original, file);
}
console.log(`Dictionary-sourced unique strings: ${found.size}`);
for (const [english, item] of found) console.log(JSON.stringify({ english: english.slice(0, 180), spanish: item.spanish.slice(0, 180), length: english.length, refs: item.refs.length }));
export { found, documents };
