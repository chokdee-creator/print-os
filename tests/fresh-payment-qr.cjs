const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),D=require('../payment-channel-data.js');
const old={kind:'bank',provider:'Test bank',accountName:'Test owner',number:'test-number',note:'',enabled:true,qrDataUrl:'data:image/png;base64,AAAA'},latest={...old,qrDataUrl:'data:image/png;base64,BBBB'};
(async()=>{
 for(const store of ['','Chokdee']){
  const selectedKeys=[D.selectionKey(old,0)],storage=new Map([['printPaymentChannels:shared',JSON.stringify({channels:[old],modifiedAt:1})],['printPaymentChannels:shared:useAccounts',JSON.stringify(selectedKeys)]]),images=new Map([['shared',{channels:[old],modifiedAt:1}]]);
  let cloud=latest,fail=false,reads=0,listener;
  const ctx=vm.createContext({console,PaymentChannelData:D,SHEET_TAB_NAME:store,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},PaymentQrCache:{read:async k=>images.get(k),write:async(k,v)=>images.set(k,v)},document:{querySelectorAll:()=>[]},window:{addEventListener:(event,fn)=>{if(event==='storage')listener=fn;}},getSheetUrl:()=> 'https://example.test',sendOutstandingOwnerAction:async()=>{reads++;if(fail)throw Error('offline');return {channels:[cloud],selectedKeys};}});
  vm.runInContext(fs.readFileSync('store-payment-channels.js','utf8'),ctx);const C=ctx.StorePaymentChannels;await C.init();assert.ok(C.html().includes(old.qrDataUrl));
  let notices=0;const unsubscribe=C.subscribe(()=>{notices++;});await C.choose();
  assert.equal(reads,1,'a fully populated old QR cache must still be refreshed from Google');assert.ok(C.html().includes(latest.qrDataUrl));assert.ok(!C.html().includes(old.qrDataUrl));assert.ok(notices>0);
  cloud={...latest,qrDataUrl:'data:image/png;base64,CCCC'};await C.refresh();assert.ok(C.html().includes(cloud.qrDataUrl),'an open preview receives changed QR data');
  const external={...latest,qrDataUrl:'data:image/png;base64,DDDD'};storage.set('printPaymentChannels:shared',JSON.stringify({channels:[{...external,qrDataUrl:'',qrCached:true}],modifiedAt:Date.now()+1}));images.set('shared',{channels:[external],modifiedAt:Date.now()+2});listener({key:'printPaymentChannels:shared'});await new Promise(setImmediate);assert.ok(C.html().includes(external.qrDataUrl),'another tab refreshes the shared QR');
  fail=true;await assert.rejects(C.choose(),/offline/,'do not silently send a cached QR when the saved source is unavailable');unsubscribe();
 }
 console.log('PASS: both shops refresh complete stale QR caches, notify open bills, receive changes from other tabs, and stop instead of silently using stale QR on cloud failure.');
})().catch(error=>{console.error(error);process.exitCode=1;});

