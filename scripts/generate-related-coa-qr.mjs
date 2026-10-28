import fs from 'node:fs';
import QRCode from 'qrcode';
import { COA_REPORTS, coaReportUrl } from '../src/lib/productCoas.mjs';
const out='public/qr/coa-related';
fs.mkdirSync(out,{recursive:true});
const rows=COA_REPORTS.filter(r=>r.catalogProduct);
for(const r of rows){
 const options={errorCorrectionLevel:'M',margin:4,color:{dark:'#000000',light:'#ffffff'}};
 fs.writeFileSync(`${out}/${r.id}.svg`,await QRCode.toString(coaReportUrl(r),{...options,type:'svg'}));
 await QRCode.toFile(`${out}/${r.id}.png`,coaReportUrl(r),{...options,width:1200});
}
fs.writeFileSync(`${out}/reports.json`,JSON.stringify(rows.map(r=>({...r,url:coaReportUrl(r)})),null,2));
fs.writeFileSync(`${out}/README.txt`,'Three related supplier report QR codes. Each opens its specific report with the original lab document and disclosures. Names and strengths refer to the tested samples, not the catalog vial. Epithalon: tested 10mg, catalog 50mg. Thymosin Alpha-1: tested 5mg, catalog 10mg. TB4 10mg: endotoxins only, batch 967293-00003; correspondence to TB-500 unconfirmed. Print black on white, preserve quiet zone. PDF labels 63.5 x 38.1 mm; print at 100%.\n');
console.log('Generated three related report QR pairs');
