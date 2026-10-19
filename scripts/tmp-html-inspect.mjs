import { load } from 'cheerio';
import { readFileSync } from 'node:fs';
import { Parser } from 'htmlparser2';

const document = JSON.parse(readFileSync('data/pages/blogPost.json', 'utf8'));
const rows = [];
function walk(node) {
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (key === 'html_en' && value === node.html_es) {
      const $ = load(value, { withStartIndices: true, withEndIndices: true }, false);
      const text = [];
      function visit(child) {
        if (child.type === 'text' && /[a-z]{3}/i.test(child.data)) text.push(child);
        for (const grandchild of child.children ?? []) visit(grandchild);
      }
      visit($.root()[0]);
      rows.push({ length: value.length, textNodes: text.length, unique: new Set(text.map((item) => item.data.trim())).size, textChars: text.reduce((sum, item) => sum + item.data.length, 0), samples: text.slice(0, 3).map((item) => ({ text: item.data.slice(0, 70), start: item.startIndex, end: item.endIndex, match: value.slice(item.startIndex, item.endIndex) === item.data })) });
      if (rows.length === 1) {
        const ranges = [];
        const parser = new Parser({ ontext(raw) { if (/[a-z]{3}/i.test(raw)) ranges.push({ start: parser.startIndex, end: parser.endIndex, match: value.slice(parser.startIndex, parser.endIndex + 1) === raw, raw: raw.slice(0, 80) }); } }, { decodeEntities: false });
        parser.end(value);
        rows[0].parserSamples = ranges.slice(0, 5);
        rows[0].parserNodes = ranges.length;
      }
    }
    if (typeof value === 'object') walk(value);
  }
}
walk(document);
console.log(JSON.stringify(rows, null, 2));
