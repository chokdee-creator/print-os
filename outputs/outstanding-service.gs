/* Add together with outstanding-reports.js as NEW Apps Script files.
 * doPost must route only action=outstandingBridge to outstandingBridge_(data).
 * Existing daily sales reports are independent of this module.
 */
function orProperties_() {return PropertiesService.getScriptProperties();}
function orSchedules_() {return JSON.parse(orProperties_().getProperty('PRINT_OUTSTANDING_SCHEDULES') || '[]');}
function orToday_() {return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');}
function orStore_(store) {
  if(store===undefined || store==='printImage') return {id:'printImage',name:'ร้านปริ้นอิมเมจ',sheet:prSettings_().sheetName};
  if(store==='chokdee') return {id:'chokdee',name:'ร้านโชคดีการพิมพ์',sheet:'Chokdee'};
  throw new Error('ร้านไม่ถูกต้อง');
}
function orRecords_(store) {
  const selectedStore=orStore_(store);
  const values = prRead_(Object.assign({},prSettings_(),{sheetName:selectedStore.sheet}));
  const headers = values[0].map(String);
  const fields = {id:'ID',date:'วันที่', customerType:'ประเภทลูกค้า', customerName:'รายชื่อลูกค้า',
    paymentStatus:'สถานะชำระเงิน', name:'รายชื่องาน', saleTotal:'ราคาขาย', paidAmount:'ลูกค้าชำระ', paymentSlipUrl:'ลิงก์สลิป'};
  const indices = {};
  Object.keys(fields).forEach(k => {
    const i=headers.indexOf(fields[k]);
    if(i<0 || headers.lastIndexOf(fields[k])!==i) throw new Error('Missing/duplicate column: '+fields[k]);
    indices[k]=i;
  });
  return values.slice(1).filter(row=>String(row[indices.name] || '').trim()).map(row=>{
    const r={};Object.keys(indices).forEach(k=>r[k]=row[indices[k]]);
    const methodIndex=headers.indexOf('ช่องทางชำระเงินล่าสุด');r.paymentMethod=methodIndex>=0?row[methodIndex]:'';
    r.date=prDay_(r.date);r.customerType=r.customerType || 'มานา เด็กดื้อ';return r;
  });
}
function orKnown_(config, records) {
  const keys=new Set(records.map(r=>PrintOutstanding.identity({type:r.customerType,name:r.customerName})));
  config.customers.forEach(c=>{if(!keys.has(PrintOutstanding.identity(c))) throw new Error('ไม่พบลูกค้า '+c.name+' ('+c.type+') ในชีต');});
  if(config.recordIds) {
    const ids=new Set(records.map(r=>String(r.id)));
    config.recordIds.forEach(id=>{if(!ids.has(id)) throw new Error('ไม่พบรายการที่เลือกในชีต กรุณาซิงก์ข้อมูลก่อนส่ง');});
  }
}
function orReport_(config,store) {
  const selectedStore=orStore_(store);
  const records=orRecords_(store);orKnown_(config,records);
  const text=PrintOutstanding.text(PrintOutstanding.build(records,config,orToday_())).replace('ร้านปริ้นอิมเมจ',selectedStore.name);
  const payment=PaymentChannelData.text(orPaymentChannels_(selectedStore.id));return text+(payment?'\n\n'+payment:'');
}
function orDeliveryFolder_() {
  const p=orProperties_(), id=p.getProperty('PRINT_OUTSTANDING_LOG_FOLDER');
  if(id) return DriveApp.getFolderById(id);
  const folder=DriveApp.createFolder('PrintImage Outstanding Delivery');
  p.setProperty('PRINT_OUTSTANDING_LOG_FOLDER',folder.getId());return folder;
}
function orReadDelivery_(key) {
  const files=orDeliveryFolder_().getFilesByName(encodeURIComponent(key)+'.json');
  return files.hasNext()?JSON.parse(files.next().getBlob().getDataAsString('UTF-8')):null;
}
function orWriteDelivery_(key,row) {
  const folder=orDeliveryFolder_(), name=encodeURIComponent(key)+'.json',files=folder.getFilesByName(name),json=JSON.stringify(row);
  if(files.hasNext()) files.next().setContent(json);
  else folder.createFile(name,json,MimeType.PLAIN_TEXT);
}
function orSend_(key, text, recipientId) {
  const config=prSettings_();prValidateLine_(config);
  const recipient=orRecipient_(recipientId);
  let row=orReadDelivery_(key);
  if(row && row[3]===true) return;
  if(!row) {
    if(typeof text==='function') text=text();
    const messages=[];let chunk='';
    String(text).split('\n').forEach(line=>{
      if(line.length>4000) throw new Error('บรรทัดรายงานยาวเกินไป กรุณาลดจำนวนลูกค้า');
      if((chunk+'\n'+line).length>4000){messages.push({type:'text',text:chunk});chunk='';}
      chunk+=(chunk?'\n':'')+line;
    });
    if(chunk) messages.push({type:'text',text:chunk});
    if(!messages.length || messages.length>5) throw new Error('รายงานยาวเกินไป กรุณาลดช่วงวันที่หรือจำนวนลูกค้า');
    row=[key,JSON.stringify({to:recipient.target,messages:messages}),Utilities.getUuid(),false,new Date()];
    orWriteDelivery_(key,row);
  }
  const response=UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push',{
    method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+config.token,'X-Line-Retry-Key':row[2]},
    payload:row[1],muteHttpExceptions:true
  });
  const code=response.getResponseCode(), headers=response.getAllHeaders();
  const accepted=code===409 && Object.keys(headers).some(k=>k.toLowerCase()==='x-line-accepted-request-id' && headers[k]);
  if(!(code>=200 && code<300) && !accepted) throw new Error('ส่ง LINE ไม่สำเร็จ (HTTP '+code+')');
  row[3]=true;row[4]=new Date();orWriteDelivery_(key,row);
}
function orSave_(input) {
  const config=PrintOutstanding.validate(input);
  if(config.cadence==='off') throw new Error('เลือกรอบส่งรายวันหรือรายเดือน');
  orKnown_(config,orRecords_());
  const schedules=orSchedules_();
  const existing=schedules.find(s=>JSON.stringify(s.config)===JSON.stringify(config));
  if(existing) return existing.id;
  if(schedules.length>=10) throw new Error('ตั้งได้สูงสุด 10 รอบ กรุณาหยุดรอบที่ไม่ใช้');
  const id=Utilities.getUuid();schedules.push({id:id,config:config});
  const value=JSON.stringify(schedules);
  if(Utilities.newBlob(value).getBytes().length>8000) throw new Error('เงื่อนไขมีขนาดใหญ่เกินไป กรุณาลดจำนวนลูกค้าหรือรอบส่ง');
  orProperties_().setProperty('PRINT_OUTSTANDING_SCHEDULES',value);
  return id;
}
function orAction_(data, requestId) {
  if(data.action==='list') return {ok:true,schedules:orSchedules_()};
  if(data.action==='save') return {ok:true,id:orSave_(data.config)};
  if(data.action==='remove') {
    const schedules=orSchedules_(), remaining=schedules.filter(s=>s.id!==data.idToRemove);
    if(remaining.length===schedules.length) throw new Error('ไม่พบรอบส่ง');
    orProperties_().setProperty('PRINT_OUTSTANDING_SCHEDULES',JSON.stringify(remaining));return {ok:true};
  }
  if(data.action==='previewSend') {
    const store=orStore_(data.store);
    const recipient=orRecipient_(data.recipientId);
    const config=PrintOutstanding.validate(data.config);
    orSend_('request:'+store.id+':'+recipient.id+':'+requestId,()=>orReport_(config,store.id),recipient.id);return {ok:true,recipientName:recipient.name};
  }
  if(data.action==='line') {
    const previous=orReadDelivery_('line:'+requestId);
    if(previous) {orSend_('line:'+requestId,'');return {ok:true};}
    const text=String(data.text||'').trim();let message;
    if(text==='รายการยอดค้าง') {
      const schedules=orSchedules_();
      message=schedules.length?schedules.map(s=>s.id+'\n'+s.config.customers.map(c=>c.name+' ('+c.type+')').join(', ')+'\nส่ง'+(s.config.cadence==='day'?'ทุกวัน':'สิ้นเดือน')+' 21:00').join('\n\n'):'ยังไม่มีรอบส่งยอดค้าง';
    } else if(text.indexOf('หยุดยอดค้าง ')===0) {
      orAction_({action:'remove',idToRemove:text.slice('หยุดยอดค้าง '.length).trim()},requestId);
      message='หยุดรอบส่งยอดค้างที่เลือกแล้ว';
    } else if(text==='สรุปยอดค้าง') {
      message='เลือกลูกค้า วันที่ และรูปแบบที่หน้าเว็บปริ้นอิมเมจ แล้วกด “คัดลอกคำสั่ง LINE” มาวางในแชทนี้\nพิมพ์ “รายการยอดค้าง” เพื่อดูรอบส่ง\nพิมพ์ “หยุดยอดค้าง รหัสรอบส่ง” เพื่อหยุดเฉพาะรอบนั้น';
    } else if(/^สรุปยอดค้าง\s/.test(text)) {
      try {
        const config=PrintOutstanding.parse(text);message=orReport_(config);
        if(config.cadence!=='off') message+='\n\nบันทึกรอบส่งแล้ว รหัส '+orSave_(config)+'\nส่ง'+(config.cadence==='day'?'ทุกวัน':'วันสุดท้ายของเดือน')+' ประมาณ 21:00 เวลาไทย';
      } catch(e) {message=e.message;}
    } else return {ok:true,ignored:true};
    orSend_('line:'+requestId,message);return {ok:true};
  }
  throw new Error('Unknown report action');
}
function outstandingBridge_(envelope) {
  let result;
  try {
    const secret=orProperties_().getProperty('PRINT_OUTSTANDING_BRIDGE_SECRET');
    if(!secret || typeof envelope.body!=='string' || envelope.body.length>20000) throw new Error('Unauthorized');
    const expected=Utilities.base64Encode(Utilities.computeHmacSha256Signature(envelope.body,secret,Utilities.Charset.UTF_8));
    if(typeof envelope.signature!=='string' || envelope.signature.length!==expected.length) throw new Error('Unauthorized');
    let mismatch=0;for(let i=0;i<expected.length;i++) mismatch|=expected.charCodeAt(i)^envelope.signature.charCodeAt(i);
    if(mismatch) throw new Error('Unauthorized');
    const data=JSON.parse(envelope.body);
    if(!Number.isFinite(data.at) || Math.abs(Date.now()-data.at)>300000 || !/^[A-Za-z0-9:_-]{1,150}$/.test(data.id || '')) throw new Error('Expired/invalid request');
    if(data.actor!==prSettings_().target) throw new Error('Unauthorized');
    if(orProperties_().getProperty('PRINT_REPORT_STORE_CONFIRMED')!=='true') throw new Error('Store not confirmed');
    const lock=LockService.getScriptLock();lock.waitLock(30000);
    try {
      const seen=JSON.parse(orProperties_().getProperty('PRINT_OUTSTANDING_REQUESTS') || '[]');
      const previous=seen.find(x=>x.id===data.id);
      if(previous) result=previous.result;
      else {
        result=orAction_(data,data.id);
        seen.push({id:data.id,result:data.action==='list'?{ok:true}:result});
        orProperties_().setProperty('PRINT_OUTSTANDING_REQUESTS',JSON.stringify(seen.slice(-30)));
      }
    } finally {lock.releaseLock();}
  } catch(e) {result={ok:false,error:e.message};}
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
function enableOutstandingReports() {
  if(orProperties_().getProperty('PRINT_REPORT_STORE_CONFIRMED')!=='true') throw new Error('Store not confirmed');
  orRecords_();orDeliveryFolder_();
  if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='sendOutstandingSchedules')) {
    ScriptApp.newTrigger('sendOutstandingSchedules').timeBased().everyMinutes(5).create();
  }
}
function sendOutstandingSchedules() {
  if(Number(Utilities.formatDate(new Date(),'Asia/Bangkok','HH'))<21) return;
  if(orProperties_().getProperty('PRINT_REPORT_STORE_CONFIRMED')!=='true') throw new Error('Store not confirmed');
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000)) return;
  try {
    const today=orToday_(), failures=[];
    orSchedules_().forEach(s=>{
      try {
        if(PrintOutstanding.due(s.config,today)) orSend_('schedule:'+s.id+':'+today,()=>orReport_(s.config));
      }catch(e){failures.push(s.id+': '+e.message);}
    });
    if(failures.length) throw new Error(failures.join('\n'));
  } finally {lock.releaseLock();}
}
