import {verifyAdminSession} from '@/lib/adminAuth';
import {getSupabaseAdmin} from '@/lib/supabaseAdmin';
import {canOwnReturningCustomer} from '@/lib/salesAgentAffiliate.mjs';

export async function GET(request){
  const auth=await verifyAdminSession(request,{requireSuperadmin:true});
  if(auth.error)return auth.error;
  const admin=getSupabaseAdmin();
  const result=await admin.from('admin_profiles').select('user_id,name,email,status,tier,is_superadmin');
  if(result.error)return Response.json({error:'Unable to load eligible team members.'},{status:503});
  return Response.json({team:(result.data||[]).filter(canOwnReturningCustomer)},{headers:{'Cache-Control':'private, no-store'}});
}
