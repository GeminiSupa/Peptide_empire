'use client';

import {useRef,useState} from 'react';
import {ExternalLink,FileText,Upload} from 'lucide-react';
import {adminFetch} from '@/lib/adminApi';

export default function CoaUploadField({value='',onChange,subject='',lot='',disabled=false,compact=false}){
  const input=useRef(null);const [uploading,setUploading]=useState(false);const [error,setError]=useState('');
  async function upload(event){
    const file=event.target.files?.[0];if(!file)return;
    setUploading(true);setError('');
    try{
      const form=new FormData();form.append('file',file);form.append('subject',subject);form.append('lot',lot);
      const response=await adminFetch('/api/admin/upload-coa',{method:'POST',body:form});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'COA upload failed.');
      onChange(data.url,data);
    }catch(err){setError(err.message||'COA upload failed.');}
    finally{setUploading(false);event.target.value='';}
  }
  return <div style={{display:'grid',gap:6}}>
    <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={upload}/>
    <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
      <button type="button" className="admin-btn admin-btn-secondary" disabled={disabled||uploading} onClick={()=>input.current?.click()} style={compact?{padding:'5px 8px',fontSize:12}:undefined}><Upload size={14}/>{uploading?' Uploading…':value?' Replace COA':' Upload COA'}</button>
      {value&&<a href={value} target="_blank" rel="noreferrer" className="admin-btn admin-btn-secondary" style={compact?{padding:'5px 8px',fontSize:12}:undefined}><FileText size={14}/> View <ExternalLink size={11}/></a>}
    </div>
    {error&&<span style={{color:'#f87171',fontSize:12}}>{error}</span>}
    {!compact&&<small style={{color:'#64748b'}}>PDF, JPG, PNG, or WebP · maximum 20 MB. The uploaded link is filled in automatically.</small>}
  </div>;
}
