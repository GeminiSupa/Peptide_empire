import { businessCustomer,businessError,businessFailure } from '@/lib/businessSuiteServer';
import { businessInvoiceHtml } from '@/lib/businessInvoice.mjs';

export async function GET(request) {
  try {
    const {admin,business}=await businessCustomer(request);
    const id=new URL(request.url).searchParams.get('order');
    if(!id) throw businessError('Choose an order.');
    const result=await admin.from('orders').select('*').eq('id',id).eq('business_account_id',business.id).maybeSingle();
    if(result.error) throw result.error;
    if(!result.data) throw businessError('Order not found.',404);
    const filename=`statement-${String(result.data.order_number).replace(/[^a-zA-Z0-9_-]/g,'')}.html`;
    return new Response(businessInvoiceHtml(result.data),{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",'X-Content-Type-Options':'nosniff'}});
  }catch(error){return businessFailure(error);}
}
