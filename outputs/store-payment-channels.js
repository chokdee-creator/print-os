/* Each shop keeps its receiving details separate. Cloud writes require the Google owner. */
var StorePaymentChannels=(function(){
  const store=()=>SHEET_TAB_NAME==='Chokdee'?'chokdee':'printImage';
  const key=()=> 'printPaymentChannels:'+store();
  let channels=[];
  function cached(){try{return PaymentChannelData.normalize(JSON.parse(localStorage.getItem(key())||'[]'));}catch(e){return [];}}
  function remember(items){const valid=PaymentChannelData.normalize(items);localStorage.setItem(key(),JSON.stringify(valid));channels=valid;}
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function text(){return PaymentChannelData.text(channels);}
  function append(message){const details=text();return message+(details?'\n\n'+details:'');}
  function html(){return channels.filter(r=>r.enabled).map(r=>'<section style="margin:16px 0;break-inside:avoid"><strong>'+escape(r.kind==='promptpay'?'พร้อมเพย์':r.provider)+'</strong><br>'+escape(r.provider)+'<br>ชื่อบัญชี: '+escape(r.accountName)+'<br>เลขบัญชี/หมายเลข: '+escape(r.number)+(r.note?'<br>'+escape(r.note):'')+(r.qrDataUrl?'<br><img alt="QR ชำระเงิน '+escape(r.provider)+'" src="'+r.qrDataUrl+'" style="width:180px;height:180px;object-fit:contain;background:white">':'')+'</section>').join('');}
  function showQr(root){
    root.replaceChildren();
    channels.filter(r=>r.enabled&&r.qrDataUrl).forEach((r,i)=>{
      const item=document.createElement('div'),img=document.createElement('img'),a=document.createElement('a');
      img.src=r.qrDataUrl;img.alt='QR ชำระเงิน '+r.provider;img.style.cssText='display:block;width:180px;height:180px;object-fit:contain;background:white;margin:10px 0';
      a.href=r.qrDataUrl;a.download='QR-'+store()+'-'+(i+1)+'.'+(r.qrDataUrl.startsWith('data:image/jpeg')?'jpg':r.qrDataUrl.startsWith('data:image/webp')?'webp':'png');a.textContent='ดาวน์โหลด QR '+r.provider+' เพื่อแนบในแชท OA';item.append(img,a);root.append(item);
    });
  }
  function manage(){
    let dialog=document.getElementById('storePaymentChannelsDialog');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='storePaymentChannelsDialog';dialog.setAttribute('aria-label','ช่องทางรับชำระเงินของร้าน');
      dialog.style.cssText='width:calc(100% - 28px);max-width:760px;max-height:90vh;padding:24px;border-radius:14px;overflow:auto';
      dialog.innerHTML='<h2>ช่องทางรับชำระเงินของร้าน</h2><p data-payment-store></p><p>บันทึกแยกตามร้าน แนบข้อมูลที่เปิดใช้งานในข้อความแจ้งยอดและเอกสารพิมพ์ รูป QR จะแสดงในเอกสารและดาวน์โหลดเพื่อแนบแชทได้</p><button type="button" class="btn secondary" data-load-payment>โหลดข้อมูลที่บันทึกบน Google</button><div data-payment-channel-list></div><button type="button" class="btn secondary" data-add-payment>เพิ่มช่องทางรับเงิน</button><p role="status" data-payment-channel-status></p><button type="button" class="btn" data-save-payment>บันทึกช่องทางและ QR บน Google</button> <button type="button" class="btn secondary" data-close-payment>ปิด</button>';
      const status=s=>dialog.querySelector('[data-payment-channel-status]').textContent=s;
      const list=dialog.querySelector('[data-payment-channel-list]');
      function add(item={kind:'bank',provider:'',accountName:'',number:'',note:'',enabled:true,qrDataUrl:''}){
        if(list.children.length>=10){status('เพิ่มได้ไม่เกิน 10 ช่องทาง');return;}
        const card=document.createElement('fieldset');card.style.cssText='border:1px solid #888;border-radius:10px;padding:14px;margin:16px 0';
        card.innerHTML='<legend>ช่องทางรับเงิน</legend><label>ประเภท<select data-field="kind"><option value="bank">บัญชีธนาคาร</option><option value="promptpay">พร้อมเพย์</option><option value="other">อื่นๆ</option></select></label><label>ชื่อธนาคาร / ช่องทาง<input data-field="provider" maxlength="120" placeholder="เช่น กสิกรไทย หรือพร้อมเพย์"></label><label>ชื่อบัญชี<input data-field="accountName" maxlength="120" autocomplete="off"></label><label>เลขบัญชี / หมายเลขพร้อมเพย์<input data-field="number" maxlength="120" inputmode="text" autocomplete="off"></label><label>หมายเหตุ<input data-field="note" maxlength="300" placeholder="เช่น กรุณาส่งสลิปหลังชำระ"></label><label><input type="checkbox" data-field="enabled"> แนบช่องทางนี้ในข้อความและเอกสาร</label><label>รูป QR Code<input type="file" accept="image/png,image/jpeg,image/webp" data-qr-upload></label><p style="font-size:13px">ใช้รูป QR รับเงินของร้าน ขนาดไม่เกิน 700 KB</p><img data-qr-preview alt="ตัวอย่าง QR รับชำระเงิน" style="max-width:180px;max-height:180px;object-fit:contain;background:white" hidden><p><button type="button" class="btn small secondary" data-clear-qr>ลบรูป QR</button> <button type="button" class="btn small danger" data-remove-payment>นำช่องทางนี้ออก</button></p>';
        card.querySelectorAll('label').forEach(el=>{el.style.cssText='display:block;margin:10px 0';});
        card.querySelectorAll('[data-field]').forEach(el=>{el.type==='checkbox'?el.checked=item[el.dataset.field]!==false:el.value=item[el.dataset.field]||'';});
        card.qrDataUrl=item.qrDataUrl||'';
        const preview=card.querySelector('[data-qr-preview]');function refreshQr(){preview.src=card.qrDataUrl;preview.hidden=!card.qrDataUrl;}
        refreshQr();
        card.querySelector('[data-qr-upload]').addEventListener('change',async event=>{
          const file=event.target.files[0];if(!file)return;
          if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>700000){status('ใช้รูป PNG, JPG หรือ WebP ขนาดไม่เกิน 700 KB');event.target.value='';return;}
          try{card.qrDataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});refreshQr();status('เลือกรูปแล้ว กดบันทึกเพื่อเก็บ QR ของร้าน');}catch(e){status('อ่านรูป QR ไม่สำเร็จ');}
        });
        card.querySelector('[data-clear-qr]').addEventListener('click',()=>{card.qrDataUrl='';card.querySelector('[data-qr-upload]').value='';refreshQr();});
        card.querySelector('[data-remove-payment]').addEventListener('click',()=>card.remove());list.append(card);
      }
      function render(){list.replaceChildren();channels.forEach(add);if(!channels.length)add();}
      dialog.querySelector('[data-add-payment]').addEventListener('click',()=>add());
      dialog.querySelector('[data-load-payment]').addEventListener('click',async()=>{
        try{dialog.querySelector('[data-save-payment]').disabled=true;status('กำลังโหลดข้อมูลของร้าน…');const result=await sendOutstandingOwnerAction('getPaymentChannels',{store:store()},getSheetUrl());remember(result.channels);render();status('โหลดข้อมูลของร้านแล้ว '+channels.length+' ช่องทาง');}catch(e){status(e.message);}finally{dialog.querySelector('[data-save-payment]').disabled=false;}
      });
      dialog.querySelector('[data-save-payment]').addEventListener('click',async()=>{
        const button=dialog.querySelector('[data-save-payment]');
        try{
          const items=Array.from(list.children).map(card=>{const item={qrDataUrl:card.qrDataUrl};card.querySelectorAll('[data-field]').forEach(el=>item[el.dataset.field]=el.type==='checkbox'?el.checked:el.value);return item;});
          const valid=PaymentChannelData.normalize(items);button.disabled=true;status('กำลังบันทึกข้อมูลและรูป QR ของร้าน…');
          const result=await sendOutstandingOwnerAction('savePaymentChannels',{store:store(),channels:valid},getSheetUrl());remember(result.channels);status('บันทึกบน Google แล้ว '+channels.length+' ช่องทาง พร้อมใช้ในข้อความแจ้งยอดและเอกสาร');
        }catch(e){status(e.message);}finally{button.disabled=false;}
      });
      dialog.querySelector('[data-close-payment]').addEventListener('click',()=>dialog.close());
      dialog.querySelector('[data-payment-store]').textContent=SHEET_TAB_NAME==='Chokdee'?'ร้านโชคดีการพิมพ์':'ร้านปริ้นอิมเมจ';
      document.body.append(dialog);render();
    }
    dialog.showModal();dialog.querySelector('[data-load-payment]').click();
  }
  function init(){channels=cached();document.querySelectorAll('[data-manage-payment-channels]').forEach(button=>button.addEventListener('click',manage));}
  return {init,manage,text,append,html,showQr};
})();
