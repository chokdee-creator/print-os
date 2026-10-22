const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),D=require('../payment-channel-data.js');
(async()=>{
 const bank={kind:'bank',provider:'Test',accountName:'Owner',number:'123',note:'',enabled:true,qrDataUrl:'data:image/png;base64,AAAA'},keys=[D.selectionKey(bank,0)],storage=new Map(),images=new Map();let calls=0,revision='v1';
 const ctx=vm.createContext({console,PaymentChannelData:D,SHEET_TAB_NAME:'',localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},PaymentQrCache:{read:async k=>images.get(k),write:async(k,v)=>images.set(k,v)},document:{querySelectorAll:()=>[]},getSheetUrl:()=>'',sendOutstandingOwnerAction:async(action,data)=>{calls++;return data.revision===revision?{ok:true,notModified:true,revision}:{ok:true,channels:[bank],selectedKeys:keys,revision};}});
 vm.runInContext(fs.readFileSync('store-payment-channels.js','utf8'),ctx);const C=ctx.StorePaymentChannels;await C.init();await C.choose();assert.equal(calls,1);await C.choose();await C.refresh();assert.equal(calls,1,'repeat preview/selection within 60 seconds must not reopen Google');assert.ok(C.html(keys).includes(bank.qrDataUrl),'the QR image stays present');
 await C.refresh({force:true});assert.equal(calls,2);assert.ok(C.html(keys).includes(bank.qrDataUrl),'unchanged-version responses must retain the full QR');
 bank.qrDataUrl='data:image/png;base64,BBBB';revision='v2';await C.accept({channels:[bank],selectedKeys:keys,revision});await C.choose();assert.equal(calls,2);assert.ok(C.html(keys).includes(bank.qrDataUrl),'saved changes immediately replace the cached QR without another fetch');
 let sends=0,ownerChecks=0,released=0;
 const server=vm.createContext({Session:{getActiveUser:()=>({getEmail:()=>{ownerChecks++;return 'chokdeeprintings@gmail.com';}}),getEffectiveUser:()=>({getEmail:()=> 'chokdeeprintings@gmail.com'})},orProperties_:()=>({getProperty:()=> 'true'}),LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){released++;}})},orPaymentEntry_:()=>({updatedAt:'v2'}),orPaymentChannelAction_:()=>({ok:true,channels:[bank],selectedKeys:keys,revision:'v2'}),orAction_:()=>{sends++;return {ok:true};}});
 vm.runInContext(fs.readFileSync('outstanding-owner.gs','utf8'),server);
 const request={action:'previewSend',id:'a'.repeat(24),store:'printImage',paymentRevision:'v1'};
 assert.equal(server.outstandingOwnerRequest(request).paymentChannelsChanged,true);assert.equal(sends,0,'stale preview must never send');
 assert.equal(server.outstandingOwnerRequest({...request,paymentRevision:'v2'}).ok,true);assert.equal(sends,1);assert.equal(ownerChecks,2,'owner authentication must still run for every request');assert.equal(released,2);
 console.log('PASS: one Google read for repeated previews, unchanged revisions retain QR bytes, saves update immediately, stale sends stop for review, and every send still verifies the owner.');
})().catch(error=>{console.error(error);process.exitCode=1;});
