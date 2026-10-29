import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const id = '11111111-1111-4111-8111-111111111111';
function fixture({ denied = false, error = null, exists = true } = {}) {
  const calls = [];
  const query = {
    delete() { calls.push('delete'); return this; },
    eq(key, value) { calls.push([key, value]); return this; },
    select() { return this; },
    async maybeSingle() { return { data: exists ? { id } : null, error }; },
  };
  const source = readFileSync(new URL('../src/app/api/admin/business-accounts/route.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export async function /g, 'async function ');
  const handler = new Function('verifyAdminSession', 'getSupabaseAdmin', `${source}\nreturn DELETE;`)(
    async (_request, options) => {
      assert.equal(options.requireSuperadmin, true);
      return denied ? { error: Response.json({ error: 'Forbidden' }, { status: 403 }) } : {};
    },
    () => ({ from(table) { assert.equal(table, 'business_accounts'); return query; } }),
  );
  return { calls, run: body => handler(new Request('https://example.invalid/api/admin/business-accounts', { method: 'DELETE', body: JSON.stringify(body) })) };
}

test('permanent business deletion requires owner access before any database mutation', async () => {
  const f = fixture({ denied: true });
  assert.equal((await f.run({ id, confirmEmail: 'owner@example.com' })).status, 403);
  assert.deepEqual(f.calls, []);
});

test('permanent business deletion rejects missing confirmation and malformed IDs', async () => {
  for (const body of [null, {}, { id }, { id: 'bad', confirmEmail: 'owner@example.com' }]) {
    const f = fixture();
    assert.equal((await f.run(body)).status, 400);
    assert.deepEqual(f.calls, []);
  }
});

test('delete targets only the confirmed company and does not delete logins or orders', async () => {
  const f = fixture();
  const response = await f.run({ id, confirmEmail: ' OWNER@EXAMPLE.COM ' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).deletedId, id);
  assert.deepEqual(f.calls, ['delete', ['id', id], ['email', 'owner@example.com']]);
});

test('mismatched confirmation and database failures never report success', async () => {
  assert.equal((await fixture({ exists: false }).run({ id, confirmEmail: 'wrong@example.com' })).status, 404);
  assert.equal((await fixture({ error: { code: '23503' } }).run({ id, confirmEmail: 'owner@example.com' })).status, 503);
});
