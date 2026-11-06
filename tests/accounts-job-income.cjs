const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const scope={owner:'chokdeeprintings@gmail.com',endpoint:'https://script.google.com/macros/s/AKfycbzDF5-Kvqf03RLCxpToRL7C9PAqlfhUvC_xLgnEExF7H4go7gybvzLaKDwtKVBHl6if/exec'};
const context=vm.createContext({crypto:require('node:crypto').webcrypto,TextEncoder,Uint8Array,structuredClone,console});
vm.runInContext(fs.readFileSync('accounts-job-income.js','utf8'),context);
vm.runInContext(fs.readFileSync('accounts-service.gs','utf8'),context);
const api=context.AccountsJobIncome,plain=x=>JSON.parse(JSON.stringify(x));
const manual={id:'manual-entry-1234',name:'รายการเดิม',type:'income',amount:100000,date:'2026-10-30',note:'',createdAt:'2026-10-30T01:00:00Z'};
const fresh=()=>({version:1,revision:'r1',books:[{id:'book-1',name:'ร้านอื่น',entries:[manual]},{id:'book-2',name:'ส่วนตัว',entries:[]},{id:'book-3',name:'PRINCE IMAGE',entries:[manual]}]});
// IDs must be globally unique in the production ledger.
function ledger(){const data=fresh();data.books[0].entries[0]={...manual,id:'other-book-1234'};return data;}
function row(id,overrides={}){const r=Array(31).fill('');Object.assign(r,{0:id,1:'2026-11-07',4:'ลูกค้าทดสอบ',5:'ค้างจ่าย',6:'ป้ายทดสอบ',17:1000,18:250.25,23:'2026-11-06T17:00:00Z',29:'PR-001'},overrides);return r;}
const payload=rows=>({ok:true,sheetName:'Data Account',records:rows});
(async()=>{
  const original=ledger(),rows=[row('new-partial'),row('new-paid',{5:'จ่ายแล้ว',18:0}),row('unpaid',{18:0}),row('old-job',{1:'2026-11-06'}),row('old-redated',{23:'2026-11-06T16:59:59Z'}),row('missing-created',{23:''})];
  const result=await api.merge(original,payload(rows),scope),book=result.data.books[2],generated=book.entries.filter(api.managed);
  assert.equal(result.changed,true);assert.equal(generated.length,2);assert.deepEqual(generated.map(e=>e.amount).sort((a,b)=>a-b),[25025,100000]);
  assert.deepEqual(plain(result.data.books.slice(0,2)),plain(original.books.slice(0,2)),'other books unchanged');
  assert.deepEqual(plain(book.entries[0]),manual,'manual opening balance unchanged');assert.deepEqual(original,ledger(),'input is immutable');
  // Server validation drops unknown fields; synchronization must remain idempotent after a real save.
  const roundTrip=plain(context.ledgerValidate_(result.data));
  assert.equal((await api.merge(roundTrip,payload(rows),scope)).changed,false,'repeated loads never duplicate receipts');
  const changed=await api.merge(roundTrip,payload([row('new-partial',{18:500.55})]),scope);
  assert.equal(changed.data.books[2].entries.filter(api.managed).length,1,'deleted jobs are reconciled');
  assert.equal(changed.data.books[2].entries.find(api.managed).amount,50055,'partial payment updates replace old total');
  const zero=await api.merge(changed.data,payload([row('new-partial',{18:0})]),scope);
  assert.deepEqual(plain(zero.data.books[2].entries),[plain(roundTrip.books[2].entries.find(e=>e.id===manual.id))],'cancelled payment preserves manual entries');
  for(const wrong of [{...scope,owner:'other@example.com'},{...scope,endpoint:scope.endpoint+'other'},null])assert.equal((await api.merge(original,payload(rows),wrong)).changed,false);
  const renamed=ledger();renamed.books[2].name='ร้านอื่น';assert.equal((await api.merge(renamed,payload(rows),scope)).changed,false);
  for(const invalid of [{ok:false,records:[]},{ok:true,sheetName:'Chokdee',records:[]},{ok:true,sheetName:'Data Account',records:null},payload([row('same'),row('same')]),payload([row('bad',{18:'NaN'})]),payload([['short']])])await assert.rejects(()=>api.merge(result.data,invalid,scope));
  assert.equal(result.data.books[2].entries.filter(api.managed).length,2,'failed fetch never removes saved income');
  console.log('PASS: book/account/store scope, Bangkok cutoff, old-job exclusion, partial/unpaid/paid totals, satang, duplicate prevention after backend validation, updates/deletions, manual preservation and failure safety.');
})().catch(e=>{console.error(e);process.exitCode=1;});
