const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const store of ['Account','Chokdee']){
  let shown,load;
  const frame={addEventListener:(name,fn)=>{assert.equal(name,'load');load=fn;}};
  const ctx=vm.createContext({SHEET_TAB_NAME:store,SelectedPayment:require('../selected-payment.js'),showSelectedPaymentDocument:(html,send,title)=>{shown={html,send,title};},document:{getElementById:()=>({querySelector:()=>frame})}});
  vm.runInContext(fs.readFileSync('blank-invoice.js','utf8'),ctx);ctx.openBlankInvoiceForm();
  assert.ok(shown.html.includes(store==='Chokdee'?'ร้านโชคดีการพิมพ์':'ร้านปริ้นอิมเมจ'));
  assert.equal(shown.title,'กรอกข้อมูลออกบิล');assert.equal(shown.send,undefined);assert.equal(typeof load,'function');
  assert.ok(shown.html.includes('data-bill-customer value=""'));assert.ok(shown.html.includes('0.00 บาท'));
}
for(const file of ['print-image-account.html','chokdee-print.html']){
  const html=fs.readFileSync(file,'utf8');assert.ok(html.includes('id="openInvoiceForm" type="button"'));
  assert.ok(html.includes('addEventListener("click", openBlankInvoiceForm)'));
  assert.ok(!html.includes('href="invoice.html">บิลปริ้นอิมเมจ'),'top invoice action must not navigate away');
}
console.log('PASS: direct top-bar form opens blank for the correct shop without account selection, saved-job changes, LINE sends, or navigation.');
