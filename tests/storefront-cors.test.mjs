import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { storefrontCorsHeaders } from '../src/lib/publicApiSecurity.mjs';

// The new website (branch `website`) posts its orders to /api/orders/create
// from the browser. To the browser a different subdomain is a different site,
// so the order only goes through when the route names that origin back.

function withEnv(value, fn) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = value;
  try {
    return fn();
  } finally {
    process.env.NODE_ENV = previous;
  }
}

test('the company sites are named back, so the browser lets their orders through', () => {
  withEnv('production', () => {
    for (const origin of [
      'https://peptidescostarica.net',
      'https://www.peptidescostarica.net',
      'https://new.peptidescostarica.net',
      'https://catalog.peptidescostarica.net',
    ]) {
      assert.equal(storefrontCorsHeaders(origin)['Access-Control-Allow-Origin'], origin, origin);
    }
  });
});

test('anything else is not named, so the browser keeps blocking it', () => {
  withEnv('production', () => {
    for (const origin of [
      'http://peptidescostarica.net', // not HTTPS
      'https://peptidescostarica.net.evil.com',
      'https://evilpeptidescostarica.net',
      'https://peptidecostarica-website.vercel.app',
      'http://localhost:3000', // local dev is allowed only outside production
      'https://new.peptidescostarica.net/path', // not a bare origin
      'null',
      '',
      undefined,
    ]) {
      assert.equal('Access-Control-Allow-Origin' in storefrontCorsHeaders(origin), false, String(origin));
    }
  });
});

test('local development can test the website against a local catalog', () => {
  withEnv('development', () => {
    assert.equal(storefrontCorsHeaders('http://localhost:3000')['Access-Control-Allow-Origin'], 'http://localhost:3000');
  });
});

test('only a JSON POST is allowed cross-site: no cookies, no Authorization', () => {
  const headers = storefrontCorsHeaders('https://peptidescostarica.net');
  assert.equal(headers['Access-Control-Allow-Methods'], 'POST, OPTIONS');
  assert.equal(headers['Access-Control-Allow-Headers'], 'Content-Type');
  assert.equal('Access-Control-Allow-Credentials' in headers, false);
  assert.equal(headers.Vary, 'Origin');
});

test('the order route answers the preflight and puts the headers on every reply', () => {
  const route = fs.readFileSync('src/app/api/orders/create/route.js', 'utf8');
  assert.match(route, /export function OPTIONS\(request\)/);
  assert.match(route, /export async function POST\(request\) \{\r?\n\s+const response = await createOrder\(request\);/);
  // The trust check still runs first inside createOrder: CORS opens the door
  // only to origins that check already accepts.
  const body = route.slice(route.indexOf('async function createOrder(request)'));
  assert.match(body.slice(0, 200), /if \(!isTrustedStorefrontRequest\(request\)\)/);
});
