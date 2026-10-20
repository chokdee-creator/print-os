const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url'),path=require('node:path');
const P=require('../outstanding-reports.js');
const base={customerType:'ลูกค้าประจำ',customerName:'A',name:'job',date:'2026-10-21',paymentStatus:'ค้างจ่าย',paymentMethod:'เงินสด',paidAmount:0};
const records=[{...base,saleTotal:100.25,paidAmount:30.10},{...base,customerName:'B',date:'2026-10-20',saleTotal:50},{...base,saleTotal:20,paymentStatus:'จ่ายแล้ว',paidAmount:20},{...base,saleTotal:0.30}];
const ctx=vm.createContext({PrintOutstanding:P,prSettings_:()=>({sheetName:'Data Account'})});vm.runInContext(fs.readFileSync('outstanding-service.gs','utf8'),ctx);
ctx.orToday_=()=> '2026-10-21';let reads=0;ctx.orRecords_=store=>{reads++;return store==='chokdee'?[{...base,saleTotal:200,paidAmount:50}]:records;};
assert.ok(ctx.orSimpleLineReport_('สรุปยอด').includes('ยอดวันนี้'));assert.equal(reads,0);
assert.ok(ctx.orSimpleLineReport_('ยอดวันนี้').includes('120.55 บาท'));assert.ok(ctx.orSimpleLineReport_('ยอดวันนี้').includes('จำนวนรายการงาน: 3'));
assert.ok(ctx.orSimpleLineReport_('ยอดค้างชำระ').includes('120.45 บาท'));assert.ok(!ctx.orSimpleLineReport_('ยอดค้างชำระ').includes('20.00 บาท'));
assert.ok(ctx.orSimpleLineReport_('ยอดวันนี้ โชคดี').includes('200.00 บาท'));assert.ok(ctx.orSimpleLineReport_('ยอดค้างชำระ โชคดี').includes('150.00 บาท'));
assert.equal(ctx.orSimpleLineReport_('unknown'),null);
(async()=>{
  const {default:worker}=await import(pathToFileURL(path.resolve('outstanding-worker.mjs')));
  const env={LINE_CHANNEL_SECRET:'test',BRIDGE_SECRET:'test-bridge',ADMIN_KEY:'test-admin',OWNER_LINE_USER_ID:'U'+'a'.repeat(32),APPS_SCRIPT_URL:'https://example.test/exec',ALLOWED_ORIGIN:'https://shop.test'};
  const original=global.fetch,sent=[];global.fetch=async(_url,opts)=>{sent.push(JSON.parse(JSON.parse(opts.body).body));return Response.json({ok:true});};
  try{for(const text of ['สรุปยอด','ยอดวันนี้','ยอดค้างชำระ','ยอดวันนี้ โชคดี']){
    const raw=JSON.stringify({events:[{type:'message',message:{type:'text',text},source:{type:'user',userId:env.OWNER_LINE_USER_ID},timestamp:Date.now(),webhookEventId:'event'+sent.length}]});
    const signature=crypto.createHmac('sha256',env.LINE_CHANNEL_SECRET).update(raw).digest('base64');
    const result=await worker.fetch(new Request('https://worker.test/line/webhook',{method:'POST',body:raw,headers:{'x-line-signature':signature}}),env);assert.equal(result.status,200);assert.equal(sent.at(-1).text,text);
  }}finally{global.fetch=original;}
  assert.equal(sent.length,4);console.log('PASS: daily sales, all current outstanding including older jobs, partial payments, store choice, command help, and signed owner command relay. No live messages sent.');
})().catch(e=>{console.error(e);process.exitCode=1;});
