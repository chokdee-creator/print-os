/* Uses the existing site's records, balance semantics, and toast UI. */
function initOutstandingPanel() {
  const $ = id => document.getElementById('outstanding' + id);
  const chosen = new Set();
  let catalog = [];
  let latest = null;
  let signature = '';
  $('Start').value = today().slice(0,8) + '01';
  $('End').value = today();
  const status = message => { $('Status').textContent = message; };
  function config() {
    return PrintOutstanding.validate({customers: catalog.filter(c => chosen.has(PrintOutstanding.identity(c))),
      start:$('Start').value, end:$('End').value, group:$('Group').value, cadence:$('Cadence').value, range:$('Range').value});
  }
  function invalidate() { latest = null; $('Result').textContent = ''; status('เงื่อนไขเปลี่ยนแล้ว กดแสดงสรุปอีกครั้ง'); }
  function refresh() {
    const next = Array.from(new Map(records.filter(r => r.name).map(r => {
      const c = {type:customerType(r), name:String(customerName(r)).trim() || '-'};
      return [PrintOutstanding.identity(c), c];
    })).values()).sort((a,b) => a.name.localeCompare(b.name,'th') || a.type.localeCompare(b.type,'th'));
    const nextSignature = JSON.stringify(next);
    if (signature === nextSignature) { if(latest) invalidate(); return; }
    signature = nextSignature; catalog = next;
    const valid = new Set(catalog.map(PrintOutstanding.identity));
    [...chosen].forEach(key => {if (!valid.has(key)) chosen.delete(key);});
    showCustomers(); invalidate();
  }
  function showCustomers() {
    const search = $('Search').value.trim().toLocaleLowerCase('th');
    $('Customers').replaceChildren();
    catalog.forEach(c => {
      if (!(c.name + ' ' + c.type).toLocaleLowerCase('th').includes(search)) return;
      const label = document.createElement('label'); label.style.cssText='display:block;padding:6px;cursor:pointer';
      const input = document.createElement('input'); input.type='checkbox'; input.value=PrintOutstanding.identity(c);
      input.checked=chosen.has(input.value);
      input.addEventListener('change', () => { input.checked ? chosen.add(input.value) : chosen.delete(input.value); invalidate(); });
      label.append(input, document.createTextNode(' ' + c.name + ' (' + c.type + ')')); $('Customers').append(label);
    });
    if (!$('Customers').childElementCount) $('Customers').textContent = 'ไม่พบลูกค้า รอโหลดข้อมูลจากชีตหรือเปลี่ยนคำค้น';
  }
  function preview() {
    latest = PrintOutstanding.build(records, config(), today());
    $('Result').textContent = StorePaymentChannels.append(PrintOutstanding.text(latest));
    status('สรุปจากข้อมูลบนเว็บ ณ เวลานี้ ตรวจการซิงก์ชีตก่อนส่งหรือตั้งเวลา');
    return latest;
  }
  function click(id, action) { $(id).addEventListener('click', async () => { try {await action();} catch(e) {status(e.message);} }); }
  click('Preview', preview);
  click('Copy', async () => {const report=preview(),keys=await StorePaymentChannels.choose('คัดลอกข้อความ');if(keys===null)return;await navigator.clipboard.writeText(StorePaymentChannels.append(PrintOutstanding.text(report),keys)); status('คัดลอกข้อความสรุปแล้ว');});
  click('OpenOa', () => copyAndOpenLineOa(PrintOutstanding.text(preview())));
  click('Command', async () => {await navigator.clipboard.writeText(PrintOutstanding.command(config())); status('คัดลอกคำสั่งแล้ว ใช้ได้เมื่อเชื่อมตัวรับคำสั่ง LINE ถาวรสำเร็จ');});
  click('Csv', () => {
    const r = preview();
    const cell = v => '"' + String(v).replace(/^\s*[=+@\-\t\r]/, "'$&").replace(/"/g,'""') + '"';
    const rows = [['ลูกค้า','ประเภทลูกค้า','วันที่งาน/เดือน','จำนวนงาน','ยอดค้างปัจจุบัน (บาท)'],
      ...r.rows.map(x=>[x.name,x.type,x.period,x.count,(x.satang/100).toFixed(2)])];
    const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='ยอดค้าง-'+r.start+'-'+r.end+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  async function request(action, extra={}) {
    status('กำลังดำเนินการผ่านบัญชี Google เจ้าของร้าน…');
    return sendOutstandingOwnerAction(action,extra,getSheetUrl());
  }
  let sending=false;
  click('Send', async () => {
    if(sending)return;
    const c=config();sending=true;$('Send').disabled=true;
    try{const paymentKeys=await StorePaymentChannels.choose('ยืนยันบัญชีและส่งยอด');if(paymentKeys===null)return;const result=await request('previewSend',{config:c,paymentKeys,recipientId:LineRecipients.selected('reportLineRecipient')});status('ส่งยอดค้างเข้า LINE ของ '+result.recipientName+' แล้ว');}
    finally{sending=false;$('Send').disabled=false;}
  });
  click('Save', async () => {
    const c=config();
    if(c.cadence==='off') throw new Error('เลือกรอบส่งรายวันหรือรายเดือน หากต้องการหยุดรอบเดิม ให้กดดูรอบส่งและหยุดรายการนั้น');
    const data=await request('save',{config:c});status('บันทึกรอบส่งแล้ว รหัส '+data.id+' เวลาไทยประมาณ 21:00');
  });
  click('List', async () => {
    const data=await request('list');$('Schedules').replaceChildren();
    data.schedules.forEach(s=>{
      const row=document.createElement('p');
      row.append(document.createTextNode(s.config.customers.map(c=>c.name+' ('+c.type+')').join(', ')+' — ส่ง'+(s.config.cadence==='day'?'ทุกวัน':'สิ้นเดือน')+' — '+s.id+' '));
      const stop=document.createElement('button');stop.type='button';stop.className='btn secondary';stop.textContent='หยุดรอบส่งนี้';
      stop.addEventListener('click',async()=>{try{await request('remove',{id:s.id});row.remove();status('หยุดรอบส่งแล้ว');}catch(e){status(e.message);}});
      row.append(stop);$('Schedules').append(row);
    });
    status(data.schedules.length?'โหลดรอบส่งแล้ว':'ยังไม่มีรอบส่งยอดค้าง');
  });
  ['Start','End','Group','Cadence','Range'].forEach(id=>$(id).addEventListener('change',invalidate));
  $('Search').addEventListener('input',showCustomers);
  refresh();
  return {refresh};
}

async function sendSelectedOutstanding() {
  const button=document.getElementById('sendSelectedOutstanding');
  if(button.disabled)return;
  try {
    const config=selectedOutstandingConfig();
    const selected=new Set(config.recordIds);
    const rows=selectedPaymentRows(records.filter(r=>selected.has(String(r.id))));
    SelectedPayment.documents(rows);
    button.disabled=true;button.textContent='กำลังสร้างบิล…';
    const paymentKeys=await StorePaymentChannels.choose('ใช้บัญชีที่เลือกในบิล');if(paymentKeys===null)return;
    const store=SHEET_TAB_NAME==='Chokdee'?'chokdee':'printImage';
    const html=SelectedPayment.html(rows,new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'long'}).format(new Date()),store==='chokdee'?'ร้านโชคดีการพิมพ์':'ร้านปริ้นอิมเมจ',StorePaymentChannels.html(paymentKeys),{kind:'invoice'});
    showSelectedPaymentDocument(html,()=>sendOutstandingOwnerAction('previewSend',{config,paymentKeys,store,recipientId:LineRecipients.selected('selectedLineRecipient')},getSheetUrl()));
  }catch(e){toast(e.message);}
  finally{button.disabled=false;button.textContent='ส่งยอดชำระ';}
}

function selectedOutstandingConfig() {
    const chosen=records.filter(r=>selectedIds.has(r.id) && balanceAmount(r)>0);
    if(!chosen.length) throw new Error('รายการที่เลือกไม่มียอดค้างชำระ');
    const customers=Array.from(new Map(chosen.map(r=>{
      const c={type:customerType(r),name:String(customerName(r)).trim() || '-'};
      return [PrintOutstanding.identity(c),c];
    })).values());
    const dates=chosen.map(r=>r.date).sort();
    return PrintOutstanding.validate({customers,start:dates[0],end:dates.at(-1),group:'day',cadence:'off',range:'fixed',recordIds:chosen.map(r=>String(r.id))});
}

/** Prepare a manual OA chat message. This never calls the send API. */
async function copyAndOpenLineOa(text) {
  const storeName=SHEET_TAB_NAME==='Chokdee'?'ร้านโชคดีการพิมพ์':'ร้านปริ้นอิมเมจ';
  const paymentKeys=await StorePaymentChannels.choose('คัดลอกยอดและเปิด LINE OA');if(paymentKeys===null)return;
  text=StorePaymentChannels.append(text.replace('สรุปยอดค้าง ร้านปริ้นอิมเมจ','สรุปยอดค้าง '+storeName),paymentKeys);
  let dialog=document.getElementById('lineOaChatDialog');
  if(!dialog){
    dialog=document.createElement('dialog');dialog.id='lineOaChatDialog';dialog.setAttribute('aria-label','คัดลอกยอดและเปิด LINE OA');
    dialog.style.cssText='width:calc(100% - 28px);max-width:700px;max-height:90vh;overflow:auto;padding:24px;border-radius:14px';
    dialog.innerHTML='<h2>ส่งยอดผ่านแชท LINE OA</h2><p role="status" data-oa-copy-status></p><p>เลือกแชทลูกค้าใน OA ปริ้นอิมเมจ แล้ววางข้อความด้วย Ctrl+V และกดส่ง ข้อความยังไม่ถูกส่งจนกว่าคุณจะกดส่งในแชท</p><div data-oa-payment-qr></div><textarea readonly aria-label="ข้อความยอดสำหรับส่งใน LINE OA" style="width:100%;height:240px;padding:12px;box-sizing:border-box"></textarea><p><a class="btn" href="https://chat.line.biz/" target="_blank" rel="noopener">เปิดแชท LINE OA</a> <button type="button" class="btn secondary" data-copy-oa-again>คัดลอกข้อความอีกครั้ง</button> <button type="button" class="btn secondary" data-close-oa>ปิด</button></p>';
    dialog.querySelector('[data-close-oa]').addEventListener('click',()=>dialog.close());
    dialog.querySelector('[data-copy-oa-again]').addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(dialog.querySelector('textarea').value);dialog.querySelector('[data-oa-copy-status]').textContent='คัดลอกยอดแล้ว เปิดแชท OA แล้ววางข้อความได้เลย';}
      catch(e){dialog.querySelector('textarea').select();dialog.querySelector('[data-oa-copy-status]').textContent='เลือกข้อความให้แล้ว กด Ctrl+C เพื่อคัดลอก แล้วเปิดแชท OA';}
    });
    document.body.append(dialog);
  }
  dialog.querySelector('textarea').value=text;
  StorePaymentChannels.showQr(dialog.querySelector('[data-oa-payment-qr]'),paymentKeys);
  if(!dialog.open)dialog.showModal();
  // Finish copying before another tab can take focus.
  try{await navigator.clipboard.writeText(text);window.open('https://chat.line.biz/','_blank','noopener');dialog.querySelector('[data-oa-copy-status]').textContent='คัดลอกยอดแล้ว เลือกแชทลูกค้าแล้ววางข้อความได้เลย หากแชทไม่เปิด ให้กดเปิดแชท LINE OA ด้านล่าง';}
  catch(e){dialog.querySelector('[data-oa-copy-status]').textContent='เบราว์เซอร์ยังไม่อนุญาตให้คัดลอก กดคัดลอกข้อความอีกครั้ง หรือเลือกข้อความแล้วกด Ctrl+C';}
}
function copySelectedAndOpenLineOa(){
  try{const config=selectedOutstandingConfig();return copyAndOpenLineOa(PrintOutstanding.text(PrintOutstanding.build(records,config,today())));}
  catch(e){toast(e.message);}
}
