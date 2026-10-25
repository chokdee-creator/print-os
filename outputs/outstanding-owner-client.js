/* Authenticate with the existing Google session, never with credentials in the page. */
function sendOutstandingOwnerAction(action, extra, endpoint, existingPopup) {
  const id=crypto.randomUUID().replace(/-/g,'');
  const request={...extra,action,id};
  if(action==='remove') request.idToRemove=extra.id;
  const url=new URL(endpoint);url.searchParams.set('action','outstandingOwner');url.searchParams.set('request',id);
  const popup=existingPopup||window.open(url.href,'printOutstandingOwner','popup,width=560,height=460');
  if(!popup) return Promise.reject(new Error('กรุณาอนุญาตหน้าต่างป๊อปอัปของเว็บนี้ แล้วกดส่งอีกครั้ง'));
  return new Promise((resolve,reject)=>{
    const trusted=new Set([popup]),submitted=new Set();
    function cleanup(){clearInterval(poll);clearTimeout(timeout);window.removeEventListener('message',receive);}
    function receive(event){
      if(!trusted.has(event.source) || !(event.origin==='https://script.google.com' || /^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(event.origin)) || event.data?.id!==id) return;
      if(event.data.type==='PRINT_OUTSTANDING_READY'){if(!submitted.has(event.source)){submitted.add(event.source);event.source.postMessage({type:'PRINT_OUTSTANDING_REQUEST',request},event.origin);}return;}
      if(event.data.type!=='PRINT_OUTSTANDING_RESULT')return;
      cleanup();
      if(event.data.result?.ok){popup.close();resolve(event.data.result);}
      else reject(new Error(event.data.result?.error || 'ส่ง LINE ไม่สำเร็จ'));
    }
    function contact(target,depth){
      if(depth>3) return;
      try {
        trusted.add(target);target.postMessage({type:'PRINT_OUTSTANDING_HELLO',id},'*');
        for(let n=0;n<Math.min(target.frames.length,5);n++) contact(target.frames[n],depth+1);
      }catch(e){/* Google can replace sandbox frames while loading. */}
    }
    window.addEventListener('message',receive);
    const poll=setInterval(()=>{
      if(popup.closed){cleanup();reject(new Error('ปิดหน้าส่งก่อนเสร็จ กรุณากดส่งอีกครั้ง'));return;}
      contact(popup,0);
    },500);
    const timeout=setTimeout(()=>{cleanup();reject(new Error('ยังเชื่อม Google ไม่สำเร็จ กรุณาเข้าสู่บัญชีเจ้าของในหน้าต่างที่เปิดไว้ แล้วกดส่งอีกครั้ง'));},90000);
  });
}
