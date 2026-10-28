import test from 'node:test';
import assert from 'node:assert/strict';
import { COA_REPORTS, matchingCoaReports, productCoaLinks, mergeCoaRows } from '../src/lib/productCoas.mjs';
import { coaLinkLabel, janoshikTaskNumber } from '../src/lib/coaLinks.mjs';
test('six exact products match with separate or combined strength fields',()=>{
 assert.equal(COA_REPORTS.length,9);
 for(const r of COA_REPORTS.filter(r=>!r.catalogProduct)) {
 assert.deepEqual(matchingCoaReports({product:r.product}).map(x=>x.id),[r.id]);
 assert.deepEqual(matchingCoaReports({product:r.compound.toUpperCase(),vial_size:r.strength}).map(x=>x.id),[r.id]);
 }
});
test('unlisted strengths, blends and conflicting fields stay unmatched',()=>{
 for(const product of ['GHK-CU 50mg','Tirzepatide 10mg','BPC-157 + TB-500 20mg','Semax + Selank 20mg']) assert.equal(matchingCoaReports({product}).length,0,product);
 assert.equal(matchingCoaReports({product:'Semax 10mg',vial_size:'20mg'}).length,0);
});
test('existing links preserved, static rows available without database, no duplicate rows',()=>{
 const existing='https://example.com/report.pdf';
 assert.equal(productCoaLinks({product:'BPC-157 10mg',coa:existing})[0],existing);
 assert.equal(mergeCoaRows().length,9);
 const merged=mergeCoaRows([{product:'BPC-157 10mg',coa:existing}]);
 assert.equal(merged.length,9);assert.equal(merged.find(r=>r.product==='BPC-157 10mg').links.length,2);
});
test('both Janoshik URL formats and hosted reports have correct labels',()=>{
 for(const r of COA_REPORTS) assert.equal(janoshikTaskNumber(r.verifyUrl),r.id);
 assert.equal(coaLinkLabel('https://catalog.peptidescostarica.net/coa/125064',[],'en'),'View lab report #125064');
});

test('related reports use explicit catalog associations and visibly disclose differences',()=>{
 for(const r of COA_REPORTS.filter(r=>r.catalogProduct)) {
 assert.deepEqual(matchingCoaReports({product:r.catalogProduct}).map(x=>x.id),[r.id]);
 assert.ok(r.noticeEn);assert.ok(r.noticeEs);
 assert.match(coaLinkLabel('https://catalog.peptidescostarica.net/coa/'+r.id,[],'en'),/Related/);
 }
});
