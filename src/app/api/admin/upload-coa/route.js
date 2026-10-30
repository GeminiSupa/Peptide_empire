import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminSession } from '@/lib/adminAuth';

export const runtime = 'nodejs';

const BUCKET = 'coa-documents';
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf','image/jpeg','image/png','image/webp']);

function safePart(value, fallback='coa') {
  const cleaned=String(value||'').trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
  return cleaned||fallback;
}

export async function POST(request) {
  const auth=await verifyAdminSession(request,{requireAnyPermission:['lab_batches','spreadsheet']});
  if(auth.error)return auth.error;
  try{
    const form=await request.formData();
    const file=form.get('file');
    if(!file||typeof file==='string')return NextResponse.json({error:'Choose a COA document.'},{status:400});
    if(!ALLOWED.has(file.type))return NextResponse.json({error:'Use a PDF, JPG, PNG, or WebP COA file.'},{status:400});
    if(file.size>MAX_BYTES)return NextResponse.json({error:'The COA file must be 20 MB or smaller.'},{status:413});
    const extension=file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
    const subject=safePart(form.get('subject'));
    const lot=safePart(form.get('lot'),'unassigned-lot');
    const path=`${subject}/${lot}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${extension}`;
    const supabase=getSupabaseAdmin();
    const created=await supabase.storage.createBucket(BUCKET,{public:true,fileSizeLimit:MAX_BYTES,allowedMimeTypes:[...ALLOWED]});
    if(created.error&&!/already exists|duplicate/i.test(created.error.message||''))throw created.error;
    const bytes=Buffer.from(await file.arrayBuffer());
    const uploaded=await supabase.storage.from(BUCKET).upload(path,bytes,{contentType:file.type,cacheControl:'31536000',upsert:false});
    if(uploaded.error)throw uploaded.error;
    const {data}=supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ok:true,url:data.publicUrl,path,name:file.name,type:file.type,size:file.size});
  }catch(error){
    console.error('[coa/upload]',error);
    return NextResponse.json({error:error.message||'COA upload failed.'},{status:500});
  }
}
