import { validateSalarySettings } from '@/lib/teamSalary.mjs';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { scopedAdmin } from '@/lib/siteScopedAdmin.mjs';
import { ADMIN_SITE_IDS } from '@/lib/sites.mjs';
import { verifyAdminSession } from '@/lib/adminAuth';
import { recordAdminActivity } from '@/lib/adminActivityLog.mjs';
import { ADMIN_PROFILE_OPTIONAL_COLUMNS, writeDroppingMissingColumns } from '@/lib/optionalColumns.mjs';

export async function POST(request) {
  const auth = await verifyAdminSession(request, { requireSuperadmin: true });
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const {
      email, password, name, permissions, is_superadmin, commission_rate, weekly_salary,
      salary_currency, commission_structure, avatar_url, allowed_sites,
      notifications_enabled, order_email_notifications, lead_email_notifications, order_whatsapp_notifications, whatsapp_number,
    } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 });
    }

    let paySettings;
    try { if (body.salary_frequency !== undefined) paySettings = validateSalarySettings(body); }
    catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
    const supabaseAdmin = scopedAdmin(auth.activeSite);
    if (paySettings?.salary_frequency === 'monthly') {
      const schema = await supabaseAdmin.from('admin_profiles').select('salary_frequency,monthly_salary', { head: true }).limit(1);
      if (schema.error) return NextResponse.json({ error: 'Monthly pay is not installed yet. Run add-team-monthly-pay.sql in Supabase first.' }, { status: 503 });
    }

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    const userId = authData.user.id;

    // 2. Create profile in public.admin_profiles
    const profileRow = {
      user_id: userId,
      email: email,
      name: name,
      permissions: permissions || [],
      is_superadmin: is_superadmin || false,
      commission_rate: commission_rate !== undefined ? parseFloat(commission_rate) : 0,
      weekly_salary: weekly_salary !== undefined ? parseFloat(weekly_salary) : 0,
      salary_currency: salary_currency || 'USD',
      commission_structure: commission_structure || null,
      // Notifications are on unless explicitly switched off, except WhatsApp,
      // which is opt-in so adding a member never starts messaging their phone.
      notifications_enabled: notifications_enabled !== false,
      order_email_notifications: order_email_notifications !== false,
      lead_email_notifications: lead_email_notifications !== false,
      order_whatsapp_notifications: order_whatsapp_notifications === true,
      whatsapp_number: whatsapp_number ? String(whatsapp_number).trim() : null,
      allowed_sites: Array.isArray(allowed_sites)
        ? [...new Set(allowed_sites.filter((s) => ADMIN_SITE_IDS.includes(s)))]
        : [],
    };
    if (paySettings) Object.assign(profileRow, paySettings);
    if (avatar_url) profileRow.avatar_url = avatar_url;

    const { data: profileData, error: profileError, droppedColumns } = await writeDroppingMissingColumns(
      profileRow,
      paySettings?.salary_frequency === 'monthly' ? ADMIN_PROFILE_OPTIONAL_COLUMNS.filter(key => !['weekly_salary','salary_currency'].includes(key)) : [...ADMIN_PROFILE_OPTIONAL_COLUMNS, 'salary_frequency', 'monthly_salary'],
      (row) => supabaseAdmin.from('admin_profiles').insert([row]).select().single()
    );

    if (droppedColumns?.length) {
      console.warn('[admin/users/create] admin_profiles columns missing, run the matching migration:', droppedColumns.join(', '));
    }

    if (profileError) {
      console.error('Error creating admin profile:', profileError);
      // Attempt to clean up auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    await recordAdminActivity(supabaseAdmin, {
      actor: auth.profile,
      action: 'account.created',
      subjectType: 'account',
      subjectId: profileData?.user_id || userId,
      subjectLabel: profileData?.email || email,
      // What they were given, not the password. The count rather than the list:
      // the list is on the row, and the log is for noticing, not auditing text.
      detail: {
        permissions: { from: 'none', to: `${(profileRow.permissions || []).length} areas` },
        superadmin: { from: 'no', to: profileRow.is_superadmin ? 'yes' : 'no' },
      },
      request,
    });

    return NextResponse.json({ success: true, user: profileData });
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
