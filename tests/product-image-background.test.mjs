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
