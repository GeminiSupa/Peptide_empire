/** Remove bad harvested dictionary entries and restore technical values changed by them. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const apply = process.argv.includes('--apply');
const badDictionaryKeys = [
  'Infografía en español sobre cómo mezclar Tirzepatide 10 mg con agua bacteriostática',
  '≥99% (HPLC)',
  'GHRP-6',
  'C46H56N12O6',
  'C53H73N15O12',
  'Tyr-Asn-Trp-Asn-Ser-Phe-Gly-Leu-Arg-Phe-NH2',
  'KP-10, Metastin (10-19), KISS-1 (112-121)',
  'C40H50N10O7',
];
const badKeys = new Set(badDictionaryKeys);
const dictionaryPath = 'data/translations.json';
const dictionary = JSON.parse(await readFile(dictionaryPath, 'utf8'));
const removed = badDictionaryKeys.filter((key) => key in dictionary.entries);
for (const key of removed) delete dictionary.entries[key];
dictionary.count = Object.keys(dictionary.entries).length;

const technical = (value) =>
  /^(?:[A-Z][a-z]?[0-9₀-₉]+){3,}$/.test(value)
  || /^(?:[A-Z][a-z]{0,3}-){3,}/.test(value)
  || /^[<>≥≤]?[=]?\d+(?:[.,]\d+)?\s*%\s*\([^)]+\)$/.test(value);
const repaired = new Map();
function restore(en, esContainer, index, oldEs) {
  if (typeof en !== 'string' || typeof esContainer?.[index] !== 'string') return;
  const es = esContainer[index];
  if (oldEs !== en || es === en) return;
  if (!badKeys.has(en) && !technical(en)) return;
  esContainer[index] = en;
  repaired.set(en, (repaired.get(en) ?? 0) + 1);
}
function restoreArrays(en, es, oldEs) {
  if (!Array.isArray(en) || !Array.isArray(es)) return;
  en.forEach((value, index) => {
    if (Array.isArray(value)) restoreArrays(value, es[index], oldEs?.[index]);
    else restore(value, es, index, oldEs?.[index]);
  });
}
function walk(node, original) {
  if (Array.isArray(node)) return node.forEach((value, i) => walk(value, original?.[i]));
  if (!node || typeof node !== 'object') return;
  for (const [key, en] of Object.entries(node)) {
    if (key.endsWith('_en')) {
      const esKey = `${key.slice(0, -3)}_es`;
      if (Array.isArray(en)) restoreArrays(en, node[esKey], original?.[esKey]);
      else restore(en, node, esKey, original?.[esKey]);
    }
    if (en && typeof en === 'object') walk(en, original?.[key]);
  }
}

const changedFiles = [];
for (const name of (await readdir('data/pages')).filter((file) => file.endsWith('.json'))) {
  const path = `data/pages/${name}`;
  const document = JSON.parse(await readFile(path, 'utf8'));
  const original = JSON.parse(execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 }));
  const before = [...repaired.values()].reduce((a, b) => a + b, 0);
  walk(document, original);
  if ([...repaired.values()].reduce((a, b) => a + b, 0) > before) {
    changedFiles.push(name);
    if (apply) await writeFile(path, `${JSON.stringify(document, null, 2)}\n`);
  }
}
if (apply) await writeFile(dictionaryPath, `${JSON.stringify(dictionary, null, 2)}\n`);
console.log(JSON.stringify({ apply, removedDictionaryEntries: removed.length, repaired: [...repaired].map(([english, count]) => ({ english: english.slice(0, 100), count })), changedFiles }));
