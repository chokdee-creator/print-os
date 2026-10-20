/* The site stores display names and opaque recipient keys; LINE addresses stay in Apps Script. */
var LineRecipients=(function(){
  let recipients=[{id:'owner',name:'วินDS (บัญชีเดิมของฉัน)'}];
  const defaultOption=()=>({id:'owner',name:'วินDS (บัญชีเดิมของฉัน)'});
  try {
    const saved=JSON.parse(localStorage.getItem('printLineRecipientNames') || 'null');
    if(Array.isArray(saved)) recipients=[defaultOption(),...saved.filter(r=>r && r.id!=='owner' && typeof r.id==='string' && typeof r.name==='string')];
  }catch(e){/* The verified server list remains authoritative. */}
  function refresh() {
    document.querySelectorAll('[data-line-recipient]').forEach(select=>{
      const previous=select.value || 'owner';select.replaceChildren();
      recipients.forEach(r=>{const option=document.createElement('option');option.value=r.id;option.textContent=r.name;select.append(option);});
      select.value=recipients.some(r=>r.id===previous)?previous:'owner';
    });
  }
  function remember(items) {recipients=items;localStorage.setItem('printLineRecipientNames',JSON.stringify(items));refresh();}
  function selected(id) {
    const key=document.getElementById(id)?.value || 'owner';
    if(!recipients.some(r=>r.id===key)) throw new Error('กรุณาโหลดบัญชี LINE แล้วเลือกผู้รับอีกครั้ง');
    return key;
  }
  async function load() {
    const result=await sendOutstandingOwnerAction('recipients',{},getSheetUrl());
    remember(result.recipients);return result.recipients;
  }
  function manage() {
    let dialog=document.getElementById('lineRecipientDialog');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='lineRecipientDialog';dialog.setAttribute('aria-label','บัญชี LINE ผู้รับยอด');
      dialog.style.cssText='max-width:620px;width:calc(100% - 28px);padding:24px;border-radius:14px';
      dialog.innerHTML='<h2>บัญชี LINE ผู้รับยอด</h2><p>เลือกผู้รับที่ยืนยันแล้วก่อนส่งยอด ไม่มีการส่งให้ผู้รับใหม่จนกว่าจะกดส่งจากหน้ารายงาน</p><p><a href="https://line.me/R/ti/p/%40644iislz" target="_blank" rel="noopener">เพิ่มเพื่อน OA ปริ้นอิมเมจ</a> จากบัญชีที่จะรับยอดก่อน แล้วจับคู่บัญชีนั้นหนึ่งครั้ง</p><button type="button" class="btn secondary" data-load-recipients>โหลดบัญชีที่ยืนยันแล้ว</button><div data-recipient-list></div><details style="margin-top:18px"><summary>เพิ่มผู้รับด้วยรหัส Messaging API ที่ตรวจสอบแล้ว</summary><p>ใช้ User ID ที่ได้จาก Messaging API ของ OA นี้เท่านั้น ไม่ใช่ LINE ID หรือรหัสจาก URL หน้าแชท หากยังไม่มีรหัส ให้เพิ่มเพื่อนแล้วให้ผู้ดูแลจับคู่บัญชีก่อน</p><label>Messaging API User ID<input data-recipient-user-id placeholder="U… (33 ตัว)" autocomplete="off" style="display:block;width:100%;margin:8px 0"></label><button type="button" class="btn" data-add-recipient>ตรวจสอบกับ LINE และเพิ่มบัญชี</button></details><p role="status" data-recipient-status></p><button type="button" class="btn secondary" data-close-recipients>ปิด</button>';
      const status=message=>dialog.querySelector('[data-recipient-status]').textContent=message;
      function list(){
        const root=dialog.querySelector('[data-recipient-list]');root.replaceChildren();
        recipients.forEach(r=>{
          const row=document.createElement('p');row.append(document.createTextNode(r.name+' '));
          if(r.id!=='owner'){
            const button=document.createElement('button');button.type='button';button.className='btn small secondary';button.textContent='นำออกจากตัวเลือก';
            button.addEventListener('click',async()=>{try{button.disabled=true;await sendOutstandingOwnerAction('removeRecipient',{recipientId:r.id},getSheetUrl());remember(recipients.filter(x=>x.id!==r.id));list();status('นำผู้รับออกแล้ว');}catch(e){status(e.message);button.disabled=false;}});row.append(button);
          }root.append(row);
        });
      }
      dialog.querySelector('[data-load-recipients]').addEventListener('click',async()=>{
        try{status('กำลังโหลดบัญชีผู้รับ…');await load();list();status('โหลดบัญชีผู้รับแล้ว เลือกได้จากช่องผู้รับ LINE');}catch(e){status(e.message);}
      });
      dialog.querySelector('[data-add-recipient]').addEventListener('click',async()=>{
        const input=dialog.querySelector('[data-recipient-user-id]'),button=dialog.querySelector('[data-add-recipient]');
        try{
          if(!/^U[0-9a-f]{32}$/.test(input.value.trim()))throw new Error('ระบุ Messaging API User ID ที่ถูกต้องก่อน');
          button.disabled=true;status('กำลังตรวจสอบบัญชีกับ LINE…');
          const result=await sendOutstandingOwnerAction('addRecipient',{userId:input.value.trim()},getSheetUrl());
          const updated=recipients.filter(r=>r.id!==result.recipient.id);updated.push(result.recipient);remember(updated);list();input.value='';status('เพิ่มบัญชี '+result.recipient.name+' แล้ว กรุณาตรวจชื่อก่อนเลือกส่ง');
        }catch(e){status(e.message);}finally{button.disabled=false;}
      });
      dialog.querySelector('[data-close-recipients]').addEventListener('click',()=>dialog.close());
      document.body.append(dialog);list();
    }
    dialog.showModal();
  }
  function init(){refresh();document.querySelectorAll('[data-manage-line-recipients]').forEach(button=>button.addEventListener('click',manage));}
  return {init,selected,manage};
})();
