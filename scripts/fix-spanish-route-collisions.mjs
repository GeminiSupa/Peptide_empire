/** Give pages distinct Spanish URLs where the source site's translations collide. */
import { readFile, writeFile } from 'node:fs/promises';

const apply = process.argv.includes('--apply');
const fixes = [
  ['productLander', '/aa-water-costa-rica/', '/es/agua-de-bac-costa-rica/', '/es/agua-aa-costa-rica/'],
  ['productLander', '/ghrp-6-costa-rica/', '/es/adamax-costa-rica/', '/es/ghrp-6-costa-rica/'],
  ['productLander', '/hmg-75-iu-costa-rica/', '/es/adamax-costa-rica/', '/es/hmg-75-iu-costa-rica/'],
  ['productLander', '/snap-8-costa-rica/', '/es/adamax-costa-rica/', '/es/snap-8-costa-rica/'],
  ['productLander', '/vip-5-costa-rica/', '/es/adamax-costa-rica/', '/es/vip-5-costa-rica/'],
  ['productLander', '/oxytocin-acetate-costa-rica/', '/es/5-amino-1mq-costa-rica/', '/es/acetato-de-oxitocina-costa-rica/'],
  ['blogPost', '/blog/bpc-157-for-gut-health/', '/es/blog/puede-la-sermorelin-mejorar-el-sueno-y-ayudar-en-la-recuperacion-muscular/', '/es/blog/bpc-157-para-la-salud-intestinal/'],
  ['blogPost', '/blog/glutathione-for-liver-health-detoxification/', '/es/blog/mezcla-de-peptidos-klow-la-guia-definitiva-sobre-ghk-cu-bpc-157-tb-500-y-kpv/', '/es/blog/glutation-para-la-salud-del-higado-y-desintoxicacion/'],
];

const paths = ['data/routes.json', 'data/pages/productLander.json', 'data/pages/blogPost.json'];
const documents = new Map();
for (const path of paths) documents.set(path, JSON.parse(await readFile(path, 'utf8')));

for (const [group, en, oldEs, newEs] of fixes) {
  for (const path of ['data/routes.json', `data/pages/${group}.json`]) {
    const document = documents.get(path);
    const entries = path === 'data/routes.json' ? document.routes : document.pages;
    const entry = entries.find((item) => item.en === en);
    if (!entry || (entry.es !== oldEs && entry.es !== newEs)) {
      throw new Error(`Unexpected Spanish path for ${en} in ${path}: ${entry?.es}`);
    }
    entry.es = newEs;
  }
}

for (const [path, document] of documents) {
  if (apply) await writeFile(path, `${JSON.stringify(document, null, 2)}\n`);
}
console.log(JSON.stringify({ apply, correctedPages: fixes.length, paths }));
