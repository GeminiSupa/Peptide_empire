import { isDeepStrictEqual } from 'node:util';
import * as cheerio from 'cheerio';

const liveUrl = 'https://peptidecostarica-website.vercel.app/';
const candidateUrl = process.argv[2] || 'http://localhost:3100/';

const inspect = async (url) => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const html = await response.text();
  const document = cheerio.load(html);
  const schemas = document('script[type="application/ld+json"]').toArray()
    .map((node) => JSON.parse(document(node).html()));
  return {
    htmlBytes: Buffer.byteLength(html),
    schemaTypes: schemas.map((schema) => schema['@type'] || 'graph'),
    schemas,
    productCards: document('.home-page .product-card').length,
    hiddenProductCards: document('.home-page .hidden .product-card').length,
  };
};

const [live, candidate] = await Promise.all([inspect(liveUrl), inspect(candidateUrl)]);
console.log(JSON.stringify({
  live: { ...live, schemas: undefined },
  candidate: { ...candidate, schemas: undefined },
  identicalSchemas: isDeepStrictEqual(live.schemas, candidate.schemas),
}, null, 2));
if (!isDeepStrictEqual(live.schemas, candidate.schemas)) process.exitCode = 1;
