const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
  for(const file of ['print-image-account.html','chokdee-print.html']){
    const html=fs.readFileSync(file,'utf8');
    assert.ok(html.includes('id="saveJobAndBill" type="submit"'));
    const source=html.slice(html.indexOf('    let jobSaveInProgress = false;'),html.indexOf('\n    async function saveCustomerPayment'));
    async function run({combo=false,edit=false,offline=false}={}){
      let submit,release;const billButton={},saveButton={},saved=[],bills=[],sync=[];
      const inputs={jobDate:'2026-10-21',jobName:'Only saved job',customerName:'Customer A',customerType:'ลูกค้าประจำ',paymentStatus:'ค้างจ่าย',paymentMethod:'เงินสด',paymentMethodNote:''};
      const els=new Proxy({form:{addEventListener:(type,fn)=>{submit=fn;}},saveJob:saveButton},{get:(target,key)=>key in target?target[key]:({value:inputs[key]||''})});
      const pending=new Promise(resolve=>{release=resolve;});
      const ctx=vm.createContext({els,document:{getElementById:()=>billButton},editingId:edit?'existing':null,
        records:[{id:'unrelated',name:'Other job' },...(edit?[{id:'existing',paidAmount:20,paymentHistory:[],createdAt:'original-date'}]:[])],
        crypto:{randomUUID:()=> 'new-job'},calcFromInputs:()=>({saleTotal:100,width:1,length:1,quantity:1,area:1,saleRate:100,costTotal:20,profit:80}),
        SHEET_TAB_NAME:file==='chokdee-print.html'?'Chokdee':'Account',saveRecords:()=>saved.push(true),render(){},
        resetForm:()=>{ctx.editingId=null;inputs.jobName='';},toast(){},updateSyncStatus(){},
        openSavedJobBill:async record=>{bills.push(record);},sendToSheet:async record=>{sync.push(record);await pending;if(offline)throw Error('offline');return true;}});
      vm.runInContext(source,ctx);
      const event={preventDefault(){},submitter:{id:combo?'saveJobAndBill':'saveJob'}};
      const first=submit(event);await submit(event);assert.equal(saved.length,1,'repeated click cannot create a duplicate');
      assert.equal(saveButton.disabled,true);assert.equal(sync.length,1);release();await first;
      assert.equal(saveButton.disabled,false);assert.equal(billButton.disabled,false);
      assert.equal(bills.length,combo?1:0);assert.equal(ctx.records.length,edit?2:2);
      if(combo){assert.equal(bills[0].name,'Only saved job');assert.equal(bills[0].id,edit?'existing':'new-job');assert.equal(bills[0].paidAmount,edit?20:0);assert.ok(bills[0]===sync[0]);}
    }
    await run();await run({combo:true});await run({combo:true,edit:true});await run({combo:true,offline:true});
  }
  for(const store of ['Account','Chokdee']){
    let preview;const errors=[];
    const ctx=vm.createContext({SHEET_TAB_NAME:store,PaymentChannelData:require('../payment-channel-data.js'),customerType:r=>r.customerType,customerName:r=>r.customerName,paidAmount:r=>r.paidAmount,toast:s=>errors.push(s),StorePaymentChannels:{choose:async()=>[],html:()=>''}});
    vm.runInContext(fs.readFileSync('selected-payment.js','utf8'),ctx);ctx.showSelectedPaymentDocument=html=>{preview=html;};
    const record={id:'saved-job',name:'Saved job only',date:'2026-10-21',customerType:'ลูกค้าประจำ',customerName:'A',saleTotal:100,paidAmount:20};
    await ctx.openSavedJobBill(record);assert.ok(preview.includes('Saved job only'));assert.ok(preview.includes('<h2>ใบแจ้งยอดชำระ</h2>'));assert.ok(preview.includes('80.00'));assert.ok(preview.includes(store==='Chokdee'?'ร้านโชคดีการพิมพ์':'ร้านปริ้นอิมเมจ'));
    await ctx.openSavedJobBill({...record,paidAmount:100});assert.ok(preview.includes('<h2>ใบเสร็จรับเงิน</h2>'));assert.deepEqual(errors,[]);
  }
  console.log('PASS: both shops save and bill only the submitted job, preserve edits, block duplicate clicks, retain ordinary save, and still create a local bill when Sheets is offline. Invoice/receipt headings and balances verified.');
})().catch(e=>{console.error(e);process.exitCode=1;});
