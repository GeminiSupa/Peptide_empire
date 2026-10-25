/**
 * Lab batches and the QR stickers printed for them.
 *
 * Every sticker carries one short code, e.g. BPC10-2610-A, inside a link:
 *
 *   https://catalog.peptidescostarica.net/b/BPC10-2610-A
 *
 * The link is there so a customer's phone camera opens a page. The packing
 * screen only cares about the code at the end. Once a sticker is printed its
 * code can never change, so codes are made here, once, by the server.
 *
 * Pure helpers, shared by the Lab batches tab, the routes and the tests.
 * Relative imports only, so `node --test` can load this file directly.
 */

import { isoToCrWall } from './crTime.mjs';

export const STICKER_BASE_URL = 'https://catalog.peptidescostarica.net/b/';

export const LAB_BATCHES_MIGRATION = 'add-lab-batches-scan.sql';

const SIZE_WORD = /^\d+(?:\.\d+)?(?:mg|ml|mcg|iu|g)$/i;

/**
 * Short, readable start of a code: a few letters of the name plus the size.
 * "BPC-157 10mg" -> "BPC10", "AA Water 3ml" -> "AA3", "GHK-Cu 50mg" -> "GHKC50".
 * Two products may share one; the rest of the code keeps every batch unique.
 */
export function productCodePrefix(productName) {
  const words = String(productName || '').trim().split(/\s+/).filter(Boolean);
  const first = words[0] || '';
  let letters = first.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4);
  if (!letters) letters = first.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4);
  if (!letters) letters = 'P';
  const sizeWord = [...words].reverse().find((word) => SIZE_WORD.test(word));
  const size = sizeWord ? sizeWord.match(/^\d+(?:\.\d+)?/)[0].replace('.', '') : '';
  return `${letters}${size}`.slice(0, 8);
}

/** "BPC10-2610": prefix plus the Costa Rica year and month the batch was entered. */
export function batchCodeBase(productName, at = new Date()) {
  const wall = isoToCrWall(at instanceof Date ? at.toISOString() : at);
  const yymm = wall ? `${wall.slice(2, 4)}${wall.slice(5, 7)}` : '0000';
  return `${productCodePrefix(productName)}-${yymm}`;
}

/** The first free code for a base: -A, -B ... -Z, then -AA, -AB ... */
export function nextBatchCode(base, takenCodes = []) {
  const taken = new Set((takenCodes || []).map((code) => String(code || '').toUpperCase()));
  const letter = (i) => String.fromCharCode(65 + i);
  for (let i = 0; i < 26; i += 1) {
    const code = `${base}-${letter(i)}`;
    if (!taken.has(code)) return code;
  }
  for (let i = 0; i < 26; i += 1) {
    for (let j = 0; j < 26; j += 1) {
      const code = `${base}-${letter(i)}${letter(j)}`;
      if (!taken.has(code)) return code;
    }
  }
  return null;
}

/**
 * Code for the one "old stock" batch a product gets: vials already on the
 * shelf with no batch of their own. BPC10-OLD, or BPC10-OLD-2 when another
 * product already owns BPC10-OLD.
 */
export function oldStockCode(productName, takenCodes = []) {
  const taken = new Set((takenCodes || []).map((code) => String(code || '').toUpperCase()));
  const base = `${productCodePrefix(productName)}-OLD`;
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
  return null;
}

export function stickerUrl(code) {
  return `${STICKER_BASE_URL}${encodeURIComponent(String(code || '').toUpperCase())}`;
}

const CODE_AT_END = /([A-Z0-9]{1,8}-(?:\d{4}-[A-Z]{1,2}|OLD(?:-\d{1,3})?))\s*$/i;

/**
 * Whatever a scanner hands over, reduced to the sticker code.
 *
 * A camera returns the link exactly. A USB scanner TYPES it, and a scanner set
 * to a different keyboard layout from the computer turns "/" and ":" into
 * other characters — so the code is found by its own shape at the end of the
 * text first, and only then by cutting after "/b/".
 */
export function parseStickerCode(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const byShape = text.match(CODE_AT_END);
  if (byShape) return byShape[1].toUpperCase();
  let rest = text;
  const marker = rest.toLowerCase().lastIndexOf('/b/');
  if (marker >= 0) rest = rest.slice(marker + 3);
  else if (rest.includes('/')) rest = rest.slice(rest.lastIndexOf('/') + 1);
  return rest.split(/[?#\s]/)[0].toUpperCase();
}

/** A bare date from a date input ("2026-10-25"), or '' when it is not one. */
export function cleanDateInput(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

/** Only http(s) links are kept as a lab report link. */
export function cleanReportUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}
