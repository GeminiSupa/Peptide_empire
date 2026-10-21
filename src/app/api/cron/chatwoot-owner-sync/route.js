import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cronAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { writeDroppingMissingColumns } from '@/lib/optionalColumns.mjs';
import { chatwootOwnerColumns, planChatwootOwnerUpdates } from '@/lib/chatwootOwnerSync.mjs';
import { handoverLeadToChatwoot, loadChatwootLeadEnabled } from '@/lib/chatwootLead.mjs';
import { leadBelongsInChatwoot } from '@/lib/chatwootLeadEligibility.mjs';
import { chatwootLeadInboxIds, loadCatalogInboxId } from '@/lib/chatwootInboxes.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Point the CRM owner at whoever Chatwoot actually gave the chat to.
 *
 * We hand ad chats over unassigned on purpose and let Chatwoot choose, so the
 * CRM cannot know the answer at the moment the lead is saved. The Chatwoot
 * webhook that was meant to tell us has never fired on this account, and
 * turning it on is a change inside Chatwoot. Reading Chatwoot on a schedule
 * needs nothing from anyone else.
 *
 * Every 15 minutes: a lead is worked within minutes, and commission is settled
 * weekly, so this is far inside the window that matters.
 */

const PAGE_LIMIT = 8;          // 25 per page; 200 conversations covers a day comfortably.
const LEAD_LOOKBACK_DAYS = 30; // Older leads are settled; re-reading them every run is waste.

function readConfig(env) {
  const baseUrl = String(env.CHATWOOT_BASE_URL || '').trim().replace(/\/+$/, '');
  const accountId = String(env.CHATWOOT_ACCOUNT_ID || '').trim();
  const inboxId = String(env.CHATWOOT_INBOX_ID || '').trim();
  const accessToken = String(env.CHATWOOT_API_ACCESS_TOKEN || '').trim();
  return { baseUrl, accountId, inboxId, accessToken, configured: Boolean(baseUrl && accountId && inboxId && accessToken) };
}

// Reads every inbox our leads live in. Ad/TikTok chats and catalog chats sit in
// two different inboxes now, and Chatwoot's conversations endpoint filters by
// one inbox at a time, so it is one pass per inbox.
async function readChatwootAssignees(config, inboxIds, fetchImpl = fetch) {
  const assignees = {};
  for (const inboxId of inboxIds) {
    for (let page = 1; page <= PAGE_LIMIT; page += 1) {
      const url = `${config.baseUrl}/api/v1/accounts/${config.accountId}/conversations`
        + `?status=all&inbox_id=${encodeURIComponent(inboxId)}&page=${page}&sort_by=last_activity_at`;
      const response = await fetchImpl(url, { headers: { api_access_token: config.accessToken } });
      if (!response.ok) throw new Error(`Chatwoot answered ${response.status}`);
      const rows = (await response.json())?.data?.payload || [];
      for (const row of rows) {
        const assignee = row?.meta?.assignee;
        assignees[String(row.id)] = {
          name: assignee?.available_name || assignee?.name || '',
          email: assignee?.email || '',
        };
      }
      if (rows.length < 25) break;
    }
  }
  return assignees;
}

export async function GET(request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;

  const config = readConfig(process.env);
  if (!config.configured) {
    return NextResponse.json({ ok: true, skipped: 'chatwoot_not_configured' });
  }

  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - LEAD_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  try {
    // A lead that never reached Chatwoot is the one that costs money: nobody is
    // looking at it, because Chatwoot is where these are worked. The handover
    // now runs after the visitor has been answered, so a failure there is
    // invisible to them and must be retried here rather than written off.
    let resent = 0;
    const resendFailures = [];
    if (await loadChatwootLeadEnabled(supabase)) {
      const { data: missing } = await supabase
        .from('catalog_leads')
        .select('id, name, email, phone, contact_value, contact_method, lead_source, consent_source, whatsapp_consent, sales_agent, qualification_data, response_due_at, utm_source, utm_medium, utm_campaign')
        .is('chatwoot_conversation_id', null)
        .gte('created_at', since)
        .limit(40);

      for (const lead of (missing || []).filter(leadBelongsInChatwoot)) {
        // Ad leads stay unassigned (Chatwoot picks). WhatsApp catalog leads get
        // the CRM owner when handoverLeadToChatwoot can resolve their email.
        const result = await handoverLeadToChatwoot(supabase, lead);
        if (result.sent) {
          resent += 1;
          console.log(`[chatwoot-owner-sync] resent lead ${lead.id} to Chatwoot as conversation ${result.conversationId}`);
        } else if (!result.skipped) {
          resendFailures.push(lead.id);
          console.error(`[chatwoot-owner-sync] lead ${lead.id} STILL not in Chatwoot: ${result.error || 'unknown'}`);
        }
      }
    }

    const { data: leads, error: leadError } = await supabase
      .from('catalog_leads')
      .select('id, sales_agent, chatwoot_conversation_id')
      .not('chatwoot_conversation_id', 'is', null)
      .gte('created_at', since);
    if (leadError) throw leadError;

    const { data: profiles, error: profileError } = await supabase
      .from('admin_profiles')
      .select('name, email, status, permissions, tier');
    if (profileError) throw profileError;

    // Both inboxes, or a catalog chat's owner would never be synced back.
    const assignees = await readChatwootAssignees(config, chatwootLeadInboxIds({
      adInboxId: config.inboxId,
      catalogInboxId: await loadCatalogInboxId(supabase),
    }));
    const { updates, skipped } = planChatwootOwnerUpdates({ leads: leads || [], assignees, profiles: profiles || [] });

    const at = new Date().toISOString();
    let changed = 0;
    for (const update of updates) {
      // The ownership_* columns are optional on older schemas; a missing one
      // must not stop the owner itself being corrected.
      const { error } = await writeDroppingMissingColumns(
        chatwootOwnerColumns(update, at),
        ['chatwoot_assignee_name', 'chatwoot_assignee_email', 'ownership_updated_at', 'ownership_updated_by'],
        (row) => supabase.from('catalog_leads').update(row).eq('id', update.id),
      );
      if (error) {
        console.warn(`[chatwoot-owner-sync] Could not move lead ${update.id}:`, error.message);
        continue;
      }
      changed += 1;
      console.log(
        `[chatwoot-owner-sync] lead ${update.id}: owner ${JSON.stringify(update.from)} -> ${JSON.stringify(update.to)}`
        + ` (Chatwoot conversation ${update.conversationId})`,
      );
    }

    if (skipped.unknownAgent.length) {
      // Somebody is answering leads that the CRM cannot credit to anyone.
      console.warn(
        '[chatwoot-owner-sync] Chatwoot agents with no active internal profile:',
        [...new Set(skipped.unknownAgent)].join(', '),
      );
    }

    return NextResponse.json({
      ok: true,
      chatwootResent: resent,
      stillMissingFromChatwoot: resendFailures,
      leadsChecked: (leads || []).length,
      conversationsRead: Object.keys(assignees).length,
      ownersChanged: changed,
      skipped: {
        chatwootUnassigned: skipped.unassigned,
        conversationNotSeen: skipped.notSeen,
        alreadyCorrect: skipped.alreadyCorrect,
        unknownChatwootAgents: [...new Set(skipped.unknownAgent)],
      },
    });
  } catch (error) {
    console.error('[chatwoot-owner-sync] failed:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
