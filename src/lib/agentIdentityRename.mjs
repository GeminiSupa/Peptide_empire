const OWNER_REFERENCES = Object.freeze([
  ['orders', 'sales_agent', true],
  ['catalog_leads', 'sales_agent', true],
  ['referral_scans', 'sales_agent', false],
  ['order_owner_change_requests', 'from_agent', false],
  ['order_owner_change_requests', 'to_agent', false],
  ['commission_payouts', 'agent_name', false],
  ['commission_adjustments', 'agent_name', false],
  ['whatsapp_conversations', 'assigned_to_name', false],
  ['live_chat_conversations', 'assigned_to_name', false],
]);

const missingRelation = (error) => ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error?.code)
  || /does not exist|schema cache|could not find/i.test(String(error?.message || ''));

/**
 * Move every name-based owner reference when a team profile is renamed.
 * User IDs and emails already remain stable; these are the legacy free-text
 * columns used by customer ownership, referrals, and commission reporting.
 */
export async function renameAgentIdentity(supabase, fromName, toName) {
  const from = String(fromName || '').trim();
  const to = String(toName || '').trim();
  if (!from || !to || from === to) return { changed: 0, tables: [] };

  const tables = [];
  let changed = 0;
  for (const [table, column, required] of OWNER_REFERENCES) {
    const { data, error } = await supabase
      .from(table)
      .update({ [column]: to })
      .eq(column, from)
      .select('id');
    if (error) {
      if (!required && missingRelation(error)) continue;
      throw new Error(`The profile name changed, but ${table}.${column} could not be migrated: ${error.message}`);
    }
    const count = (data || []).length;
    if (count) tables.push({ table, column, count });
    changed += count;
  }
  return { changed, tables };
}

export const AGENT_OWNER_REFERENCE_FIELDS = OWNER_REFERENCES.map(([table, column]) => `${table}.${column}`);
