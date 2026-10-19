import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const findings = new Map();
function compare(en, es, oldEs, path) {
  if (Array.isArray(en)) return en.forEach((value, i) => compare(value, es?.[i], oldEs?.[i], `${path}[${i}]`));
  if (typeof en !== 'string' || typeof es !== 'string' || oldEs !== en || en === es) return;
  const digits = (value) => value.replace(/\D/g, '').split('').sort().join('');
  if (digits(en) === digits(es)) return;
  const key = JSON.stringify([en, es]);
  if (!findings.has(key)) findings.set(key, { en, es, refs: [] });
  findings.get(key).refs.push(path);
}
function walk(node, original, path) {
  if (Array.isArray(node)) return node.forEach((value, i) => walk(value, original?.[i], `${path}[${i}]`));
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (key.endsWith('_en')) {
      const esKey = `${key.slice(0, -3)}_es`;
      compare(value, node[esKey], original?.[esKey], `${path}.${key}`);
    }
    if (value && typeof value === 'object') walk(value, original?.[key], `${path}.${key}`);
  }
}
for (const name of (await readdir('data/pages')).filter((file) => file.endsWith('.json'))) {
  const path = `data/pages/${name}`;
  const old = JSON.parse(execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 }));
  walk(JSON.parse(await readFile(path, 'utf8')), old, path);
}
console.log(JSON.stringify([...findings.values()].map((x) => ({ en: x.en.slice(0, 140), es: x.es.slice(0, 140), refs: x.refs.slice(0, 2), count: x.refs.length })), null, 2));
