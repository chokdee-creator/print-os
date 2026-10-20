var PaymentChannelData=(function(){
  const MAX_QR_BYTES=5*1024*1024;
  function normalize(items){
    if(!Array.isArray(items)||items.length>10)throw new Error('บันทึกช่องทางรับชำระได้ไม่เกิน 10 รายการ');
    const result=items.map(item=>{
      if(!item || !['bank','promptpay','other'].includes(item.kind))throw new Error('เลือกประเภทช่องทางรับชำระ');
      const r={kind:item.kind,enabled:item.enabled!==false,qrDataUrl:String(item.qrDataUrl || '')};
      if(r.qrDataUrl){
        const match=r.qrDataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
        if(!match || match[2].length%4 || match[2].length*3/4-(match[2].endsWith('==')?2:match[2].endsWith('=')?1:0)>MAX_QR_BYTES)throw new Error('รูป QR ต้องเป็น PNG, JPG หรือ WebP ขนาดไม่เกิน 5 MB');
      }
      for(const key of ['provider','accountName','number','note']){
        if(typeof item[key]!=='string' || item[key].length>(key==='note'?300:120))throw new Error('ข้อมูลช่องทางรับชำระไม่ถูกต้อง');
        r[key]=item[key].trim();
      }
      if(!r.provider || !r.accountName || !r.number)throw new Error('กรอกชื่อธนาคาร/ช่องทาง ชื่อบัญชี และเลขบัญชี/หมายเลขรับเงินให้ครบ');
      return r;
    });

    return result;
  }
  function text(items){
    const rows=normalize(items).filter(r=>r.enabled);
    if(!rows.length)return '';
    return 'ช่องทางชำระเงินของร้าน\n'+rows.map(r=>(r.kind==='promptpay'?'พร้อมเพย์':r.kind==='bank'?'บัญชีธนาคาร':'ช่องทางรับเงิน')+': '+r.provider+'\nชื่อบัญชี: '+r.accountName+'\n'+(r.kind==='promptpay'?'หมายเลขพร้อมเพย์: ':'เลขบัญชี/หมายเลข: ')+r.number+(r.note?'\nหมายเหตุ: '+r.note:'')).join('\n\n');
  }
  function selectionKey(row,index){return JSON.stringify([index,row.kind,row.provider,row.accountName,row.number]);}
  function select(items,keys){
    const all=normalize(items);
    if(keys===undefined)return all.filter(r=>r.enabled);
    if(!Array.isArray(keys)||keys.length>10||new Set(keys).size!==keys.length||keys.some(key=>typeof key!=='string'))throw new Error('เลือกบัญชีรับเงินไม่ถูกต้อง');
    const available=new Map(all.map((r,i)=>[selectionKey(r,i),r]).filter(entry=>entry[1].enabled));
    if(keys.some(key=>!available.has(key)))throw new Error('ข้อมูลบัญชีรับเงินเปลี่ยนแล้ว กรุณาโหลดและเลือกบัญชีใหม่');
    return keys.map(key=>available.get(key));
  }
  const methods=['เงินสด','โอนธนาคาร','พร้อมเพย์','บัตรเครดิต/เดบิต','อื่นๆ'];
  function readHistory(value){
    try{const list=typeof value==='string'?JSON.parse(value||'[]'):value||[];if(!Array.isArray(list))return [];return list.filter(r=>r && methods.includes(r.method) && Number.isFinite(r.amount) && r.amount>0 && typeof r.date==='string' && Number.isFinite(Date.parse(r.date))).map(r=>({date:r.date,amount:r.amount,method:r.method,note:String(r.note||'').slice(0,300)}));}catch(e){return [];}
  }
  return {normalize,text,methods,readHistory,selectionKey,select,MAX_QR_BYTES};
})();
if(typeof module!=='undefined' && module.exports)module.exports=PaymentChannelData;
