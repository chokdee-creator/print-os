const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
  let decoded=false,called=0,options;const expected={type:'image/png'};
  const section={querySelector:()=>({reportValidity(){throw new Error('Incomplete drafts must still copy');}}),ownerDocument:{fonts:{ready:Promise.resolve()},documentElement:{clientWidth:1000,clientHeight:700}},querySelectorAll:()=>[{decode:async()=>{decoded=true;}}],getBoundingClientRect:()=>({width:900,height:1202}),scrollHeight:1200};
  let exportHeight=650,removed=0,styles={};
  const clone={style:{setProperty:(key,value)=>{styles[key]=value;}},querySelectorAll:()=>[{remove:()=>{removed++;}}],getBoundingClientRect:()=>({width:900,height:exportHeight}),get scrollHeight(){return exportHeight;}};
  const ctx=vm.createContext({html2canvas:async(target,opts)=>{assert.equal(target,section);assert.equal(decoded,true);await opts.onclone({},clone);called++;options=opts;return{toBlob:(callback,type)=>{assert.equal(type,'image/png');callback(expected);}};}});
  vm.runInContext(fs.readFileSync('bill-image.js','utf8'),ctx);
  assert.equal(await ctx.BillImage.render(section),expected);assert.equal(options.height,650);assert.equal(options.scale,2);assert.equal(options.allowTaint,false);
  assert.equal(removed,1);assert.equal(styles['min-height'],'0');assert.equal(styles.height,'auto');
  exportHeight=40000;await assert.rejects(()=>ctx.BillImage.render(section),/บิลยาวเกิน/);assert.equal(called,1);
  const brokenQr={...section,querySelectorAll:()=>[{decode:async()=>{throw Error('QR unavailable');}}]};await assert.rejects(()=>ctx.BillImage.render(brokenQr),/QR unavailable/);assert.equal(called,1);
  console.log('PASS: PNG allows incomplete drafts, waits for QR, measures only document content after removing controls and page minimum height, and rejects oversized/broken images.');
})().catch(e=>{console.error(e);process.exitCode=1;});
