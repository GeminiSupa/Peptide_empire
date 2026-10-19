import { readFile, readdir, writeFile } from 'node:fs/promises';

const translations = new Map([
  ['The team was helpful, responsive and easy to communicate with.', 'El equipo fue servicial, respondió con rapidez y fue fácil comunicarse con ellos.'],
  ['Quick response and transparent transactions. Reliable!', 'Respuesta rápida y transacciones transparentes. ¡Confiables!'],
  ['Great communication and fast shipping! It was nice that there was a real person to answer my questions.', '¡Excelente comunicación y envío rápido! Fue agradable que una persona real respondiera mis preguntas.'],
  ['Awesome', 'Excelente'],
]);

for (const name of (await readdir('data/pages')).filter((item) => item.endsWith('.json'))) {
  const path = `data/pages/${name}`;
  const document = JSON.parse(await readFile(path, 'utf8'));
  let changed = 0;
  function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.reviews)) {
      for (const review of node.reviews) {
        const spanish = translations.get(review.text);
        if (spanish && review.text_es !== spanish) {
          review.text_es = spanish;
          changed += 1;
        }
      }
    }
    for (const value of Object.values(node)) if (typeof value === 'object') walk(value);
  }
  walk(document);
  if (changed) await writeFile(path, `${JSON.stringify(document, null, 2)}\n`);
  if (changed) console.log(`${name}: ${changed} review translations`);
}
