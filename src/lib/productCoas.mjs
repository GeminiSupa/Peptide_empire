import { catalogCompoundAndSize, splitCompoundAndSize } from './catalogCategories.mjs';
import { coaLinks } from './coaLinks.mjs';

// Only exact compound + nominal strength matches approved for publication.
// ET10, TA5 and TB4 are deliberately pending and are not included here.
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
]);
export const coaReportUrl = (report) => `https://catalog.peptidescostarica.net/coa/${report.id}`;
const normalize = (value) => String(value).toLowerCase().replace(/[^a-z0-9.]/g, '');
export function matchingCoaReports(product) {
  const { compound, size } = catalogCompoundAndSize(product);
  const named = splitCompoundAndSize(product?.product);
  // Conflicting name/size fields must not attach a report to the wrong strength.
  if (named.size && normalize(named.size) !== normalize(size)) return [];
  return COA_REPORTS.filter((r) => normalize(r.compound) === normalize(compound) && normalize(r.strength) === normalize(size));
}
export function productCoaLinks(product) {
  return [...new Set([...coaLinks(product?.coa), ...matchingCoaReports(product).map(coaReportUrl)])];
}
export function mergeCoaRows(rows = []) {
  const merged = rows.map((r) => ({...r, links: productCoaLinks(r)}));
  for (const report of COA_REPORTS) {
    if (!merged.some((r) => matchingCoaReports(r).some((match) => match.id === report.id))) {
      merged.push({ product: report.product, vial_size: report.strength, links: [coaReportUrl(report)] });
    }
  }
  return merged.filter((r) => r.links.length).sort((a,b) => a.product.localeCompare(b.product));
}
