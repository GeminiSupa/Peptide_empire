import test from 'node:test';
import assert from 'node:assert/strict';
import { coaLinkLabel, coaLinks, janoshikTaskNumber } from '../src/lib/coaLinks.mjs';

const PDF = 'https://peptidescostarica.net/wp-content/uploads/2026/02/COA-Reta-12mg.pdf';
const JANOSHIK = 'https://verify.janoshik.com/tests/241360-Retatrutide_12mg_1IHF5VR5PH8R';

test('one link stays one link', () => {
  assert.deepEqual(coaLinks(PDF), [PDF]);
});

test('several links split on spaces or new lines, in order', () => {
  assert.deepEqual(coaLinks(`${PDF} ${JANOSHIK}`), [PDF, JANOSHIK]);
  assert.deepEqual(coaLinks(`${PDF}\n${JANOSHIK}\n`), [PDF, JANOSHIK]);
});

test('empty, dash and junk give no link', () => {
  assert.deepEqual(coaLinks(null), []);
  assert.deepEqual(coaLinks(''), []);
  assert.deepEqual(coaLinks('—'), []);
  assert.deepEqual(coaLinks('N/A'), []);
});

test('a link typed without https gets it, as the order page always did', () => {
  assert.deepEqual(coaLinks('peptidescostarica.net/coa.pdf'), ['https://peptidescostarica.net/coa.pdf']);
});

test('Janoshik links are labelled with their task number', () => {
  assert.equal(janoshikTaskNumber(JANOSHIK), '241360');
  assert.equal(janoshikTaskNumber(PDF), '');
  assert.equal(coaLinkLabel(JANOSHIK, [PDF, JANOSHIK], 'en'), 'Verify Janoshik lab report #241360');
  assert.equal(coaLinkLabel(JANOSHIK, [PDF, JANOSHIK], 'es'), 'Verificar informe Janoshik #241360');
});

test('a download is numbered only when there are two downloads', () => {
  assert.equal(coaLinkLabel(PDF, [PDF], 'en'), 'Download certificate of analysis');
  assert.equal(coaLinkLabel(PDF, [PDF, JANOSHIK], 'en'), 'Download certificate of analysis');
  const second = 'https://drive.google.com/file/d/2/view';
  assert.equal(coaLinkLabel(second, [PDF, second], 'es'), 'Descargar certificado de análisis 2');
});
