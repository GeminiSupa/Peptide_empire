import { businessCustomer, businessError, businessFailure } from '@/lib/businessSuiteServer';
import { recordBusinessActivity } from '@/lib/businessActivity.mjs';
import { rateLimit } from '@/lib/rateLimit.mjs';

const CLIENT_EVENTS = new Set(['tool_tab_viewed','checkout_started','invoice_downloaded']);

export async function POST(request) {
  try {
    const {admin,business,email}=await businessCustomer(request);
    if(!rateLimit(`business-activity:${email}`,120)) throw businessError('Please wait before recording more activity.',429);
    const body=await request.json();
    if(!CLIENT_EVENTS.has(body.event_type)) throw businessError('Unknown activity.',400);
    await recordBusinessActivity(admin,business,email,body.event_type,body.metadata);
    return Response.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {
    if(error instanceof SyntaxError) return Response.json({error:'Invalid request.'},{status:400});
    return businessFailure(error);
  }
}
