const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const repo=path.join(__dirname,'..'),D=require('../payment-channel-data.js');
const qr='data:image/png;base64,iVBORw0KGgo=';
const settings=[{kind:'bank',provider:'Test bank',accountName:'Test <Owner>',number:'000-test',note:'Only a test',enabled:true,qrDataUrl:qr}];
assert.equal(D.normalize(settings)[0].qrDataUrl,qr);assert.match(D.text(settings),/000-test/);assert.equal(D.text([{...settings[0],enabled:false}]),'');
assert.throws(()=>D.normalize([{...settings[0],qrDataUrl:'data:image/svg+xml;base64,AAAA'}]));assert.throws(()=>D.normalize([{...settings[0],number:''}]));
const accounts=[settings[0],{...settings[0],provider:'Second bank',number:'second-account',qrDataUrl:'data:image/png;base64,AAAA'},{...settings[0],provider:'Disabled',number:'disabled',enabled:false}];
const chosenKey=D.selectionKey(accounts[1],1);
assert.equal(D.select(accounts,[chosenKey]).length,1);assert.equal(D.select(accounts,[chosenKey])[0].number,'second-account');assert.equal(D.select(accounts,[chosenKey])[0].qrDataUrl,'data:image/png;base64,AAAA');
assert.equal(D.text(D.select(accounts,[chosenKey])).includes('000-test'),false);assert.equal(D.select(accounts,[]).length,0);assert.equal(D.select(accounts).length,2);
assert.throws(()=>D.select(accounts,[D.selectionKey(accounts[2],2)]));assert.throws(()=>D.select(accounts,[chosenKey,chosenKey]));
assert.throws(()=>D.select([accounts[1],accounts[0]],[chosenKey]));assert.throws(()=>D.select([{...accounts[1],number:'changed'}],[chosenKey]));
const history=[{date:'2026-10-20T00:00:00Z',amount:20,method:'เงินสด',note:'Test cash'}];
const c=vm.createContext({console,Date,PaymentChannelData:D});vm.runInContext(fs.readFileSync(path.join(repo,'google-apps-script-installed.js'),'utf8'),c);
const row=c.buildRow_({id:'test',date:'2026-10-20',name:'Test job',saleTotal:100,paidAmount:20,paymentStatus:'ค้างจ่าย',paymentMethod:'เงินสด',paymentHistory:history,paymentMethodNote:'test note'},[]);
assert.equal(row.length,29);assert.equal(row[18],20);assert.equal(row[26],'เงินสด');assert.equal(JSON.parse(row[27])[0].amount,20);
const preserved=c.buildRow_({id:'test',saleTotal:100,paidAmount:20},row);assert.equal(preserved[26],'เงินสด');assert.equal(preserved[27],row[27]);assert.equal(preserved[28],'test note');
vm.runInContext(fs.readFileSync(path.join(repo,'outstanding-reports.js'),'utf8'),c);
assert.equal(c.PrintOutstanding.balance({saleTotal:100,paidAmount:20,paymentStatus:'ค้างจ่าย',paymentMethod:'เงินสด'}),8000);
assert.equal(c.PrintOutstanding.balance({saleTotal:100,paidAmount:20,paymentStatus:'ค้างจ่าย'}),10000);
for(const page of ['print-image-account.html','chokdee-print.html']){
 const html=fs.readFileSync(path.join(repo,page),'utf8');const code=html.match(/function normalizeSheetRecord\(row\) \{[\s\S]*?\n    \}/)[0];
 const ctx=vm.createContext({PaymentChannelData:D,SHEET_TAB_NAME:"Chokdee",dateInputValue:s=>s,crypto:{randomUUID:()=> 'id'}});vm.runInContext(code,ctx);
 const loaded=ctx.normalizeSheetRecord(row);assert.equal(loaded.paidAmount,20,page);assert.equal(loaded.balanceTotal,80,page);assert.equal(loaded.paymentMethod,'เงินสด',page);assert.equal(loaded.paymentHistory.length,1,page);
 const legacy=ctx.normalizeSheetRecord({...loaded,paymentMethod:'',paymentHistory:[],paymentSlipUrl:''});assert.equal(legacy.paidAmount,0,page);
 for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
}
const files=new Map();c.orReadDelivery_=key=>files.get(key);c.orWriteDelivery_=(key,v)=>files.set(key,v);c.orStore_=store=>{if(!['printImage','chokdee'].includes(store))throw Error('store');return{id:store};};
vm.runInContext(fs.readFileSync(path.join(repo,'payment-channels.gs'),'utf8'),c);
c.orPaymentChannelAction_({action:'savePaymentChannels',store:'printImage',channels:settings});assert.equal(c.orPaymentChannels_('printImage').length,1);assert.equal(c.orPaymentChannels_('chokdee').length,0);assert.throws(()=>c.orPaymentChannels_('wrong'));
const ui=vm.createContext({PaymentChannelData:D,SHEET_TAB_NAME:'Data Account',localStorage:{getItem:()=>JSON.stringify(settings)},document:{querySelectorAll:()=>[]}});vm.runInContext(fs.readFileSync(path.join(repo,'store-payment-channels.js'),'utf8'),ui);ui.StorePaymentChannels.init();assert.match(ui.StorePaymentChannels.html(),/Test &lt;Owner&gt;/);assert.match(ui.StorePaymentChannels.html(),/data:image\/png/);assert.equal(ui.StorePaymentChannels.append('Report').split('ช่องทางชำระเงินของร้าน').length,2);
console.log('PASS: payment/QR validation, store isolation, legacy preservation, cash partial-payment round trip in both shops, receipt escaping, and page syntax.');

