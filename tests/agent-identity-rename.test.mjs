import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_OWNER_REFERENCE_FIELDS, renameAgentIdentity } from '../src/lib/agentIdentityRename.mjs';

function fakeSupabase(counts = {}) {
  const writes = [];
  return {
    writes,
    from(table) {
      return {
        update(patch) {
          const column = Object.keys(patch)[0];
          return {
            eq(filterColumn, from) {
              return {
                async select() {
                  writes.push({ table, column, filterColumn, from, to: patch[column] });
                  return { data: Array.from({ length: counts[`${table}.${column}`] || 0 }, (_, id) => ({ id })) };
                },
              };
            },
          };
        },
      };
    },
  };
}

test('renaming an agent migrates every name-based ownership and payout reference', async () => {
  const db = fakeSupabase({ 'orders.sales_agent': 22, 'catalog_leads.sales_agent': 4, 'commission_payouts.agent_name': 2 });
  const result = await renameAgentIdentity(db, ' Yese ', ' Yesenia Araya Herrera ');
  assert.equal(result.changed, 28);
  assert.deepEqual(db.writes.map((write) => `${write.table}.${write.column}`), AGENT_OWNER_REFERENCE_FIELDS);
  assert.ok(db.writes.every((write) => write.from === 'Yese' && write.to === 'Yesenia Araya Herrera'));
});

test('capitalization changes also update the stored database identity', async () => {
  const db = fakeSupabase();
  await renameAgentIdentity(db, 'Yesenia', 'yesenia');
  assert.equal(db.writes.length, AGENT_OWNER_REFERENCE_FIELDS.length);
});
