import { catalogCompoundAndSize, splitCompoundAndSize } from './catalogCategories.mjs';
import { coaLinks } from './coaLinks.mjs';

// Supplier reports approved for publication. Related reports carry explicit disclosures.
export const COA_REPORTS = Object.freeze([
  {
    "id": "125064",
    "compound": "BPC-157",
    "strength": "10mg",
    "testDate": "2026-03-19",
    "verifyUrl": "https://verify.janoshik.com/tests/125064_2T3SWW4HHHW8",
    "image": "/coa/reports/125064.jpeg",
    "product": "BPC-157 10mg",
    "batch": "Not provided / No indicado"
  },
  {
    "id": "224329",
    "compound": "Cagrilintide",
    "strength": "5mg",
    "testDate": "2026-08-25",
    "verifyUrl": "https://verify.janoshik.com/tests/224329_N5MBJ6VZIW21",
    "image": "/coa/reports/224329.jpeg",
    "product": "Cagrilintide 5mg",
    "batch": "Not provided / No indicado"
  },
  {
    "id": "196354",
    "compound": "GHK-Cu",
    "strength": "100mg",
    "testDate": "2026-06-26",
    "verifyUrl": "https://verify.janoshik.com/tests/196354_QF59U1HR7M9Z",
    "image": "/coa/reports/196354.jpeg",
    "product": "GHK-Cu 100mg",
    "batch": "Not provided / No indicado"
  },
  {
    "id": "196360",
    "compound": "Semax",
    "strength": "10mg",
    "testDate": "2026-06-23",
    "verifyUrl": "https://verify.janoshik.com/tests/196360_EDGXZ6A5KNSM",
    "image": "/coa/reports/196360.jpeg",
    "product": "Semax 10mg",
    "batch": "Not provided / No indicado"
  },
  {
    "id": "125071",
    "compound": "Selank",
    "strength": "10mg",
    "testDate": "2026-03-19",
    "verifyUrl": "https://verify.janoshik.com/tests/125071_PQHN6U119YGZ",
    "image": "/coa/reports/125071.jpeg",
    "product": "Selank 10mg",
    "batch": "Not provided / No indicado"
  },
  {
    "id": "164662",
    "compound": "Tirzepatide",
    "strength": "120mg",
    "testDate": "2026-05-27",
    "verifyUrl": "https://verify.janoshik.com/tests/164662_D9DXNXDK1YM4",
    "image": "/coa/reports/164662.jpeg",
    "product": "Tirzepatide 120mg",
    "batch": "Not provided / No indicado"
  }
, {
  "id": "164620",
  "compound": "Epithalon",
  "strength": "10mg",
  "product": "Epithalon 10mg (ET10)",
  "catalogProduct": "Epithalon 50mg",
  "catalogCompound": "Epithalon",
  "catalogStrength": "50mg",
  "testDate": "2026-05-27",
  "verifyUrl": "https://verify.janoshik.com/tests/164620_PJB92BNKVSD5",
  "batch": "Not provided / No indicado",
  "noticeEn": "Related supplier report: ET10 / Epithalon 10mg. The catalog vial is 50mg. This report does not verify the content or batch of the 50mg vial.",
  "noticeEs": "Informe relacionado del proveedor: ET10 / Epithalon 10mg. El vial del catálogo es de 50mg. Este informe no verifica el contenido ni el lote del vial de 50mg.",
  "image": "/coa/reports/164620.jpeg"
},
{
  "id": "164626",
  "compound": "Thymosin Alpha-1",
  "strength": "5mg",
  "product": "Thymosin Alpha-1 5mg (TA5)",
  "catalogProduct": "Thymosin Alpha-1 10mg",
  "catalogCompound": "Thymosin Alpha-1",
  "catalogStrength": "10mg",
  "testDate": "2026-05-27",
  "verifyUrl": "https://verify.janoshik.com/tests/164626_1EEQFWD1BRTG",
  "batch": "Not provided / No indicado",
  "noticeEn": "Related supplier report: TA5 / Thymosin Alpha-1 5mg. The catalog vial is 10mg. This report does not verify the content or batch of the 10mg vial.",
  "noticeEs": "Informe relacionado del proveedor: TA5 / Thymosin Alpha-1 5mg. El vial del catálogo es de 10mg. Este informe no verifica el contenido ni el lote del vial de 10mg.",
  "image": "/coa/reports/164626.jpeg"
},
{
  "id": "241369",
  "compound": "TB4",
  "strength": "10mg",
  "product": "TB4 10mg — endotoxin analysis",
  "catalogProduct": "TB-500 10mg",
  "catalogCompound": "TB-500",
  "catalogStrength": "10mg",
  "testDate": "2026-10-13",
  "verifyUrl": "https://verify.janoshik.com/tests/241369_PIKRA6VQXQFD",
  "batch": "967293-00003",
  "noticeEn": "Related supplier report: TB4 10mg, batch 967293-00003; endotoxin result 1.569 EU/vial. The catalog product is named TB-500 10mg; product and batch correspondence is unconfirmed. This is an endotoxin-only test, not a purity, content or sterility certificate.",
  "noticeEs": "Informe relacionado del proveedor: TB4 10mg, lote 967293-00003; resultado de endotoxinas 1.569 EU/vial. El producto del catálogo se llama TB-500 10mg; la correspondencia de producto y lote no está confirmada. Solo analiza endotoxinas; no certifica pureza, contenido ni esterilidad.",
  "image": "/coa/reports/241369.jpeg"
}
]);
export const coaReportUrl = (report) => `https://catalog.peptidescostarica.net/coa/${report.id}`;
const normalize = (value) => String(value).toLowerCase().replace(/[^a-z0-9.]/g, '');
export function matchingCoaReports(product) {
  const { compound, size } = catalogCompoundAndSize(product);
  const named = splitCompoundAndSize(product?.product);
  // Conflicting name/size fields must not attach a report to the wrong strength.
  if (named.size && normalize(named.size) !== normalize(size)) return [];
  return COA_REPORTS.filter((r) => normalize(r.catalogCompound || r.compound) === normalize(compound) && normalize(r.catalogStrength || r.strength) === normalize(size));
}
export function productCoaLinks(product) {
  return [...new Set([...coaLinks(product?.coa), ...matchingCoaReports(product).map(coaReportUrl)])];
}
export function mergeCoaRows(rows = []) {
  const merged = rows.map((r) => ({...r, links: productCoaLinks(r)}));
  for (const report of COA_REPORTS) {
    if (!merged.some((r) => matchingCoaReports(r).some((match) => match.id === report.id))) {
      merged.push({ product: report.catalogProduct || report.product, vial_size: report.catalogStrength || report.strength, links: [coaReportUrl(report)] });
    }
  }
  return merged.filter((r) => r.links.length).sort((a,b) => a.product.localeCompare(b.product));
}
