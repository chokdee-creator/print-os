/** Owner-only RPC. The existing public web app must never expose LINE credentials. */
function orRequireOwner_() {
  const active=String(Session.getActiveUser().getEmail() || '').toLowerCase();
  const owner=String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if(!active || active!==owner || active!=='chokdeeprintings@gmail.com') {
    throw new Error('กรุณาเข้าสู่ Google ด้วยบัญชีเจ้าของร้าน chokdeeprintings@gmail.com แล้วกดส่งอีกครั้ง');
  }
}
function outstandingOwnerRequest(data) {
  orRequireOwner_();
  if(!data || !/^[a-zA-Z0-9_-]{20,100}$/.test(data.id || '') || !['previewSend','save','list','remove','recipients','addRecipient','removeRecipient','getPaymentChannels','savePaymentChannels','ledgerGet','ledgerSave','ledgerSlipGet','ledgerDeviceEnroll','ledgerLoginStart'].includes(data.action)) throw new Error('คำขอไม่ถูกต้อง');
  if(orProperties_().getProperty('PRINT_REPORT_STORE_CONFIRMED')!=='true') throw new Error('Store not confirmed');
  if(data.action==='ledgerLoginStart')return ledgerLoginSession(data);
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    if(data.action==='previewSend'&&Object.prototype.hasOwnProperty.call(data,'paymentRevision')){
      const entry=orPaymentEntry_();
      if(String(data.paymentRevision||'')!==String(entry.updatedAt||''))return {...orPaymentChannelAction_({action:'getPaymentChannels',store:data.store}),paymentChannelsChanged:true};
    }
    if(data.action==='ledgerDeviceEnroll')return ledgerEnroll_(data);
    if(['ledgerGet','ledgerSave','ledgerSlipGet'].includes(data.action))return ledgerAction_(data);
    if(['getPaymentChannels','savePaymentChannels'].includes(data.action)) return orPaymentChannelAction_(data);
    if(['recipients','addRecipient','removeRecipient'].includes(data.action)) return orRecipientAction_(data);
    return orAction_(data,data.id);
  } finally {lock.releaseLock();}
}
function verifyOutstandingOwnerSetup() {
  const active=Session.getActiveUser().getEmail();
  if(active!=='chokdeeprintings@gmail.com') throw new Error('Wrong Google owner');
  const rows=orRecords_();
  console.log('Owner verified. Report rows: '+rows.length+'. No LINE message sent.');
}
function verifyBothStoreReports() {
  orRequireOwner_();
  ['printImage','chokdee'].forEach(store=>console.log(orStore_(store).name+': '+orRecords_(store).length+' rows. No message sent.'));
}
function outstandingOwnerPage_() {
  try {orRequireOwner_();}
  catch(e) {return ContentService.createTextOutput(e.message);}
  return HtmlService.createHtmlOutput(`<!doctype html><html lang="th"><head><base target="_top"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="font-family:system-ui;padding:24px;background:#071a28;color:#eee"><h2>ยืนยันบัญชีเจ้าของร้าน</h2>
  <p id="status">กำลังเชื่อมกับหน้าเว็บของร้าน… ไม่ต้องกรอกข้อมูลเพิ่ม</p>
  <p>ใช้บัญชี Google เจ้าของร้านที่ลงชื่อเข้าไว้แล้ว เพื่อดำเนินการตามปุ่มที่กดบนเว็บ</p>
  <script>
  let running=false;
  window.addEventListener('message',event=>{
    if(event.origin!=='https://chokdee-creator.github.io' || !event.source || !event.data) return;
    if(event.data.type==='PRINT_OUTSTANDING_HELLO'){event.source.postMessage({type:'PRINT_OUTSTANDING_READY',id:event.data.id},event.origin);return;}
    if(event.data.type!=='PRINT_OUTSTANDING_REQUEST')return;
    const request=event.data.request;
    if(running || !request || !/^[a-zA-Z0-9_-]{20,100}$/.test(request.id || '')) return;
    running=true;document.getElementById('status').textContent='กำลังตรวจบัญชีเจ้าของและดำเนินการ…';
    const respond=result=>event.source.postMessage({type:'PRINT_OUTSTANDING_RESULT',id:request.id,result:result},event.origin);
    google.script.run.withSuccessHandler(result=>{
      document.getElementById('status').textContent=result.ok?'ดำเนินการสำเร็จ กลับหน้ารายงานได้เลย':(result.error || 'ไม่สำเร็จ');
      respond(result);
    }).withFailureHandler(error=>{
      const message=error.message || 'ดำเนินการไม่สำเร็จ';document.getElementById('status').textContent=message;
      respond({ok:false,error:message});
    }).outstandingOwnerRequest(request);
  });
  <\/script></body></html>`).setTitle('ยืนยันบัญชีเจ้าของร้าน');
}
