import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  checkProductImageBackground,
  productImageBackgroundRequirements,
} from '../src/lib/productImageRules.mjs';

/** A vial-shaped block in the middle of a frame, on the background given. */
async function makePhoto({ format = 'png', background = { r: 0, g: 0, b: 0, alpha: 0 } } = {}) {
  const vial = await sharp({
    create: { width: 300, height: 700, channels: 4, background: { r: 29, g: 66, b: 147, alpha: 1 } },
  }).png().toBuffer();

  const frame = sharp({ create: { width: 450, height: 1000, channels: 4, background } })
    .composite([{ input: vial, gravity: 'centre' }]);

  return format === 'jpeg' ? frame.jpeg().toBuffer() : frame.png().toBuffer();
}

test('a transparent PNG is accepted', async () => {
  const verdict = await checkProductImageBackground(await makePhoto());
  assert.equal(verdict.ok, true, verdict.problems.join(' | '));
});

test('a JPEG is refused, because it cannot carry transparency at all', async () => {
  const verdict = await checkProductImageBackground(await makePhoto({ format: 'jpeg' }));
  assert.equal(verdict.ok, false);
  assert.match(verdict.problems[0], /JPEG/);
  assert.match(verdict.problems[0], /PNG/);
});

test('a PNG saved with a white background is refused', async () => {
  const white = { r: 255, g: 255, b: 255, alpha: 1 };
  const verdict = await checkProductImageBackground(await makePhoto({ background: white }));
  assert.equal(verdict.ok, false);
  assert.match(verdict.problems[0], /see-through/);
});

test('a PNG saved on cream is refused too - any filled background boxes the vial', async () => {
  const cream = { r: 251, g: 248, b: 244, alpha: 1 };
  const verdict = await checkProductImageBackground(await makePhoto({ background: cream }));
  assert.equal(verdict.ok, false);
});

test('a photo cropped tight enough to clip one corner is still accepted', async () => {
  // Transparent frame with the block pushed into the top-left corner, so that
  // corner is solid and the other three are not. One clipped corner must not
  // be read as a filled background.
  const vial = await sharp({
    create: { width: 300, height: 700, channels: 4, background: { r: 29, g: 66, b: 147, alpha: 1 } },
  }).png().toBuffer();
  const buffer = await sharp({
    create: { width: 450, height: 1000, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: vial, left: 0, top: 0 }]).png().toBuffer();

  const verdict = await checkProductImageBackground(buffer);
  assert.equal(verdict.ok, true, verdict.problems.join(' | '));
});

test('something that is not an image at all is allowed through, never thrown on', async () => {
  const verdict = await checkProductImageBackground(Buffer.from('not an image'));
  assert.equal(verdict.ok, true);
});

test('the requirements tell the uploader to use PNG and avoid JPG', async () => {
  const lines = productImageBackgroundRequirements().join(' ');
  assert.match(lines, /PNG/);
  assert.match(lines, /JPG/);
});

/*
 * The trim step used to destroy what the check above protects. A transparent
 * PNG with a blank border - exactly what the designer exports - was re-encoded
 * with `quality: 92`, which makes sharp quantise a PNG to a palette and throws
 * the alpha channel away. The file arrived correct and left opaque, so the
 * vial reached the catalog in a solid box and the blame landed on the person
 * who had actually done it right.
 */

import { trimProductImage } from '../src/lib/productImageRules.mjs';

/**
 * A vial on a transparent 1024x1024 frame, in the format given.
 *
 * Rounded, like the real thing: a bottle cropped tight to its own edges still
 * leaves its corners see-through, and that is what the background check is
 * reading. A plain rectangle would fill the frame completely after a trim and
 * test a shape no product photo has.
 */
async function makeWideOpenPhoto(format) {
  const vial = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="700">'
    + '<rect x="0" y="0" width="300" height="700" rx="110" ry="110" fill="#1d4293"/>'
    + '</svg>',
  );

  return sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: vial, gravity: 'centre' }])
    .toFormat(format)
    .toBuffer();
}

test('a transparent PNG is still transparent after the blank border is cropped', async () => {
  const result = await trimProductImage(await makeWideOpenPhoto('png'));
  const meta = await sharp(result.buffer).metadata();

  assert.equal(result.trimmed, true, 'the blank border should still be cropped');
  assert.equal(meta.hasAlpha, true, 'the crop must not cost the photo its transparency');
  assert.ok(meta.width < 1024 && meta.height < 1024, `expected a crop, got ${meta.width}x${meta.height}`);
});

test('the trimmed PNG still passes the background check afterwards', async () => {
  const result = await trimProductImage(await makeWideOpenPhoto('png'));
  const verdict = await checkProductImageBackground(result.buffer);
  assert.equal(verdict.ok, true, verdict.problems.join(' | '));
});

test('a format that cannot keep transparency through a trim is left uncropped instead', async () => {
  // Better a looser crop than a vial in a solid box.
  const result = await trimProductImage(await makeWideOpenPhoto('webp'));
  const meta = await sharp(result.buffer).metadata();
  assert.equal(meta.hasAlpha, true);
});

test('a JPEG is still cropped exactly as before - that path is unchanged', async () => {
  const vial = await sharp({
    create: { width: 300, height: 700, channels: 4, background: { r: 29, g: 66, b: 147, alpha: 1 } },
  }).png().toBuffer();
  const jpeg = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#ffffff' } })
    .composite([{ input: vial, gravity: 'centre' }]).jpeg().toBuffer();

  const result = await trimProductImage(jpeg);
  const meta = await sharp(result.buffer).metadata();
  assert.equal(result.trimmed, true);
  assert.ok(meta.width < 400 && meta.height < 800, `expected a tight crop, got ${meta.width}x${meta.height}`);
});
