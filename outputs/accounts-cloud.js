/* Device credentials stay in this browser. Only SHA-256 digests are stored by Google. */
var AccountsCloud=(function(){
  const endpoint='https://script.google.com/macros/s/AKfycbzDF5-Kvqf03RLCxpToRL7C9PAqlfhUvC_xLgnEExF7H4go7gybvzLaKDwtKVBHl6if/exec',META='printOS:notebooks:google',DEVICE='printOS:notebooks:device:v1';
  let revision='',ready=false,busy=false;
  function device(){try{const d=JSON.parse(localStorage.getItem(DEVICE)||'null');return d&&/^[a-f0-9]{64}$/.test(d.token||'')?d:null;}catch(error){return null;}}
  function forget(){try{localStorage.removeItem(DEVICE);}catch(error){}ready=false;}
  function newToken(){const bytes=crypto.getRandomValues(new Uint8Array(32));return Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');}
  function checkStorage(){try{localStorage.setItem(DEVICE+':check','1');localStorage.removeItem(DEVICE+':check');}catch(error){throw Error('กรุณาอนุญาตการเก็บข้อมูลของเว็บ เพื่อจำอุปกรณ์นี้');}}
  function keep(token,result){localStorage.setItem(DEVICE,JSON.stringify({token,id:result.device.id,label:result.device.label}));}
  function accept(data){revision=data.revision||'';ready=true;try{localStorage.setItem(META,JSON.stringify({revision,updatedAt:data.updatedAt||'',verifiedAt:Date.now()}));}catch(error){}}
  function wasConnected(){try{return !!localStorage.getItem(META);}catch(error){return false;}}
  async function request(command,extra={},anonymous=false){
    const d=device();if(!anonymous&&!d){const error=Error('จับคู่อุปกรณ์ครั้งเดียวเพื่อเริ่มใช้งาน');error.needsPair=true;throw error;}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);let result;
    try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},credentials:'omit',redirect:'follow',body:JSON.stringify({...extra,action:'ledgerDevice',command,deviceToken:anonymous?extra.deviceToken:d.token}),signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);result=await response.json();}catch(error){throw Error(error.name==='AbortError'?'เชื่อมต่อใช้เวลานาน กรุณาลองอีกครั้ง':'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง');}finally{clearTimeout(timer);}
    if(!result.ok){if(result.needsPair)forget();const error=Error(result.error||'ดำเนินการไม่สำเร็จ');error.needsPair=!!result.needsPair;throw error;}return result;
  }
  async function load(){if(busy)throw Error('กำลังโหลดข้อมูล กรุณารอสักครู่');busy=true;try{return (await request('ledgerGet')).notebooks;}finally{busy=false;}}
  async function save(data){
    if(!ready)throw Error('กรุณาจับคู่อุปกรณ์และรอโหลดบัญชีก่อนบันทึก');if(busy)throw Error('กำลังบันทึกบน Google กรุณารอสักครู่');busy=true;
    try{const uploads=[];for(const b of data.books)for(const e of b.entries)if(e.slip&&!e.slip.cloud)uploads.push({id:e.slip.id,dataUrl:await AccountSlips.dataUrl(e.slip.id)});const operationId=crypto.randomUUID().replace(/-/g,'');const result=await request('ledgerSave',{revision,operationId,notebooks:data,uploads});if(result.conflict)throw Error('มีการแก้ไขจากอีกเครื่อง กรุณาปิดฟอร์มแล้วกดโหลดล่าสุด ข้อมูลที่กรอกยังไม่ถูกบันทึกทับ');accept(result.notebooks);return result.notebooks;}finally{busy=false;}
  }
  async function slip(meta){const result=await request('ledgerSlipGet',{slipId:meta.id}),s=result.slip,parts=s.dataUrl.split(','),binary=atob(parts[1]),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);const item={id:s.id,name:s.name,type:s.type,size:s.size,blob:new Blob([bytes],{type:s.type})};try{await AccountSlips.put(item);}catch(error){}return item;}
  async function pair(code,label){checkStorage();const token=newToken(),result=await request('pairRedeem',{code,label,deviceToken:token},true);keep(token,result);return result;}
  async function enrollOwner(label){checkStorage();const token=newToken(),result=await sendOutstandingOwnerAction('ledgerDeviceEnroll',{label,deviceToken:token},endpoint);keep(token,result);return result;}
  return {load,save,accept,wasConnected,slip,pair,enrollOwner,hasDevice:()=>!!device(),label:()=>device()?.label||'',listDevices:()=>request('deviceList'),createPairCode:()=>request('pairCreate'),revokeDevice:id=>request('deviceRevoke',{deviceId:id}),forget,stage:data=>{revision=data.revision||'';ready=true;},disconnect:()=>{ready=false;},isReady:()=>ready};
})();
