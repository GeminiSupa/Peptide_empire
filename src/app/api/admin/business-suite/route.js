import { verifyAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { businessError,businessFailure,validatedBusinessRep,queueBusinessEmail,deliverBusinessEmail } from '@/lib/businessSuiteServer';
import { businessSalesReport,normalizeBusinessItems } from '@/lib/businessSuite.mjs';
import { isBacWater } from '@/lib/bacWater.mjs';
import { rateLimit } from '@/lib/rateLimit.mjs';
import { getPublicSiteUrl } from '@/lib/publicUrl';
import { buildBusinessQuoteReviewEmail } from '@/lib/businessAccountEmail.mjs';
import { buildBusinessAnalytics } from '@/lib/businessAnalytics.mjs';

export async function GET(request) {
  const auth=await verifyAdminSession(request,{requireSuperadmin:true});
  if(auth.error) return auth.error;
  try {
    const admin=getSupabaseAdmin();
    const results=await Promise.all([
      admin.from('business_accounts').select('*').order('created_at',{ascending:false}),
      admin.from('admin_profiles').select('user_id,name,email,status,tier,is_superadmin,avatar_url,whatsapp_number'),
      admin.from('business_product_prices').select('*'),
      admin.from('business_quotes').select('*').order('created_at',{ascending:false}).limit(200),
      admin.from('business_referral_codes').select('*').order('created_at',{ascending:false}),
      admin.from('business_email_outbox').select('id,business_id,recipient,subject,status,attempts,last_error,created_at').in('status',['failed','pending','sending']).order('created_at',{ascending:false}).limit(100),
      admin.from('business_saved_lists').select('id,business_id,name,items,created_by_email,created_at').order('created_at',{ascending:false}),
      admin.from('business_members').select('id,business_id,email,role,active,created_at').order('created_at',{ascending:false}),
    ]);
    for(const result of results) if(result.error) throw result.error;
    const [businesses,reps,prices,quotes,codes,emails,lists,members]=results.map(result=>result.data || []);
    const orders=[];
    let hasMore=false;
    for(let start=0;start<20000;start+=1000) {
      const page=await admin.from('orders').select('*').not('business_account_id','is',null).order('created_at',{ascending:false}).order('id').range(start,start+999);
      if(page.error) throw page.error;
      orders.push(...(page.data || []));
      if((page.data || []).length<1000) break;
      if(start===19000) hasMore=true;
    }
    const events=[];
    let activityLimited=false;
    for(let start=0;start<20000;start+=1000){
      const page=await admin.from('business_activity_events').select('id,business_id,member_email,event_type,metadata,occurred_at').gte('occurred_at',new Date(Date.now()-365*86400000).toISOString()).order('occurred_at',{ascending:false}).range(start,start+999);
      if(page.error){
        if(['42P01','PGRST205'].includes(page.error.code))break;
        throw page.error;
      }
      events.push(...(page.data||[]));
      if((page.data||[]).length<1000)break;
      if(start===19000)activityLimited=true;
    }
    const analytics=buildBusinessAnalytics({businesses,events,orders,quotes,lists,members});
    return Response.json({businesses,reps,prices,quotes,codes,emails,publicSiteUrl:getPublicSiteUrl(request.url),report:businessSalesReport(businesses,orders),analytics,activityLimited,reportLimited:hasMore,quoteOrders:orders.filter(order=>order.business_quote_id).map(order=>({quote_id:order.business_quote_id,order_number:order.order_number}))},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return businessFailure(error);}
}

export async function POST(request) {
  const auth=await verifyAdminSession(request,{requireSuperadmin:true});
  if(auth.error) return auth.error;
  try {
    if(!rateLimit(`admin-business-suite:${auth.user.id}`,60)) throw businessError('Please wait before trying again.',429);
    const body=await request.json();
    const admin=getSupabaseAdmin();
    if(body.action==='retry-email') return Response.json(await deliverBusinessEmail(admin,body.id));
    if(body.action==='save-referral') {
      const code=String(body.code || '').toUpperCase().trim();
      if(!/^[A-Z0-9_-]{4,40}$/.test(code)) throw businessError('Use 4–40 letters, numbers, underscores or hyphens for the code.');
      await validatedBusinessRep(admin,body.rep_user_id);
      const existing=await admin.from('business_referral_codes').select('rep_user_id').eq('code',code).maybeSingle();
      if(existing.error) throw existing.error;
      if(existing.data && existing.data.rep_user_id!==body.rep_user_id) throw businessError('A printed referral code cannot be reassigned to another rep.',409);
      const result=await admin.from('business_referral_codes').upsert({code,label:String(body.label || code).trim().slice(0,100),rep_user_id:body.rep_user_id,active:body.active!==false},{onConflict:'code'});
      if(result.error) throw result.error;
      return Response.json({ok:true});
    }
    const result=await admin.from('business_accounts').select('*').eq('id',body.business_id).single();
    if(result.error || !result.data) throw businessError('Business not found.',404);
    const business=result.data;
    if(body.action==='save-price') {
      const product=String(body.product || '').trim();
      const price=Number(body.unit_price_usd);
      if(body.unit_price_usd==='' || body.unit_price_usd==null || !Number.isFinite(price) || price<0 || price>1000000 || isBacWater(product)) throw businessError('Enter a valid merchandise price in USD.');
      const catalog=await admin.from('products').select('product').eq('product',product).maybeSingle();
      if(catalog.error) throw catalog.error;
      if(!catalog.data) throw businessError('Choose an existing catalog product.');
      const saved=await admin.from('business_product_prices').upsert({business_id:business.id,product,unit_price_usd:Math.round(price*100)/100},{onConflict:'business_id,product'}).select('id').single();
      if(saved.error) throw saved.error;
      const notification=await queueBusinessEmail(admin,business,{key:`price:${saved.data.id}:${Date.now()}`,subject:'Precio empresarial actualizado / Business price updated',body:`${business.legal_name}\n${product}: US$${price.toFixed(2)} por unidad / per unit.\nSus nuevos precios están disponibles al iniciar sesión. / Your updated pricing is available when signed in.`});
      return Response.json({ok:true,notification});
    }
    if(body.action==='remove-price') {
      const removed=await admin.from('business_product_prices').delete().eq('id',body.id).eq('business_id',business.id).select('product');
      if(removed.error) throw removed.error;
      if(!removed.data?.length) throw businessError('Price not found.',404);
      const notification=await queueBusinessEmail(admin,business,{key:`price-remove:${body.id}:${Date.now()}`,subject:'Precio empresarial actualizado / Business price updated',body:`El precio especial de ${removed.data[0].product} ha finalizado. Se aplican las condiciones actuales de su cuenta.\nThe product-specific price has ended. Your current account pricing now applies.`});
      return Response.json({ok:true,notification});
    }
    if(body.action==='review-quote') {
      const quote=await admin.from('business_quotes').select('*').eq('id',body.id).eq('business_id',business.id).single();
      if(quote.error || !quote.data) throw businessError('Quote not found.',404);
      const used=await admin.from('orders').select('id').eq('business_quote_id',body.id).limit(1);
      if(used.error) throw used.error;
      if(used.data?.length) throw businessError('This quote already has an order and cannot be changed.',409);
      if(!['approved','declined'].includes(body.status)) throw businessError('Choose approved or declined.');
      const patch={status:body.status,staff_note:String(body.staff_note || '').trim().slice(0,2000),updated_at:new Date().toISOString()};
      if(body.status==='approved') {
        if(business.status!=='approved') throw businessError('Approve the business before approving its quote.');
        patch.items=normalizeBusinessItems(body.items,{prices:true});
        const requested=normalizeBusinessItems(quote.data.items);
        if(patch.items.length!==requested.length || requested.some(line=>!patch.items.some(item=>item.product===line.product && item.qty===line.qty))) throw businessError('Keep the requested products and quantities when pricing a quote.');
        const expires=Date.parse(body.expires_at);
        if(!Number.isFinite(expires) || expires<=Date.now() || expires>Date.now()+90*86400000) throw businessError('Set an expiry within the next 90 days.');
        patch.expires_at=new Date(expires).toISOString();
      }
      const saved=await admin.from('business_quotes').update(patch).eq('id',body.id).eq('business_id',business.id).eq('updated_at',quote.data.updated_at).select('id').maybeSingle();
      if(saved.error) throw saved.error;
      if(!saved.data) throw businessError('The quote changed. Refresh before editing.',409);
      const letter=buildBusinessQuoteReviewEmail(business,{...quote.data,...patch},getPublicSiteUrl());
      const notification=await queueBusinessEmail(admin,business,{key:`quote-review:${body.id}:${patch.updated_at}`,recipient:quote.data.requested_by_email,subject:letter.subject,body:letter.text,html:letter.html});
      return Response.json({ok:true,notification});
    }
    throw businessError('Unknown action.');
  }catch(error){return businessFailure(error);}
}
