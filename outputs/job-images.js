/* Compressed previews use IndexedDB while pending, Drive links after sync. */
var JobImages=(function(){
  let field,input,message,preview,remove,stage=null,processing=Promise.resolve(),failure='',generation=0;
  const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key=id=>(typeof SHEET_TAB_NAME!=='undefined'&&SHEET_TAB_NAME==='Chokdee'?'chokdee:':'printImage:')+id;
  function db(){return new Promise((resolve,reject)=>{const request=indexedDB.open('print-job-images',1);request.onupgradeneeded=()=>request.result.createObjectStore('pending');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('เปิดที่เก็บรูปในเครื่องไม่ได้'));});}
  async function cache(action,id,value){const database=await db();try{return await new Promise((resolve,reject)=>{const tx=database.transaction('pending',action==='get'?'readonly':'readwrite'),store=tx.objectStore('pending'),request=action==='get'?store.get(key(id)):action==='put'?store.put(value,key(id)):store.delete(key(id));tx.oncomplete=()=>resolve(request.result);tx.onerror=tx.onabort=()=>reject(new Error('พื้นที่เก็บรูปในเครื่องไม่พอ กรุณาซิงก์รูปก่อนเพิ่มรายการใหม่'));});}finally{database.close();}}
  function metadata(value){try{const item=typeof value==='string'?JSON.parse(value):value;return item&&typeof item==='object'&&item.name&&item.uploadKey?item:null;}catch{return null;}}
  function compress(file){
    if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined')return JobImageCodec.compress(file);
    return new Promise((resolve,reject)=>{const worker=new Worker(new URL('job-image-codec.js?v=20261022-job-images',location.href));worker.onmessage=event=>{worker.terminate();event.data.ok?resolve(event.data.result):reject(new Error(event.data.error));};worker.onerror=()=>{worker.terminate();JobImageCodec.compress(file).then(resolve,reject);};worker.postMessage(file);});
  }
  function renderStage(item){
    if(!field)return;preview.replaceChildren();remove.hidden=!item;
    message.textContent=item?item.name+' · '+Math.ceil(item.bytes/1024)+' KB'+(item.pending?' · รอซิงก์':''):'แนบรูปงาน 1 รูป · บีบอัดอัตโนมัติไม่เกิน 700 KB · ไม่ใช่ไฟล์ต้นฉบับสำหรับพิมพ์';
    if(item){const button=document.createElement('button');button.type='button';button.className='btn small secondary';button.textContent='ดูรูปที่แนบ';button.onclick=()=>open(item,stage?.blob?null:(typeof editingId!=='undefined'?editingId:null));preview.append(button);}
  }
  function reset(){generation++;stage=null;failure='';processing=Promise.resolve();if(input)input.value='';renderStage(null);}
  function edit(record){reset();renderStage(metadata(record.jobImage));}
  async function attach(record,existing){await processing;if(failure)throw new Error(failure);record.jobImage=metadata(existing?.jobImage);if(stage?.remove){record.jobImage=null;await cache('delete',record.id);}else if(stage?.blob){const item={name:stage.name,type:stage.blob.type,bytes:stage.blob.size,width:stage.width,height:stage.height,uploadKey:crypto.randomUUID(),pending:true,url:''};await cache('put',record.id,{...item,blob:stage.blob});record.jobImage=item;}}
  function dataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('อ่านรูปที่บีบอัดไม่ได้'));reader.readAsDataURL(blob);});}
  async function payload(record){const image=metadata(record.jobImage);if(!image?.pending)return record;const saved=await cache('get',record.id);if(!saved||saved.uploadKey!==image.uploadKey)throw new Error('ไม่พบรูปที่รออัปโหลด กรุณาแนบรูปอีกครั้ง');return {...record,jobImageDataUrl:await dataUrl(saved.blob)};}
  async function confirm(local,remote,record){
    const byId=new Map(remote.map(row=>[String(row.id),row]));
    for(const row of local){const saved=byId.get(String(row.id)),image=metadata(saved?.jobImage);if(image&&(!row.jobImage?.pending||row.jobImage.uploadKey===image.uploadKey)){if(row.jobImage?.pending)await cache('delete',row.id);row.jobImage=image;}}
    const saved=byId.get(String(record.id));if(record.jobImage?.pending&&saved?.jobImage?.uploadKey===record.jobImage.uploadKey&&saved.jobImage.url){record.jobImage=saved.jobImage;await cache('delete',record.id);}
    if(record.jobImage?.pending)throw new Error('รูปยังรอซิงก์ เก็บรูปในเครื่องไว้แล้ว กดซิงก์อีกครั้งได้');
  }
  function merge(remote,local){const pending=new Map(local.filter(row=>row.jobImage?.pending).map(row=>[String(row.id),row.jobImage])),ids=new Set(remote.map(row=>String(row.id)));return remote.map(row=>pending.has(String(row.id))&&pending.get(String(row.id)).uploadKey!==row.jobImage?.uploadKey?{...row,jobImage:pending.get(String(row.id))}:row).concat(local.filter(row=>row.jobImage?.pending&&!ids.has(String(row.id))));}
  function link(record){return metadata(record.jobImage)?'<br><button type="button" class="job-image-link" data-job-image="'+escape(record.id)+'">▧ รูปงาน'+(record.jobImage.pending?' · รอซิงก์':'')+'</button>':'';}
  function previewUrl(item){
    let fileId=String(item.fileId||'');
    if(!fileId){try{const url=new URL(item.url);if(url.protocol!=='https:'||url.hostname!=='drive.google.com')return null;fileId=/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/.exec(url.pathname)?.[1]||'';}catch{return null;}}
    return /^[A-Za-z0-9_-]{10,160}$/.test(fileId)?'https://drive.google.com/file/d/'+fileId+'/preview':null;
  }
  async function open(item,id){
    item=metadata(item);if(!item)return;
    document.querySelector('.job-image-preview')?.close();
    const dialog=document.createElement('dialog');dialog.className='job-image-preview';dialog.setAttribute('aria-label','รูปงาน '+item.name);
    const header=document.createElement('header'),title=document.createElement('strong');title.textContent=item.name;
    const close=document.createElement('button');close.type='button';close.textContent='ปิด';close.setAttribute('aria-label','ปิดรูปงาน');close.className='btn secondary';close.onclick=()=>dialog.close();header.append(title,close);
    const body=document.createElement('div');body.className='job-image-preview-body';const status=document.createElement('p');status.setAttribute('role','status');status.textContent='กำลังโหลดรูปงาน…';body.append(status);dialog.append(header,body);document.body.append(dialog);
    let objectUrl=null,frame=null;
    dialog.onclick=event=>{if(event.target===dialog)dialog.close();};dialog.onclose=()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);if(frame)frame.src='about:blank';dialog.remove();};dialog.showModal();
    try{
      let blob=id?null:stage?.blob;
      if(id){try{const saved=await cache('get',id);blob=saved?.uploadKey===item.uploadKey?saved.blob:null;}catch{ /* Synced images can still use their private Drive preview. */ }}
      if(!dialog.open)return;
      if(blob){const image=document.createElement('img');objectUrl=URL.createObjectURL(blob);image.alt=item.name;image.onload=()=>{status.hidden=true;};image.onerror=()=>{status.hidden=false;status.textContent='โหลดรูปไม่สำเร็จ กรุณาปิดแล้วลองอีกครั้ง';};image.src=objectUrl;body.append(image);}
      else{
        const url=previewUrl(item);if(!url)throw Error('ไม่พบรูปในเครื่อง กรุณารอซิงก์หรือแนบใหม่');
        frame=document.createElement('iframe');frame.className='job-image-frame';frame.title='รูปงาน '+item.name;frame.referrerPolicy='no-referrer';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms');frame.onload=()=>{status.hidden=true;};frame.src=url;body.append(frame);
      }
    }catch(error){if(dialog.open)status.textContent=error.message;}
  }
  function mount(){
    const form=document.getElementById('jobForm');if(!form)return;
    field=document.createElement('div');field.className='field job-image-field';field.innerHTML='<label for="jobImageFile">แนบรูปงาน</label><input type="file" id="jobImageFile" accept="image/*"><div class="job-image-actions"><span role="status" data-job-image-status></span><span data-job-image-preview></span><button type="button" class="btn small secondary" data-job-image-remove hidden>เอารูปออก</button></div>';
    form.querySelector('#jobName').closest('.job-line').after(field);input=field.querySelector('input');message=field.querySelector('[role=status]');preview=field.querySelector('[data-job-image-preview]');remove=field.querySelector('[data-job-image-remove]');
    input.onchange=()=>{const file=input.files[0];if(!file)return;const version=++generation;failure='';remove.hidden=false;message.textContent='กำลังย่อและบีบอัดรูปในเครื่อง…';processing=compress(file).then(result=>{if(version!==generation)return;stage={...result,name:file.name.replace(/\.[^.]+$/,'')+'.webp'};renderStage({...stage,bytes:stage.blob.size,pending:true});message.textContent+=' · จาก '+(file.size/1024/1024).toFixed(1)+' MB';}).catch(error=>{if(version!==generation)return;failure=error.message;message.textContent=error.message;});};
    remove.onclick=()=>{reset();stage={remove:true};message.textContent='จะเอารูปออกเมื่อบันทึกรายการ';};
    document.addEventListener('click',event=>{const button=event.target.closest('[data-job-image]');if(!button)return;const record=records.find(row=>String(row.id)===button.dataset.jobImage);if(record)open(record.jobImage,record.id);});reset();
  }
  if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',mount);
  return {metadata,attach,payload,confirm,merge,link,reset,edit,previewUrl};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=JobImages;
