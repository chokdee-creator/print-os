/* All Google operations use the existing owner-verified RPC. No public receipt URLs. */
var AccountsCloud=(function(){
  const endpoint='https://script.google.com/macros/s/AKfycbzDF5-Kvqf03RLCxpToRL7C9PAqlfhUvC_xLgnEExF7H4go7gybvzLaKDwtKVBHl6if/exec',META='printOS:notebooks:google';
  let revision='',ready=false,busy=false;
  function accept(data){revision=data.revision||'';ready=true;try{localStorage.setItem(META,JSON.stringify({revision,updatedAt:data.updatedAt||'',verifiedAt:Date.now()}));}catch(error){}}
  function wasConnected(){try{return !!localStorage.getItem(META);}catch(error){return false;}}
  const request=(action,extra,popup)=>sendOutstandingOwnerAction(action,extra||{},endpoint,popup);
  async function load(){if(busy)throw Error('กำลังเชื่อม Google กรุณารอสักครู่');busy=true;try{return (await request('ledgerGet')).notebooks;}finally{busy=false;}}
  async function save(data){
    if(!ready)throw Error('กรุณากดเชื่อม Google ก่อนบันทึกรายการ');if(busy)throw Error('กำลังบันทึกบน Google กรุณารอสักครู่');
    const url=new URL(endpoint);url.searchParams.set('action','outstandingOwner');const popup=window.open(url.href,'printOutstandingOwner','popup,width=560,height=460');if(!popup)throw Error('กรุณาอนุญาตป๊อปอัปเพื่อบันทึกบน Google');
    busy=true;try{const uploads=[];for(const b of data.books)for(const e of b.entries)if(e.slip&&!e.slip.cloud)uploads.push({id:e.slip.id,dataUrl:await AccountSlips.dataUrl(e.slip.id)});
      const operationId=crypto.randomUUID().replace(/-/g,'');const result=await request('ledgerSave',{revision,operationId,notebooks:data,uploads},popup);
      if(result.conflict)throw Error('มีการแก้ไขจากอีกเครื่อง กรุณาปิดฟอร์มแล้วกดโหลดล่าสุด ข้อมูลที่กรอกยังไม่ถูกบันทึกทับ');accept(result.notebooks);return result.notebooks;
    }catch(error){if(!popup.closed)popup.close();throw error;}finally{busy=false;}
  }
  async function slip(meta){const result=await request('ledgerSlipGet',{slipId:meta.id});const s=result.slip,parts=s.dataUrl.split(','),binary=atob(parts[1]),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);const item={id:s.id,name:s.name,type:s.type,size:s.size,blob:new Blob([bytes],{type:s.type})};try{await AccountSlips.put(item);}catch(error){/* Google still holds the full slip. */}return item;}
  return {load,save,accept,wasConnected,slip,stage:data=>{revision=data.revision||'';ready=true;},disconnect:()=>{ready=false;},isReady:()=>ready};
})();
