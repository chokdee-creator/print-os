const assert=require('node:assert/strict'),P=require('../selected-payment.js');
const row={id:'only-picked',name:'<b>Selected job</b>',date:'2026-10-21',customerType:'ลูกค้าประจำ',customerName:'A & B',quantity:2,sale:100,paid:30};
for(const store of ['ร้านโชคดีการพิมพ์','ร้านปริ้นอิมเมจ']){
  const html=P.html([row],'21 ตุลาคม 2569',store,'<section>Chosen receiving account</section>',{kind:'invoice'});
  assert.ok(html.includes('class="sheet document"'));assert.ok(html.includes('gold-heading'));assert.ok(html.includes('<h1>'+store+'</h1>'));
  assert.ok(html.includes('data:image/png;base64,'));assert.ok(html.includes('data-bill-customer value="A &amp; B"'));
  assert.ok(html.includes('&lt;b&gt;Selected job&lt;/b&gt;'));assert.ok(!html.includes('<b>Selected job</b>'));
  assert.ok(html.includes('<td>2</td><td class="amount">50.00</td><td class="amount">100.00</td>'));
  assert.ok(html.includes('70.00 บาท'));assert.ok(html.includes('30.00 บาท'));assert.ok(html.includes('Chosen receiving account'));
  assert.ok(!html.includes('id="vat"'),'theme must not introduce the template VAT calculation');
  assert.ok(html.includes('placeholder="กรอกเมื่อต้องการแสดง"'),'tax identifier starts empty');
  assert.equal(html.includes('class="header-art prince-art"'),store==='ร้านปริ้นอิมเมจ');
}
console.log('PASS: supplied A4/gold form, separate branding, editable contact fields, safe escaping, quantities, unchanged saved totals, and only chosen bank details.');
