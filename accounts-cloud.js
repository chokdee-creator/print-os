/* Device credentials stay in this browser. Only SHA-256 digests are stored by Google. */
var AccountsCloud=(function(){
  const endpoint='https://script.google.com/macros/s/AKfycbzDF5-Kvqf03RLCxpToRL7C9PAqlfhUvC_xLgnEExF7H4go7gybvzLaKDwtKVBHl6if/exec',META='printOS:notebooks:google',DEVICE='printOS:notebooks:device:v1';
  let revision='',ready=false,busy=false,googleSession=null,probePromise=null;
  const LOGIN='printOS:notebooks:login:v1';
  try{const stored=JSON.parse(sessionStorage.getItem(LOGIN)||'null');if(stored&&stored.expiresAt>Date.now()+10000)googleSession=stored;}catch(error){}
  function login(){return googleSession&&googleSession.expiresAt>Date.now()+10000?googleSession:null;}
  function clearLogin(){googleSession=null;probePromise=null;try{sessionStorage.removeItem(LOGIN);}catch(error){}}
  function keepLogin(token,result){googleSession={token,expiresAt:result.expiresAt,label:result.label};try{sessionStorage.setItem(LOGIN,JSON.stringify(googleSession));}catch(error){}if(typeof window!=='undefined'&&window.dispatchEvent)window.dispatchEvent(new CustomEvent('accounts-auth-mode'));}
  function device(){try{const d=JSON.parse(localStorage.getItem(DEVICE)||'null');return d&&/^[a-f0-9]{64}$/.test(d.token||'')?d:null;}catch(error){return null;}}
  function forget(){try{localStorage.removeItem(DEVICE);}catch(error){}ready=false;}
  function newToken(){const bytes=crypto.getRandomValues(new Uint8Array(32));return Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');}
  function checkStorage(){try{localStorage.setItem(DEVICE+':check','1');localStorage.removeItem(DEVICE+':check');}catch(error){throw Error('กรุณาอนุญาตการเก็บข้อมูลของเว็บ เพื่อจำอุปกรณ์นี้');}}
  function keep(token,result){localStorage.setItem(DEVICE,JSON.stringify({token,id:result.device.id,label:result.device.label}));}
  function accept(data){revision=data.revision||'';ready=true;try{localStorage.setItem(META,JSON.stringify({revision,updatedAt:data.updatedAt||'',verifiedAt:Date.now()}));}catch(error){}}
  function wasConnected(){try{return !!localStorage.getItem(META);}catch(error){return false;}}
  async function request(command,extra={},anonymous=false){
    const d=device(),g=login();if(!anonymous&&!d&&!g){const error=Error('จับคู่อุปกรณ์ครั้งเดียวเพื่อเริ่มใช้งาน');error.needsPair=true;throw error;}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);let result;
    try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},credentials:'omit',redirect:'follow',body:JSON.stringify({...extra,action:'ledgerDevice',command,deviceToken:anonymous?extra.deviceToken:d?.token,loginToken:anonymous?undefined:g?.token}),signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);result=await response.json();}catch(error){throw Error(error.name==='AbortError'?'เชื่อมต่อใช้เวลานาน กรุณาลองอีกครั้ง':'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง');}finally{clearTimeout(timer);}
    if(!result.ok){if(result.loginExpired){clearLogin();if(d)return request(command,extra,anonymous);const expired=Error('เซสชัน Google หมดอายุ กรุณาเข้าสู่ระบบหรือใช้การจับคู่');expired.needsPair=true;throw expired;}if(result.needsPair)forget();const error=Error(result.error||'ดำเนินการไม่สำเร็จ');error.needsPair=!!result.needsPair;throw error;}return result;
  }
  async function load(){if(!login()){if(device())probeLogin().catch(()=>{});else await probeLogin();}if(busy)throw Error('กำลังโหลดข้อมูล กรุณารอสักครู่');busy=true;try{return (await request('ledgerGet')).notebooks;}finally{busy=false;}}
  async function save(data){
    if(!ready)throw Error('กรุณาจับคู่อุปกรณ์และรอโหลดบัญชีก่อนบันทึก');if(busy)throw Error('กำลังบันทึกบน Google กรุณารอสักครู่');busy=true;
    try{const uploads=[];for(const b of data.books)for(const e of b.entries)if(e.slip&&!e.slip.cloud)uploads.push({id:e.slip.id,dataUrl:await AccountSlips.dataUrl(e.slip.id)});const operationId=crypto.randomUUID().replace(/-/g,'');const result=await request('ledgerSave',{revision,operationId,notebooks:data,uploads});if(result.conflict)throw Error('มีการแก้ไขจากอีกเครื่อง กรุณาปิดฟอร์มแล้วกดโหลดล่าสุด ข้อมูลที่กรอกยังไม่ถูกบันทึกทับ');accept(result.notebooks);return result.notebooks;}finally{busy=false;}
  }
  async function slip(meta){const result=await request('ledgerSlipGet',{slipId:meta.id}),s=result.slip,parts=s.dataUrl.split(','),binary=atob(parts[1]),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);const item={id:s.id,name:s.name,type:s.type,size:s.size,blob:new Blob([bytes],{type:s.type})};try{await AccountSlips.put(item);}catch(error){}return item;}
  async function pair(code,label){checkStorage();const token=newToken(),result=await request('pairRedeem',{code,label,deviceToken:token},true);keep(token,result);return result;}
  async function enrollOwner(label){checkStorage();const token=newToken(),result=await sendOutstandingOwnerAction('ledgerDeviceEnroll',{label,deviceToken:token},endpoint);keep(token,result);return result;}

  function probeLogin(){
    if(login())return Promise.resolve(true);if(probePromise)return probePromise;if(typeof document==='undefined')return Promise.resolve(false);
    probePromise=new Promise(resolve=>{const frame=document.createElement('iframe'),id=crypto.randomUUID().replace(/-/g,''),token=newToken(),trusted=new Set(),submitted=new Set();frame.hidden=true;frame.title='ตรวจการเข้าสู่ระบบ Google';frame.referrerPolicy='no-referrer';const url=new URL(endpoint);url.searchParams.set('action','ledgerLoginProbe');frame.src=url.href;
      let poll,timer;const finish=ok=>{clearInterval(poll);clearTimeout(timer);window.removeEventListener('message',receive);frame.remove();resolve(ok);};
      function receive(event){if(!trusted.has(event.source)||!(event.origin==='https://script.google.com'||/^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(event.origin))||event.data?.id!==id)return;if(event.data.type==='PRINT_NOTEBOOK_LOGIN_READY'){if(!submitted.has(event.source)){submitted.add(event.source);event.source.postMessage({type:'PRINT_NOTEBOOK_LOGIN_PROBE',id,loginToken:token},event.origin);}return;}if(event.data.type!=='PRINT_NOTEBOOK_LOGIN_RESULT')return;if(event.data.result?.ok&&event.data.result.expiresAt>Date.now()){keepLogin(token,event.data.result);finish(true);}else finish(false);}
      function contact(target,depth){if(!target||depth>3)return;try{trusted.add(target);target.postMessage({type:'PRINT_NOTEBOOK_LOGIN_HELLO',id},'*');for(let i=0;i<Math.min(target.frames.length,5);i++)contact(target.frames[i],depth+1);}catch(error){}}
      window.addEventListener('message',receive);poll=setInterval(()=>contact(frame.contentWindow,0),400);timer=setTimeout(()=>finish(false),7000);document.body.append(frame);
    });return probePromise;
  }
  async function loginGoogle(){const token=newToken(),result=await sendOutstandingOwnerAction('ledgerLoginStart',{loginToken:token},endpoint);keepLogin(token,result);return result;}

  async function knowledgeRequest(command,extra){if(!login()){if(device())probeLogin().catch(()=>{});else await probeLogin();}return request(command,extra);}
  return {knowledgeGet:profile=>knowledgeRequest('knowledgeGet',{profile}),knowledgePatch:(profile,changes,operationId)=>knowledgeRequest('knowledgePatch',{profile,changes,operationId}),load,save,accept,wasConnected,slip,pair,enrollOwner,loginGoogle,mode:()=>login()?'login':device()?'device':'none',loginLabel:()=>login()?.label||'',hasDevice:()=>!!device(),label:()=>device()?.label||'',listDevices:()=>request('deviceList'),createPairCode:()=>request('pairCreate'),revokeDevice:id=>request('deviceRevoke',{deviceId:id}),forget,stage:data=>{revision=data.revision||'';ready=true;},disconnect:()=>{ready=false;},isReady:()=>ready};
})();
