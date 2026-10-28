import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { COA_REPORTS, coaReportUrl } from '../src/lib/productCoas.mjs';
const out='public/qr/coa-oct2026';
fs.mkdirSync(out,{recursive:true});
for (const r of COA_REPORTS) {
 const base=path.join(out,`${r.compound.toLowerCase()}-${r.strength}-${r.id}`);
 const options={errorCorrectionLevel:'M',margin:4,color:{dark:'#000000',light:'#ffffff'}};
 fs.writeFileSync(base+'.svg',await QRCode.toString(coaReportUrl(r),{...options,type:'svg'}));
 await QRCode.toFile(base+'.png',coaReportUrl(r),{...options,width:1200});
}
fs.writeFileSync(out+'/reports.json',JSON.stringify(COA_REPORTS.map(r=>({...r,url:coaReportUrl(r)})),null,2));
fs.writeFileSync(out+'/README.txt','Six supplier report QR codes. Print SVGs or high-resolution PNGs in black on white. Preserve the white quiet zone; do not crop. The PDF has 63.5 x 38.1 mm labels, six per A4 sheet; print at 100% scale. Each code opens a permanent report page. Reports have no confirmed batch assignment; verify against the supplied vial. Pending and excluded: ET10 / Epithalon 10mg (catalog 50mg); TA5 / Thymosin Alpha-1 5mg (catalog 10mg); TB4 endotoxin report batch 967293-00003 (catalog TB-500). No batch IDs or purity claims have been added to labels.\n');
console.log('Generated six SVG/PNG pairs');
