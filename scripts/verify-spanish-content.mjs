/** Check that paired Spanish copy is complete and retains key source facts. */
import { readFile, readdir } from 'node:fs/promises';
import { Parser } from 'htmlparser2';
import { execFileSync } from 'node:child_process';

const files = (await readdir('data/pages')).filter((file) => file.endsWith('.json')).map((file) => `data/pages/${file}`);
files.push('data/global.json');
const issues = [];
const counts = { pairs: 0, untranslatedLong: 0, htmlBodies: 0 };
const matches = (value, pattern) => [...value.matchAll(pattern)].map((match) => match[0]).sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function htmlTags(value) {
  const tags = [];
  const parser = new Parser({
    onopentag(name, attrs) { tags.push(['open', name, attrs]); },
    onclosetag(name) { tags.push(['close', name]); },
  }, { decodeEntities: false });
  parser.end(value);
  return tags;
}

function checkPair(english, spanish, originalSpanish, path, html = false) {
  if (typeof english !== 'string' || !english.trim()) return;
  counts.pairs += 1;
  if (typeof spanish !== 'string' || !spanish.trim()) {
    issues.push(`${path}: missing Spanish`);
    return;
  }
  // Long prose should be translated; technical sequences and URLs contain no spaces.
  if (english === spanish && english.length > 100 && /\s/.test(english)) {
    counts.untranslatedLong += 1;
    issues.push(`${path}: long English-only copy`);
  }
  if (originalSpanish !== english || spanish === english) return;
  const enDigits = english.replace(/\D/g, '').split('').sort();
  const esDigits = spanish.replace(/\D/g, '').split('').sort();
  if (!html && !same(enDigits, esDigits)) issues.push(`${path}: numeric digits changed`);
  const enPercents = matches(english, /\d+(?:[.,]\d+)?\s*%/g).map((value) => value.replace(/[^\d]/g, '')).sort();
  const esPercents = matches(spanish, /\d+(?:[.,]\d+)?\s*%/g).map((value) => value.replace(/[^\d]/g, '')).sort();
  if (!same(enPercents, esPercents)) issues.push(`${path}: percentages changed`);
  const enPlaceholders = matches(english, /\[(?:location|region|xfield_[^\]]+)\]/g);
  const esPlaceholders = matches(spanish, /\[(?:location|region|xfield_[^\]]+)\]/g);
  if (!same(enPlaceholders, esPlaceholders)) issues.push(`${path}: template placeholders changed`);
  for (const delimiter of ['{', '}', '|']) {
    if (english.split(delimiter).length !== spanish.split(delimiter).length) issues.push(`${path}: template delimiter ${delimiter} changed`);
  }
  if (html) {
    counts.htmlBodies += 1;
    if (!same(htmlTags(english), htmlTags(spanish))) issues.push(`${path}: HTML tags or attributes changed`);
  }
}

function checkArrays(english, spanish, originalSpanish, path) {
  if (!Array.isArray(spanish)) {
    issues.push(`${path}: missing Spanish array`);
    return;
  }
  english.forEach((value, index) => {
    const itemPath = `${path}[${index}]`;
    if (Array.isArray(value)) checkArrays(value, spanish[index], originalSpanish?.[index], itemPath);
    else checkPair(value, spanish[index], originalSpanish?.[index], itemPath);
  });
}

function inspect(node, original, path) {
  if (Array.isArray(node)) return node.forEach((value, index) => inspect(value, original?.[index], `${path}[${index}]`));
  if (!node || typeof node !== 'object') return;
  for (const [key, english] of Object.entries(node)) {
    if (key.endsWith('_en')) {
      const spanishKey = `${key.slice(0, -3)}_es`;
      const fieldPath = `${path}.${key}`;
      if (typeof english === 'string') checkPair(english, node[spanishKey], original?.[spanishKey], fieldPath, key === 'html_en');
      else if (Array.isArray(english)) checkArrays(english, node[spanishKey], original?.[spanishKey], fieldPath);
    }
    if (typeof english === 'object') inspect(english, original?.[key], `${path}.${key}`);
  }
}

for (const file of files) {
  const original = JSON.parse(execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 }));
  inspect(JSON.parse(await readFile(file, 'utf8')), original, file);
}
console.log(JSON.stringify({ ...counts, issues: issues.length, examples: issues.slice(0, 40) }, null, 2));
if (issues.length) process.exitCode = 1;
