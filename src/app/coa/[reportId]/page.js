import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { COA_REPORTS } from '@/lib/productCoas.mjs';
import { productCatalogPath } from '@/lib/catalogCategories.mjs';
export const dynamicParams = false;
export function generateStaticParams() { return COA_REPORTS.map((r) => ({ reportId: r.id })); }
export async function generateMetadata({ params }) {
  const { reportId } = await params;
  const r = COA_REPORTS.find((report) => report.id === reportId);
  return { title: r ? r.product + ' | Janoshik #' + r.id : 'Report not found' };
}
export default async function CoaReportPage({ params }) {
  const { reportId } = await params;
  const r = COA_REPORTS.find((report) => report.id === reportId);
  if (!r) notFound();
  return <main style={{ maxWidth: 900, margin: '0 auto', padding: '28px 16px', color: '#14233a', background: '#fff', minHeight: '100vh' }}>
    <Link href="/coa-database">← Informes / Lab reports</Link>
    <p style={{ marginTop: 28, fontWeight: 700 }}>PEPTIDES COSTA RICA</p>
    <h1 style={{ fontSize: 'clamp(1.6rem, 5vw, 2.3rem)', lineHeight: 1.2 }}>{r.product}</h1>
    <p>Janoshik #{r.id} · {r.testDate}</p>
    {r.noticeEn && <aside style={{ border: '1px solid #c4871d', background: '#fff8e9', padding: 16, borderRadius: 8, margin: '20px 0', lineHeight: 1.6 }}><strong>Informe relacionado / Related report</strong><p>{r.noticeEs}</p><p>{r.noticeEn}</p></aside>}
    {!r.noticeEn && <><p style={{ lineHeight: 1.6 }}>Informe del proveedor para esta sustancia y concentración. El informe no identifica un lote; confirme la correspondencia con su vial antes de usarlo como certificado de lote.</p>
    <p style={{ lineHeight: 1.6 }}>Supplier report for this compound and strength. No batch is identified in the report; confirm the match to your vial before treating it as a batch certificate.</p></>}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '24px 0' }}>
      <a href={r.verifyUrl} target="_blank" rel="noreferrer" style={{ padding: '12px 16px', background: '#123c59', color: '#fff', borderRadius: 8 }}>Verificar en Janoshik / Verify with lab ↗</a>
      <a href={r.image} download style={{ padding: '12px 16px', border: '1px solid #123c59', borderRadius: 8 }}>Descargar / Download</a>
      <Link href={productCatalogPath({ product: r.catalogProduct || r.product })} style={{ padding: '12px 0' }}>Ver producto / View product</Link>
    </div>
    <Image src={r.image} alt={r.product + ' - original Janoshik report #' + r.id} width={1084} height={1600} priority unoptimized style={{ display: 'block', width: '100%', height: 'auto', border: '1px solid #ddd' }} />
  </main>;
}
