const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
  let decoded=false,called=0,options;const expected={type:'image/png'};
  const section={ownerDocument:{fonts:{ready:Promise.resolve()},documentElement:{clientWidth:1000,clientHeight:700}},querySelectorAll:()=>[{decode:async()=>{decoded=true;}}],getBoundingClientRect:()=>({width:900,height:1202}),scrollHeight:1200};
  const ctx=vm.createContext({html2canvas:async(target,opts)=>{assert.equal(target,section);assert.equal(decoded,true);called++;options=opts;return{toBlob:(callback,type)=>{assert.equal(type,'image/png');callback(expected);}};}});
  vm.runInContext(fs.readFileSync('bill-image.js','utf8'),ctx);
  assert.equal(await ctx.BillImage.render(section),expected);assert.equal(options.height,1202);assert.equal(options.scale,2);assert.equal(options.allowTaint,false);
  const long={...section,getBoundingClientRect:()=>({width:900,height:40000}),scrollHeight:40000};await assert.rejects(()=>ctx.BillImage.render(long),/บิลยาวเกิน/);assert.equal(called,1);
  const brokenQr={...section,querySelectorAll:()=>[{decode:async()=>{throw Error('QR unavailable');}}]};await assert.rejects(()=>ctx.BillImage.render(brokenQr),/QR unavailable/);assert.equal(called,1);
  console.log('PASS: PNG captures only chosen bill, waits for QR, includes full bill height, and rejects oversized/broken images without silent truncation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
