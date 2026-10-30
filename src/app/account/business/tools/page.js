'use client';

import {useCallback,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import AccountShell from '../../AccountShell';
import {useCustomerSession,useStorefrontLang} from '@/hooks/useCustomerSession';
import {getCustomerAccessToken} from '@/lib/customerSupabase';
import {stashReorder} from '@/lib/reorderHandoff';
import {BUSINESS_QUOTE_STORAGE_KEY} from '@/lib/businessHandoff.mjs';
import {isBacWater,isGiftLine} from '@/lib/bacWater.mjs';
import {parsePrice} from '@/lib/pricing';
import {paymentLabel,deliveryLabel} from '@/lib/customerOrderView.mjs';

export default function BusinessToolsPage(){
  const {user}=useCustomerSession();
  const [lang]=useStorefrontLang();
  const router=useRouter();
  const en=lang==='en';
  const [data,setData]=useState(null);
  const [tab,setTab]=useState('order');
  const [quantities,setQuantities]=useState({});
  const [search,setSearch]=useState('');
  const [listName,setListName]=useState('');
  const [note,setNote]=useState('');
  const [buyerEmail,setBuyerEmail]=useState('');
  const [role,setRole]=useState('buyer');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const text=(english,spanish)=>en?english:spanish;
  const load=useCallback(async()=>{
    const token=await getCustomerAccessToken();
    if(!token) return;
    const res=await fetch('/api/account/business/suite',{headers:{Authorization:`Bearer ${token}`}});
    const result=await res.json();
    if(!res.ok) throw new Error(result.error);
    setData(result);
  },[]);
  useEffect(()=>{if(user) load().catch(err=>setError(err.message));},[user,load]);
  useEffect(()=>{const value=new URLSearchParams(window.location.search).get('tab');if(['order','lists','quotes','team','orders'].includes(value))setTab(value);},[]);
  const track=useCallback(async(event_type,metadata={})=>{
    try{
      const token=await getCustomerAccessToken();
      if(!token)return;
      await fetch('/api/account/business/activity',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({event_type,metadata}),keepalive:true});
    }catch{}
  },[]);
  useEffect(()=>{if(data)track('tool_tab_viewed',{tab});},[data,tab,track]);
  const selected=Object.entries(quantities).filter(([,qty])=>Number(qty)>0).map(([product,qty])=>({product,qty:Number(qty)}));
  async function action(body){
    setBusy(true);setError('');setNotice('');
    try{
      const token=await getCustomerAccessToken();
      const res=await fetch('/api/account/business/suite',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
      const result=await res.json();
      if(!res.ok)throw new Error(result.error);
      setNotice(result.notification?.sent===false?text('Saved. Email delivery is pending; our team can retry it.','Guardado. El correo está pendiente; nuestro equipo puede reintentarlo.'):text('Saved successfully.','Guardado correctamente.'));
      await load();
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  function checkout(items,quote=null){
    setError('');
    if(!items.length){setError(text('Choose at least one product.','Seleccione al menos un producto.'));return;}
    try{
      track('checkout_started',{source:quote?'quote':tab,quote_id:quote?.id||null,products:items.map(item=>item.product),lines:items.length,units:items.reduce((sum,item)=>sum+Number(item.qty||0),0)});
      if(quote) window.localStorage.setItem(BUSINESS_QUOTE_STORAGE_KEY,JSON.stringify({...quote,business_id:data.business.id}));
      else window.localStorage.removeItem(BUSINESS_QUOTE_STORAGE_KEY);
      if(!stashReorder({items,replaceCart:Boolean(quote)}))throw new Error(text('Your browser could not save the cart. Please enable local storage.','Su navegador no pudo guardar el carrito. Habilite el almacenamiento local.'));
      router.push(`/catalog?reorder=1&lang=${lang}`);
    }catch(err){setError(err.message);}
  }
  async function invoice(order){
    setBusy(true);setError('');
    try{
      const token=await getCustomerAccessToken();
      const res=await fetch(`/api/account/business/invoice?order=${encodeURIComponent(order.id)}`,{headers:{Authorization:`Bearer ${token}`}});
      if(!res.ok){const result=await res.json();throw new Error(result.error);}
      const url=URL.createObjectURL(await res.blob());const anchor=document.createElement('a');anchor.href=url;anchor.download=`statement-${order.order_number}.html`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      track('invoice_downloaded',{order_id:order.id});
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  function unitPrice(product){
    const retail=parsePrice(product.price_usd);
    if(data.business.status!=='approved')return retail;
    const contract=data.business.product_prices.find(row=>row.product===product.product);
    return Math.min(retail*(1-Number(data.business.discount_pct || 0)/100),contract?Number(contract.unit_price_usd):retail);
  }
  const tabs=[['order','Quick order','Pedido rápido'],['lists','Saved lists','Listas'],['quotes','Quotes','Cotizaciones'],['orders','Company orders','Pedidos'],['team','Team buyers','Compradores']];
  return <AccountShell title={{en:'Business tools',es:'Herramientas empresariales'}}>
    <Link href="/account/business">← {text('Company account','Cuenta de empresa')}</Link>
    <nav className="business-tool-tabs" aria-label={text('Business tools','Herramientas empresariales')}>{tabs.filter(([key])=>key!=='team'||data?.canManage).map(([key,english,spanish])=><button key={key} type="button" className={tab===key?'account-btn-primary':'account-btn-secondary'} onClick={()=>setTab(key)}>{text(english,spanish)}</button>)}</nav>
    {error&&<p className="account-notice is-error" role="alert">{error}</p>}{notice&&<p className="account-notice" role="status">{notice}</p>}
    {!data?<p>{text('Loading business tools…','Cargando herramientas…')}</p>:<>
      {(Number(data.business.minimum_units)>0||Number(data.business.minimum_order_usd)>0)&&<p className="account-notice">{text('Your order minimums','Sus mínimos de compra')}: {data.business.minimum_units} {text('merchandise units','unidades de productos')} · US${Number(data.business.minimum_order_usd).toFixed(2)} {text('in products after discounts','en productos después de descuentos')}</p>}
      {tab==='order'&&<section className="account-card"><h2>{text('Wholesale quick order','Pedido mayorista rápido')}</h2><p>{text('Select quantities, save a reusable list, or ask for a quote. Checkout confirms inventory and the best available pricing.','Seleccione cantidades, guarde una lista o solicite una cotización. El pago confirma inventario y el mejor precio disponible.')}</p><div className="account-field"><label htmlFor="business-search">{text('Find products','Buscar productos')}</label><input id="business-search" value={search} onChange={event=>setSearch(event.target.value)}/></div>
        <div className="business-product-list">{data.products.filter(product=>!isBacWater(product.product)&&product.product.toLowerCase().includes(search.toLowerCase())).map(product=><label className="business-product-row" key={product.product}><span>{product.product}<small>US${unitPrice(product).toFixed(2)} / {text('unit estimate','unidad estimada')}{product.status!=='In Stock'?` · ${text('Unavailable','No disponible')}`:''}</small></span><input aria-label={`${text('Quantity','Cantidad')} ${product.product}`} type="number" min="0" max="100" disabled={product.status!=='In Stock'||product.inventory_count===0} value={quantities[product.product]||''} onChange={event=>setQuantities({...quantities,[product.product]:event.target.value})}/></label>)}</div>
        <p>{selected.length} {text('selected product lines','productos seleccionados')}</p><button className="account-btn-primary" disabled={busy||!selected.length} onClick={()=>checkout(selected)}>{text('Continue to checkout','Continuar al pago')}</button>
        <div className="account-field"><label htmlFor="list-name">{text('Reusable list name','Nombre de lista')}</label><input id="list-name" maxLength={100} value={listName} onChange={event=>setListName(event.target.value)}/></div><button className="account-btn-secondary" disabled={busy||!selected.length||!listName.trim()} onClick={()=>action({action:'save-list',name:listName,items:selected})}>{text('Save shopping list','Guardar lista')}</button>
        <div className="account-field"><label htmlFor="quote-note">{text('Quote request notes','Notas de cotización')}</label><textarea id="quote-note" maxLength={2000} value={note} onChange={event=>setNote(event.target.value)}/></div><button className="account-btn-secondary" disabled={busy||!selected.length||data.business.status!=='approved'} onClick={()=>action({action:'request-quote',items:selected,note})}>{text('Request a quote','Solicitar cotización')}</button>
      </section>}
      {tab==='lists'&&<section className="account-card"><h2>{text('Company shopping lists','Listas de compra de empresa')}</h2>{!data.lists.length&&<p>{text('Save a list from Quick order to make repeat purchases faster.','Guarde una lista desde Pedido rápido para repetir compras.')}</p>}{data.lists.map(list=><article className="business-list-item" key={list.id}><h3>{list.name}</h3><p>{list.items.map(item=>`${item.qty} × ${item.product}`).join(' · ')}</p><button className="account-btn-secondary" onClick={()=>{setQuantities(Object.fromEntries(list.items.map(item=>[item.product,item.qty])));setTab('order');}}>{text('Edit quantities','Editar cantidades')}</button> <button className="account-btn-secondary" onClick={()=>checkout(list.items)}>{text('Order list','Comprar lista')}</button> {(data.canManage||list.created_by_email===user.email)&&<button disabled={busy} className="account-btn-link" onClick={()=>action({action:'delete-list',id:list.id})}>{text('Remove list','Eliminar lista')}</button>}</article>)}</section>}
      {tab==='quotes'&&<section className="account-card"><h2>{text('Your quotations','Sus cotizaciones')}</h2>{!data.quotes.length&&<p>{text('Select products under Quick order to request a quote.','Seleccione productos en Pedido rápido para solicitar cotización.')}</p>}{data.quotes.map(quote=>{const used=data.orders.find(order=>order.business_quote_id===quote.id);const valid=quote.status==='approved'&&Date.parse(quote.expires_at)>Date.now()&&!used;return <article className="business-list-item" key={quote.id}><strong>{quote.id.slice(0,8).toUpperCase()} · {text({requested:'Under review',approved:'Approved',declined:'Declined',cancelled:'Cancelled'}[quote.status]||quote.status,{requested:'En revisión',approved:'Aprobada',declined:'Rechazada',cancelled:'Cancelada'}[quote.status]||quote.status)}</strong><ul>{quote.items.map(item=><li key={item.product}>{item.qty} × {item.product}{item.unit_price_usd!=null?` · US$${Number(item.unit_price_usd).toFixed(2)} / unit`:''}</li>)}</ul>{quote.staff_note&&<p>{quote.staff_note}</p>}{quote.expires_at&&<p>{text('Valid until','Válida hasta')}: {new Date(quote.expires_at).toLocaleString(en?'en-US':'es-CR')}</p>}{used?<p>{text('Converted to order','Convertida en pedido')}: {used.order_number}</p>:<button className="account-btn-primary" disabled={!valid||busy||data.business.status!=='approved'} onClick={()=>checkout(quote.items,quote)}>{valid?text('Order this quote','Comprar cotización'):text('Not available for checkout','No disponible para comprar')}</button>}</article>;})}</section>}
      {tab==='orders'&&<section className="account-card"><h2>{text('Recent company orders','Pedidos recientes de la empresa')}</h2><p>{text('Billing downloads include the company details saved when the order was placed. They are commercial statements, not electronic tax invoices.','Las descargas incluyen los datos de empresa guardados al comprar. Son estados comerciales, no facturas electrónicas fiscales.')}</p>{!data.orders.length&&<p>{text('No company orders yet.','Aún no hay pedidos de empresa.')}</p>}{data.orders.map(order=><article className="business-list-item" key={order.id}><strong>{order.order_number}</strong><p>{new Date(order.created_at).toLocaleDateString(en?'en-US':'es-CR')} · {paymentLabel(order,lang)} · {deliveryLabel(order,lang)} · {order.currency==='USD'?`US$${Number(order.total_usd).toFixed(2)}`:`₡${Number(order.total_crc).toLocaleString()}`}</p><p>{order.items.filter(item=>!isGiftLine(item)).map(item=>`${item.qty} × ${item.product}`).join(' · ')}</p><button className="account-btn-secondary" onClick={()=>checkout(order.items.filter(item=>!isGiftLine(item)))}>{text('Order again','Volver a pedir')}</button> <button className="account-btn-secondary" disabled={busy} onClick={()=>invoice(order)}>{text('Download billing statement','Descargar estado de pedido')}</button></article>)}</section>}
      {tab==='team'&&data.canManage&&<section className="account-card"><h2>{text('Team buyers','Compradores del equipo')}</h2><p>{text('Each buyer verifies their own email and shares your company pricing and company order history.','Cada comprador verifica su correo y comparte precios y pedidos de la empresa.')}</p><form onSubmit={event=>{event.preventDefault();action({action:'add-member',email:buyerEmail,role});}}><div className="account-field"><label htmlFor="buyer-email">{text('Buyer email','Correo del comprador')}</label><input id="buyer-email" type="email" required value={buyerEmail} onChange={event=>setBuyerEmail(event.target.value)}/></div>{data.isOwner&&<div className="account-field"><label htmlFor="buyer-role">{text('Role','Rol')}</label><select id="buyer-role" value={role} onChange={event=>setRole(event.target.value)}><option value="buyer">{text('Buyer','Comprador')}</option><option value="manager">{text('Manager — can invite buyers','Encargado — puede invitar compradores')}</option></select></div>}<button className="account-btn-primary" disabled={busy}>{text('Invite buyer','Invitar comprador')}</button></form>{data.members.map(member=><div className="business-list-item" key={member.id}><strong>{member.email}</strong><p>{member.role} · {member.active?text('Active','Activo'):text('Access removed','Acceso retirado')}</p>{member.role!=='owner'&&member.email!==user.email&&member.active&&(data.isOwner||member.role==='buyer')&&<button className="account-btn-secondary" disabled={busy} onClick={()=>action({action:'remove-member',id:member.id})}>{text('Remove company access','Retirar acceso a empresa')}</button>}</div>)}</section>}
    </>}
  </AccountShell>;
}
