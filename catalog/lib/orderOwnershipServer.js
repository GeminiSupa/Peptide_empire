// Copied from the catalog (src/lib/orderOwnershipServer.js) by scripts/sync-catalog-checkout.mjs. Do not edit.
import { buildAgentNameResolver, lookupHistoricalAgent } from '@/catalog/lib/agentAttribution.mjs';
import { findActiveProfile, profileOwnerName, profilesWithOwnerAliases } from '@/catalog/lib/orderOwnership.mjs';

export async function loadTeamProfiles(supabase) {
  const { data, error } = await supabase.from('admin_profiles').select('*');
  if (error) throw error;
  const profiles = data || [];
  const ids = profiles.map((profile) => profile.user_id).filter(Boolean);
  if (!ids.length) return profiles;

  // Renaming a profile must not orphan the customers credited under the old
  // name. Account edits already record old -> new in this durable audit log,
  // so use those former names as identity aliases without rewriting payroll
  // history on completed orders.
  const { data: activity, error: activityError } = await supabase
    .from('admin_activity_log')
    .select('subject_id, detail')
    .eq('subject_type', 'account')
    .eq('action', 'account.updated')
    .in('subject_id', ids);
  if (activityError) {
    console.warn('[orderOwnershipServer] Could not load agent name history:', activityError.message);
    return profiles;
  }
  return profilesWithOwnerAliases(profiles, activity || []);
}

/**
 * The team member who owns this order's customer from earlier closed orders,
 * or '' when the customer is new or their agent has left.
 *
 * Unlike applyCustomerHistoryAttribution, a superadmin counts as an owner here.
 * That function decides commission, where superadmins are not paid; this one
 * decides who may take the customer, and a superadmin's customers need the same
 * protection as anyone's.
 *
 * Throws when the lookup fails, so a caller guarding a claim can refuse rather
 * than let a returning customer through unchecked.
 */
export async function customerOwnerFor(supabase, order, profiles) {
  const match = await lookupHistoricalAgent(supabase, {
    phone: order?.customer_phone,
    email: order?.customer_email,
    resolveAgent: buildAgentNameResolver(profiles),
  });
  if (!match) return '';
  const profile = findActiveProfile(profiles, match.agent);
  return profile ? profileOwnerName(profile) : '';
}
