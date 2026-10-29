import { businessCustomer, businessError, businessFailure, publicBusiness, businessProductPrices, queueBusinessEmail } from '@/lib/businessSuiteServer';
import { canManageBusiness, normalizeBusinessItems } from '@/lib/businessSuite.mjs';
import { rateLimit } from '@/lib/rateLimit.mjs';
import { BUSINESS_SIGNUP_RECIPIENTS } from '@/lib/businessSignupNotifications.mjs';
import { buildBusinessQuoteRequestEmail } from '@/lib/businessAccountEmail.mjs';
import { getPublicSiteUrl } from '@/lib/publicUrl';

export async function GET(request) {
  try {
    const {admin,business,email} = await businessCustomer(request);
    const results = await Promise.all([
      admin.from('business_saved_lists').select('*').eq('business_id',business.id).order('created_at',{ascending:false}).limit(100),
      admin.from('business_quotes').select('id,items,customer_note,staff_note,status,expires_at,created_at').eq('business_id',business.id).order('created_at',{ascending:false}).limit(100),
      admin.from('business_members').select('id,email,role,active').eq('business_id',business.id).order('created_at'),
      admin.from('orders').select('id,order_number,created_at,status,items,total_usd,total_crc,currency,business_quote_id,tracking_number').eq('business_account_id',business.id).order('created_at',{ascending:false}).limit(200),
      admin.from('products').select('product,price_usd,status,inventory_count').order('product'),
    ]);
    for (const result of results) if (result.error) throw result.error;
    const [lists,quotes,members,orders,products] = results.map(result=>result.data || []);
    return Response.json({business:publicBusiness(business,await businessProductPrices(admin,business)),lists,quotes,members:canManageBusiness(business,email)?members:[],orders,products,canManage:canManageBusiness(business,email),isOwner:business.email===email},{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) { return businessFailure(error); }
}

export async function POST(request) {
  try {
    const {admin,business,email} = await businessCustomer(request);
    if (!rateLimit(`business-suite:${email}`,30)) throw businessError('Please wait before submitting more requests.',429);
    const body = await request.json();
    if (body.action==='save-list') {
      const name=String(body.name || '').trim().slice(0,100);
      if (!name) throw businessError('Enter a list name.');
      const result=await admin.from('business_saved_lists').insert({business_id:business.id,name,items:normalizeBusinessItems(body.items),created_by_email:email}).select('*').single();
      if (result.error?.code==='23505') throw businessError('A list with this name already exists.',409);
      if (result.error) throw result.error;
      return Response.json({ok:true,list:result.data});
    }
    if (body.action==='delete-list') {
      let query=admin.from('business_saved_lists').delete().eq('id',body.id).eq('business_id',business.id);
      if (!canManageBusiness(business,email)) query=query.eq('created_by_email',email);
      const result=await query.select('id');
      if (result.error) throw result.error;
      if (!result.data?.length) throw businessError('List not found or permission denied.',404);
      return Response.json({ok:true});
    }
    if (body.action==='request-quote') {
      if (business.status!=='approved') throw businessError('Your business must be approved before requesting quotes.',403);
      const items=normalizeBusinessItems(body.items);
      const result=await admin.from('business_quotes').insert({business_id:business.id,requested_by_email:email,items,customer_note:String(body.note || '').trim().slice(0,2000)}).select('*').single();
      if (result.error) throw result.error;
      const alert=await admin.from('admin_notifications').insert({type:'business_quote',title:`Quote requested: ${business.legal_name}`,body:`${items.length} product lines · ${email}`,link_tab:'customers',link_ref:business.id});
      if (alert.error) console.error('[business/quote-alert]',alert.error.message);
      const [notification,...staff]=await Promise.all([
        (()=>{const letter=buildBusinessQuoteRequestEmail(business,result.data,getPublicSiteUrl());return queueBusinessEmail(admin,business,{key:`quote-request:${result.data.id}`,recipient:email,subject:letter.subject,body:letter.text,html:letter.html});})(),
        ...BUSINESS_SIGNUP_RECIPIENTS.map(recipient=>queueBusinessEmail(admin,business,{key:`quote-staff:${result.data.id}:${recipient}`,recipient,subject:`New business quote request: ${business.legal_name}`,body:`${business.legal_name}\nCédula jurídica: ${business.corporation_number}\nRequested by: ${email}\n${items.map(item=>`${item.qty} × ${item.product}`).join('\n')}\nReview and price this quote in Customers → Business operations.`})),
      ]);
      return Response.json({ok:true,quote:result.data,notification,staffNotified:staff.every(row=>row.sent)});
    }
    if (body.action==='add-member') {
      if (!canManageBusiness(business,email)) throw businessError('Only the company owner or manager can invite buyers.',403);
      const memberEmail=String(body.email || '').toLowerCase().trim();
      const role=body.role==='manager' && business.email===email?'manager':'buyer';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(memberEmail) || memberEmail===business.email) throw businessError('Enter a different buyer email.');
      const blocked=await admin.from('order_claim_blocklist').select('email').eq('email',memberEmail).maybeSingle();
      if (blocked.error) throw blocked.error;
      if (blocked.data) throw businessError('Use a dedicated customer email for this buyer.');
      const existing=await admin.from('business_members').select('*').eq('email',memberEmail).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data && (existing.data.business_id!==business.id || existing.data.role==='owner' || (existing.data.role==='manager' && business.email!==email))) throw businessError('This email cannot be added to this company.',409);
      const result=existing.data
        ? await admin.from('business_members').update({active:true,role}).eq('id',existing.data.id).eq('business_id',business.id).select('*').single()
        : await admin.from('business_members').insert({business_id:business.id,email:memberEmail,role}).select('*').single();
      if (result.error) throw result.error;
      const notification=await queueBusinessEmail(admin,business,{key:`member:${result.data.id}:${Date.now()}`,recipient:memberEmail,subject:'Invitación empresarial / Business buyer invitation',body:`${business.legal_name} le invita a comprar con su cuenta empresarial. Inicie sesión con este correo y verifique su código.\nYou have been invited as a ${role}. Sign in with this email and verify the email code. You will share company pricing and company order history.`});
      return Response.json({ok:true,notification});
    }
    if (body.action==='remove-member') {
      if (!canManageBusiness(business,email)) throw businessError('Permission denied.',403);
      let query=admin.from('business_members').update({active:false}).eq('id',body.id).eq('business_id',business.id).neq('role','owner').neq('email',email);
      if (business.email!==email) query=query.eq('role','buyer');
      const result=await query.select('id');
      if (result.error) throw result.error;
      if (!result.data?.length) throw businessError('Buyer not found or permission denied.',404);
      return Response.json({ok:true});
    }
    throw businessError('Unknown business action.');
  } catch(error) { if(error instanceof SyntaxError) return Response.json({error:'Invalid request.'},{status:400}); return businessFailure(error); }
}
