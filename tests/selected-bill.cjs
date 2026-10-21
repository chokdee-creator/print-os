const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../selected-payment.js'),D=require('../payment-channel-data.js'),R=require('../outstanding-reports.js');
(async()=>{
  for(const store of ['Account','Chokdee']){
    const records=[
      {id:'picked',name:'Selected partial job',date:'2026-10-20',type:'regular',customer:'Same customer',saleTotal:100.30,paid:40.10},
      {id:'excluded',name:'Unselected same customer/date',date:'2026-10-20',type:'regular',customer:'Same customer',saleTotal:999,paid:0},
      {id:'paid',name:'Already fully paid',date:'2026-10-20',type:'regular',customer:'Same customer',saleTotal:200,paid:200}
    ];
    const button={disabled:false,textContent:'ส่งยอดชำระ'},errors=[],sent=[];let preview;
    const ctx=vm.createContext({InvoiceTheme:require('../bill-theme.js'),records,selectedIds:new Set(['picked','paid']),SHEET_TAB_NAME:store,PaymentChannelData:D,PrintOutstanding:R,
      customerType:r=>'ลูกค้าประจำ',customerName:r=>r.customer,paidAmount:r=>r.paid,balanceAmount:r=>r.saleTotal-r.paid,
      document:{getElementById:()=>button},toast:s=>errors.push(s),getSheetUrl:()=> 'https://script.google.com/test',
      StorePaymentChannels:{choose:async()=>['chosen-bank'],html:keys=>{assert.deepEqual(Array.from(keys),['chosen-bank']);return '<section>Chosen bank</section>';}},
      LineRecipients:{selected:()=> 'confirmed-recipient'},sendOutstandingOwnerAction:async(action,data)=>{sent.push({action,data});return{recipientName:'owner'};}});
    vm.runInContext(fs.readFileSync('selected-payment.js','utf8'),ctx);
    ctx.showSelectedPaymentDocument=(html,send)=>{preview={html,send};};
    vm.runInContext(fs.readFileSync('outstanding-panel.js','utf8'),ctx);
    await ctx.sendSelectedOutstanding();
    assert.deepEqual(errors,[]);assert.equal(sent.length,0,'opening bill must not send a LINE message');
    assert.ok(preview.html.includes('<h2>ใบแจ้งยอดชำระ</h2>'));
    assert.ok(preview.html.includes(store==='Chokdee'?'ร้านโชคดีการพิมพ์':'ร้านปริ้นอิมเมจ'));
    assert.ok(preview.html.includes('Selected partial job'));assert.ok(!preview.html.includes('Unselected same customer/date'));
    assert.ok(!preview.html.includes('Already fully paid'));assert.ok(preview.html.includes('100.30'));assert.ok(preview.html.includes('40.10'));assert.ok(preview.html.includes('60.20'));
    assert.ok(preview.html.includes('Chosen bank'));assert.ok(!preview.html.includes('<h2>ใบเสร็จรับเงิน</h2>'));
    ctx.selectedIds.clear();ctx.selectedIds.add('excluded');await preview.send();
    assert.equal(sent.length,1);assert.deepEqual(Array.from(sent[0].data.config.recordIds),['picked'],'send uses the bill selection captured before changing checkboxes');
    assert.equal(sent[0].data.store,store==='Chokdee'?'chokdee':'printImage');assert.equal(button.disabled,false);
    await preview.send(['newly-selected-bank']);
    assert.deepEqual(Array.from(sent[1].data.paymentKeys),['newly-selected-bank'],'LINE uses the accounts chosen in the current bill rather than the opening defaults');
    ctx.selectedIds.clear();preview=null;await ctx.sendSelectedOutstanding();assert.equal(preview,null);assert.equal(errors.length,1);
  }
  assert.throws(()=>P.documents([]));
  console.log('PASS: both stores create a bill only from selected outstanding jobs, exact partial totals, invoice heading, chosen bank, no automatic send, frozen send selection, and empty selection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
