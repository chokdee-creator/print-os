const assert=require('node:assert/strict');
const P=require('../selected-payment.js');
const row={id:'job1',name:'<img src=x onerror=alert(1)>',date:'2026-10-20',customerType:'ลูกค้าประจำ',customerName:'เอ',sale:100,paid:40};
const docs=P.documents([row,{...row,id:'job2',sale:0.3,paid:0.1},{...row,id:'job3',customerType:'ลูกค้าทั่วไป',paid:0}]);
assert.equal(docs.length,2);assert.equal(docs[0].sale,10030);assert.equal(docs[0].paid,4010);assert.equal(docs[0].balance,6020);
const html=P.html([row],'20 ตุลาคม 2569');
assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('ใบเสร็จรับเงิน'));assert.ok(html.includes('40.00'));assert.ok(html.includes('60.00'));
assert.ok(P.html([{...row,paid:0}],'today').includes('ใบแจ้งยอดชำระ'));
const chokdee=P.html([row],'today','ร้านโชคดีการพิมพ์');
assert.ok(chokdee.includes('data-store-name="ร้านโชคดีการพิมพ์"'));assert.ok(!chokdee.includes('ร้านปริ้นอิมเมจ'));
assert.throws(()=>P.documents([]));assert.throws(()=>P.documents([{...row,paid:101}]));
assert.throws(()=>P.documents([{...row,sale:NaN}]));
console.log('PASS: separate customers, partial payments, exact totals, unpaid document, HTML escaping and invalid amounts');

assert.ok(html.includes('data-document-kind="receipt"'));assert.ok(P.html([{...row,paid:0}],'today').includes('data-document-kind="invoice"'));
const explicitReceipt=P.html([{...row,paid:0}],'today','ร้านโชคดีการพิมพ์','',{kind:'receipt'});
assert.ok(explicitReceipt.includes('<h2>ใบเสร็จรับเงิน</h2>'));
assert.ok(explicitReceipt.includes('data-document-kind="receipt"'));
const explicitInvoice=P.html([{...row,paid:100}],'today','ร้านโชคดีการพิมพ์','',{kind:'invoice'});
assert.ok(explicitInvoice.includes('<h2>ใบแจ้งยอดชำระ</h2>'));
assert.ok(explicitInvoice.includes('data-document-kind="invoice"'));
const dateField=markup=>markup.match(/data-bill-date value="([^"]*)"/)[1];
for(const kind of ['invoice','receipt']) {
  assert.equal(dateField(P.html([row],'1 พฤศจิกายน 2569','ร้านโชคดีการพิมพ์','',{kind})),'20 ตุลาคม 2569');
}
assert.equal(P.documentDate([row,{...row,date:'2026-10-22'}]),'20 ตุลาคม 2569 – 22 ตุลาคม 2569');
assert.equal(P.documentDate([{...row,date:'2026-10-22'},row,row]),'20 ตุลาคม 2569 – 22 ตุลาคม 2569');
assert.equal(P.documentDate([{date:'2026-02-30'},{date:''}],'fallback'),'fallback');
assert.equal(P.documentDate([{date:'2026-12-31'}]),'31 ธันวาคม 2569');
assert.equal(P.documentDate([{date:'2027-01-01'}]),'1 มกราคม 2570');
const separateDates=P.html([row,{...row,customerName:'บี',date:'2026-10-25'}],'1 พฤศจิกายน 2569');
assert.deepEqual([...separateDates.matchAll(/data-bill-date value="([^"]*)"/g)].map(m=>m[1]),['20 ตุลาคม 2569','25 ตุลาคม 2569']);
console.log('PASS: selected job dates for invoices and receipts, multiple dates, customer groups and year boundaries');
