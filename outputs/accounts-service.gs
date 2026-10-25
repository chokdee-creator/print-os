/** Private three-notebook storage. Called ONLY after orRequireOwner_ and under ScriptLock. */
function ledgerEmpty_(){return {version:1,revision:'',books:[1,2,3].map(n=>({id:'book-'+n,name:'สมุดบัญชี '+n,entries:[]}))};}
function ledgerRead_(){return orReadDelivery_('accounts:notebooks:v1')||ledgerEmpty_();}
function ledgerValidate_(input){
  if(!input||input.version!==1||!Array.isArray(input.books)||input.books.length!==3)throw new Error('ข้อมูลสมุดบัญชีไม่ถูกต้อง');
  const ids=new Set(),slips=new Set();
  return {version:1,books:input.books.map((b,i)=>{
    if(!b||b.id!=='book-'+(i+1)||typeof b.name!=='string'||!b.name.trim()||b.name.length>50||!Array.isArray(b.entries)||b.entries.length>10000)throw new Error('ข้อมูลสมุดบัญชีไม่ถูกต้อง');
    return {id:b.id,name:b.name.trim(),entries:b.entries.map(e=>{
      if(!e||!/^[a-zA-Z0-9_-]{8,100}$/.test(e.id||'')||ids.has(e.id)||!['income','expense'].includes(e.type)||!/^\d{4}-\d{2}-\d{2}$/.test(e.date||'')||isNaN(Date.parse(e.date))||new Date(e.date).toISOString().slice(0,10)!==e.date||typeof e.name!=='string'||!e.name.trim()||e.name.length>160||typeof e.note!=='string'||e.note.length>500||!Number.isSafeInteger(e.amount)||e.amount<=0||e.amount>99999999999)throw new Error('ข้อมูลรายการไม่ถูกต้อง');ids.add(e.id);
      if(e.recipient!==undefined&&(typeof e.recipient!=='string'||e.recipient.length>160))throw new Error('ชื่อบัญชีผู้รับไม่ถูกต้อง');
      const r={recipient:(e.recipient||'').trim(),id:e.id,name:e.name.trim(),amount:e.amount,type:e.type,date:e.date,note:e.note,createdAt:String(e.createdAt||'').slice(0,40)};
      if(e.slip){const s=e.slip;if(!/^[a-zA-Z0-9_-]{8,100}$/.test(s.id||'')||slips.has(s.id)||typeof s.name!=='string'||s.name.length>250)throw new Error('ข้อมูลสลิปไม่ถูกต้อง');slips.add(s.id);r.slip={id:s.id,name:s.name};}return r;
    })};
  })};
}
function ledgerSlipFolder_(){const p=orProperties_(),id=p.getProperty('PRINT_NOTEBOOK_SLIP_FOLDER');if(id)return DriveApp.getFolderById(id);const f=DriveApp.createFolder('Print OS - Notebook Slips');p.setProperty('PRINT_NOTEBOOK_SLIP_FOLDER',f.getId());return f;}
function ledgerAction_(data){
  const current=ledgerRead_();
  if(data.action==='ledgerGet')return {ok:true,notebooks:current};
  if(data.action==='ledgerSlipGet'){
    const e=current.books.reduce((a,b)=>a.concat(b.entries),[]).find(e=>e.slip&&e.slip.id===data.slipId);if(!e||!e.slip.fileId)throw new Error('ไม่พบสลิปบน Google');
    const blob=DriveApp.getFileById(e.slip.fileId).getBlob();return {ok:true,slip:{id:e.slip.id,name:e.slip.name,size:blob.getBytes().length,type:blob.getContentType(),dataUrl:'data:'+blob.getContentType()+';base64,'+Utilities.base64Encode(blob.getBytes())}};
  }
  if(data.action!=='ledgerSave')throw new Error('คำขอบัญชีไม่ถูกต้อง');
  if(current.lastOperation===data.operationId&&data.operationId)return {ok:true,notebooks:current};
  if(String(data.revision||'')!==String(current.revision||''))return {ok:true,conflict:true,notebooks:current};
  if(!/^[a-zA-Z0-9_-]{20,100}$/.test(data.operationId||''))throw new Error('รหัสบันทึกไม่ถูกต้อง');
  const next=ledgerValidate_(data.notebooks),known=new Map();current.books.forEach(b=>b.entries.forEach(e=>{if(e.slip)known.set(e.slip.id,e.slip);}));
  const supplied=new Map();if(data.uploads!==undefined&&!Array.isArray(data.uploads))throw new Error('ข้อมูลไฟล์สลิปไม่ถูกต้อง');
  (data.uploads||[]).forEach(u=>{if(!u||supplied.has(u.id))throw new Error('ไฟล์สลิปซ้ำ');const m=/^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(u.dataUrl||''));if(!m||m[2].length>960000)throw new Error('ชนิดหรือขนาดรูปสลิปไม่ถูกต้อง');const bytes=Utilities.base64Decode(m[2]);if(!bytes.length||bytes.length>700*1024)throw new Error('สลิปต้องไม่เกิน 700 KB');const isImage=m[1]==='webp'?bytes.length>12&&String.fromCharCode.apply(null,bytes.slice(0,4).map(n=>(n+256)%256))==='RIFF'&&String.fromCharCode.apply(null,bytes.slice(8,12).map(n=>(n+256)%256))==='WEBP':m[1]==='png'?(bytes[0]+256)%256===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:(bytes[0]+256)%256===255&&(bytes[1]+256)%256===216;if(!isImage)throw new Error('ไฟล์ไม่ใช่รูปสลิปที่รองรับ');supplied.set(u.id,{bytes,type:'image/'+m[1],ext:m[1]==='jpeg'?'jpg':m[1]});});
  // Validate every missing attachment before writing any file or notebook.
  next.books.forEach(b=>b.entries.forEach(e=>{if(e.slip&&!known.has(e.slip.id)&&!supplied.has(e.slip.id))throw new Error('กรุณาแนบไฟล์สลิป '+e.slip.name+' อีกครั้ง');}));
  next.books.forEach(b=>b.entries.forEach(e=>{if(!e.slip)return;const old=known.get(e.slip.id);if(old){e.slip={...old,name:e.slip.name};return;}const u=supplied.get(e.slip.id),folder=ledgerSlipFolder_(),name=e.slip.id+'.'+u.ext,files=folder.getFilesByName(name),file=files.hasNext()?files.next():folder.createFile(Utilities.newBlob(u.bytes,u.type,name));e.slip={...e.slip,fileId:file.getId(),type:u.type,size:u.bytes.length,cloud:true};}));
  next.revision=Utilities.getUuid();next.updatedAt=new Date().toISOString();next.lastOperation=data.operationId;orWriteDelivery_('accounts:notebooks:v1',next);return {ok:true,notebooks:next};
}
