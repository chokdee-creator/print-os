const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const P=require('../outstanding-reports.js');
const c={customers:[{type:'ลูกค้าประจำ',name:'เอ'}],start:'2026-10-01',end:'2026-10-31',group:'day',cadence:'off',range:'fixed'};
const record=(extra={})=>({name:'งาน',date:'2026-10-01',customerType:'ลูกค้าประจำ',customerName:'เอ',saleTotal:100,paidAmount:20,paymentStatus:'ค้างจ่าย',paymentSlipUrl:'https://example.com/slip',...extra});
const records=[record(),record({date:'2026-10-02',saleTotal:50,paymentSlipUrl:''}),record({paymentStatus:'จ่ายแล้ว'}),record({customerType:'ลูกค้าทั่วไป'}),record({customerName:'บี'}),record({date:'2026-09-30'}),record({name:''}),record({date:'2026-10-02',saleTotal:0.1,paidAmount:0,paymentSlipUrl:''}),record({date:'2026-10-02',saleTotal:0.2,paidAmount:0,paymentSlipUrl:''})];
const report=P.build(records,c,'2026-10-18');
assert.equal(report.satang,13030);assert.equal(report.count,4);assert.equal(report.rows.length,2);
assert.equal(P.build(records,{...c,group:'month'},'2026-10-18').rows.length,1);
assert.equal(P.build(records,{...c,start:'2026-10-02',end:'2026-10-02'},'2026-10-18').satang,5030);
assert.equal(P.balance(record({paidAmount:200})),10000);
assert.equal(P.balance(record({paymentStatus:'จ่ายแล้ว',paymentSlipUrl:''})),0);
assert.equal(P.balance(record({paymentSlipUrl:'',paidAmount:100})),10000);
assert.equal(P.build(records,{...c,customers:[{type:'ลูกค้าประจำ',name:'ไม่พบ'}]},'2026-10-18').count,0);
assert.equal(P.build(records,{...c,range:'currentMonth',start:'2025-01-01'},'2026-10-01').satang,8000);
assert.deepEqual(P.parse(P.command(c)),c);
assert.throws(()=>P.validate({...c,customers:[]}));
assert.throws(()=>P.validate({...c,customers:[...c.customers,...c.customers]}));
assert.throws(()=>P.validate({...c,start:'2026-02-30'}));
assert.throws(()=>P.validate({...c,start:'2026-11-01'}));
assert.throws(()=>P.build([record({saleTotal:'bad'})],c,'2026-10-18'));
assert.throws(()=>P.parse('สรุปยอดค้าง {}'));
assert.equal(P.due({...c,cadence:'month'},'2028-02-29'),true);
assert.equal(P.due({...c,cadence:'month'},'2028-02-28'),false);
assert.equal(P.due({...c,start:'2026-01-01',cadence:'month'},'2026-04-30'),true);
assert.equal(P.due({...c,cadence:'day'},'2026-10-15'),true);
assert.equal(P.due(c,'2026-10-15'),false);
assert.match(P.text(report),/ยอดค้างปัจจุบัน/);

let now='2026-10-18T14:00:00Z',http=200,calls=[],uuid=0;
const props={PRINT_REPORT_STORE_CONFIRMED:'true',PRINT_OUTSTANDING_BRIDGE_SECRET:'test-bridge'};
const logs=[['key','payload','retryKey','sent','updatedAt']];
let dataRows=[record()];
const sheet={getDataRange:()=>({getValues:()=>logs.map(r=>r.slice())}),appendRow:r=>logs.push(r.slice()),getLastRow:()=>logs.length,
  getRange:(row,col)=>({setValues:values=>values[0].forEach((v,i)=>logs[row-1][col-1+i]=v)})};
class FakeDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return new Date(now).getTime();}}
const ctx=vm.createContext({console,Date:FakeDate,PrintOutstanding:P,prSettings_:()=>({spreadsheetId:'test',target:'U'+'a'.repeat(32),token:'test'}),prValidateLine_:()=>{},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=v;}})},
  Utilities:{formatDate:(_d,_tz,format)=>format==='HH'?now.slice(11,13)==='14'?'21':'20':now.slice(0,10),getUuid:()=>`00000000-0000-4000-8000-${String(++uuid).padStart(12,'0')}`,
    newBlob:v=>({getBytes:()=>Buffer.from(v)}),base64Encode:b=>Buffer.from(b).toString('base64'),computeHmacSha256Signature:(v,k)=>crypto.createHmac('sha256',k).update(v).digest(),Charset:{UTF_8:'utf8'}},
  SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){}},
  UrlFetchApp:{fetch:(_url,opts)=>{calls.push(opts);return{getResponseCode:()=>http,getAllHeaders:()=>({}),getContentText:()=>''};}},
  LockService:{getScriptLock:()=>({tryLock:()=>true,waitLock(){},releaseLock(){}})},
  ContentService:{createTextOutput:json=>({setMimeType:()=>JSON.parse(json)}),MimeType:{JSON:'json'}}
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../outstanding-service.gs'),'utf8'),ctx);
ctx.orRecords_=()=>dataRows;
const daily={...c,cadence:'day'};
const id=ctx.orSave_(daily);assert.equal(ctx.orSave_(daily),id);
now='2026-10-18T13:00:00Z';ctx.sendOutstandingSchedules();assert.equal(calls.length,0);
now='2026-10-18T14:00:00Z';http=500;assert.throws(()=>ctx.sendOutstandingSchedules());assert.equal(calls.length,1);
const frozen=calls[0];dataRows=[record({saleTotal:999})];http=200;ctx.sendOutstandingSchedules();assert.equal(calls.length,2);
assert.equal(calls[1].payload,frozen.payload);assert.equal(calls[1].headers['X-Line-Retry-Key'],frozen.headers['X-Line-Retry-Key']);
ctx.sendOutstandingSchedules();assert.equal(calls.length,2);
const envelope=(data)=>{const body=JSON.stringify({at:FakeDate.now(),actor:'U'+'a'.repeat(32),id:'event-test',...data});return{body,signature:crypto.createHmac('sha256','test-bridge').update(body).digest('base64')};};
assert.equal(ctx.outstandingBridge_({body:'{}',signature:'bad'}).ok,false);
assert.equal(ctx.outstandingBridge_(envelope({actor:'U'+'b'.repeat(32),action:'list'})).ok,false);
assert.equal(ctx.outstandingBridge_(envelope({at:FakeDate.now()-400000,action:'list'})).ok,false);
assert.equal(ctx.outstandingBridge_(envelope({action:'list'})).schedules.length,1);
assert.equal(ctx.outstandingBridge_(envelope({id:'remove-test',action:'remove',idToRemove:id})).ok,true);
assert.equal(ctx.orSchedules_().length,0);
ctx.orAction_({action:'line',text:P.command(daily)},'line1');assert.equal(ctx.orSchedules_().length,1);
const callsAfterLine=calls.length;props.PRINT_OUTSTANDING_SCHEDULES='[]';ctx.orAction_({action:'line',text:P.command(daily)},'line1');
assert.equal(ctx.orSchedules_().length,0);assert.equal(calls.length,callsAfterLine);

(async()=>{
  const {default:worker,verify}=await import(pathToFileURL(path.join(__dirname,'../outstanding-worker.mjs')));
  const env={LINE_CHANNEL_SECRET:'test-channel',BRIDGE_SECRET:'test-bridge',ADMIN_KEY:'test-admin',OWNER_LINE_USER_ID:'U'+'a'.repeat(32),APPS_SCRIPT_URL:'https://example.com/exec',ALLOWED_ORIGIN:'https://shop.example'};
  let forwarded=[];global.fetch=async(_url,opts)=>{forwarded.push(JSON.parse(opts.body));return Response.json({ok:true});};
  const body=JSON.stringify({events:[{type:'message',message:{type:'text',text:P.command(c)},source:{type:'user',userId:env.OWNER_LINE_USER_ID},timestamp:Date.now(),webhookEventId:'event01'}]});
  const sig=crypto.createHmac('sha256',env.LINE_CHANNEL_SECRET).update(body).digest('base64');
  assert.equal(await verify(body,sig,env.LINE_CHANNEL_SECRET),true);
  assert.equal(await verify(body+' ',sig,env.LINE_CHANNEL_SECRET),false);
  const req=(raw,signature)=>new Request('https://worker.example/line/webhook',{method:'POST',body:raw,headers:{'x-line-signature':signature}});
  assert.equal((await worker.fetch(req(body,sig),env)).status,200);assert.equal(forwarded.length,1);
  assert.equal((await worker.fetch(req(body+' ',sig),env)).status,401);assert.equal(forwarded.length,1);
  const other=body.replace(env.OWNER_LINE_USER_ID,'U'+'b'.repeat(32));const otherSig=crypto.createHmac('sha256',env.LINE_CHANNEL_SECRET).update(other).digest('base64');
  await worker.fetch(req(other,otherSig),env);assert.equal(forwarded.length,1);
  const admin=(origin,key,data)=>new Request('https://worker.example/admin',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await worker.fetch(admin('https://evil.example','test-admin',{action:'list'}),env)).status,403);
  assert.equal((await worker.fetch(admin(env.ALLOWED_ORIGIN,'wrong',{action:'list'}),env)).status,401);
  assert.equal((await worker.fetch(admin(env.ALLOWED_ORIGIN,'test-admin',{action:'remove',id:'schedule1'}),env)).status,200);
  const sent=forwarded.at(-1),decoded=JSON.parse(sent.body);assert.equal(decoded.idToRemove,'schedule1');assert.notEqual(decoded.id,'schedule1');
  assert.equal(crypto.createHmac('sha256',env.BRIDGE_SECRET).update(sent.body).digest('base64'),sent.signature);
  console.log('PASS: customer/date/balance groups, precision, leap months, schedule guard, frozen retries, dedup, bridge auth, LINE signature, owner filter, admin auth and CORS.');
})().catch(e=>{console.error(e);process.exitCode=1;});
