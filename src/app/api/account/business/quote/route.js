import { businessCustomer,businessError,businessFailure,resolveBusinessQuote } from '@/lib/businessSuiteServer';
export async function GET(request){
  try{
    const {admin,business}=await businessCustomer(request);
    const id=new URL(request.url).searchParams.get('id');
    if(!id)throw businessError('Choose a quote.');
    const found=await admin.from('business_quotes').select('items').eq('id',id).eq('business_id',business.id).maybeSingle();
    if(found.error)throw found.error;
    if(!found.data)throw businessError('Quote not found.',404);
    const result=await resolveBusinessQuote(admin,business,id,found.data.items);
    const {requested_by_email:_email,...quote}=result.quote;
    return Response.json({quote},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return businessFailure(error);}
}
