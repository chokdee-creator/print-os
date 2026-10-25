/** A Google-verified web login is short-lived and never enrolls a permanent device. */
function ledgerLoginSession(data){
  orRequireOwner_();if(!data||!/^[a-f0-9]{64}$/.test(data.loginToken||''))throw new Error('คำขอล็อกอินไม่ถูกต้อง');
  const lock=LockService.getScriptLock();lock.waitLock(30000);try{const p=orProperties_(),all=p.getProperties();Object.keys(all).filter(k=>k.indexOf('PRINT_NOTEBOOK_LOGIN_')===0).forEach(k=>{try{if(JSON.parse(all[k]).expiresAt<=Date.now())p.deleteProperty(k);}catch(e){p.deleteProperty(k);}});
    const id=ledgerHash_(data.loginToken),expiresAt=Date.now()+30*60*1000;p.setProperty('PRINT_NOTEBOOK_LOGIN_'+id,JSON.stringify({id,label:'Google · chokdeeprintings@gmail.com',type:'login',expiresAt}));return {ok:true,expiresAt,label:'chokdeeprintings@gmail.com'};
  }finally{lock.releaseLock();}
}
function ledgerLoginAuth_(token){if(!/^[a-f0-9]{64}$/.test(token||''))throw new Error('LOGIN_EXPIRED');const raw=orProperties_().getProperty('PRINT_NOTEBOOK_LOGIN_'+ledgerHash_(token));if(!raw)throw new Error('LOGIN_EXPIRED');const record=JSON.parse(raw);if(record.expiresAt<=Date.now())throw new Error('LOGIN_EXPIRED');return record;}
function ledgerLoginProbePage_(){
  // This new page has no interactive or privileged UI. Messages are accepted only from our site.
  return HtmlService.createHtmlOutput(`<!doctype html><html><head><meta name="referrer" content="no-referrer"></head><body><script>
  let started=false;window.addEventListener('message',event=>{
    if(event.origin!=='https://chokdee-creator.github.io'||!event.source||!/^[a-zA-Z0-9_-]{20,100}$/.test(event.data?.id||''))return;
    if(event.data.type==='PRINT_NOTEBOOK_LOGIN_HELLO'){event.source.postMessage({type:'PRINT_NOTEBOOK_LOGIN_READY',id:event.data.id},event.origin);return;}
    if(started||event.data.type!=='PRINT_NOTEBOOK_LOGIN_PROBE'||!/^[a-f0-9]{64}$/.test(event.data.loginToken||''))return;started=true;
    const respond=result=>event.source.postMessage({type:'PRINT_NOTEBOOK_LOGIN_RESULT',id:event.data.id,result},event.origin);
    google.script.run.withSuccessHandler(respond).withFailureHandler(()=>respond({ok:false})).ledgerLoginSession({loginToken:event.data.loginToken});
  });<\/script></body></html>`).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
