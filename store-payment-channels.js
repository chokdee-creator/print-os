/* Each shop keeps its receiving details separate. Cloud writes require the Google owner. */
var StorePaymentChannels=(function(){
  const store=()=>SHEET_TAB_NAME==='Chokdee'?'chokdee':'printImage';
  const key=()=> 'printPaymentChannels:'+store();
  let channels=[];let refreshPicker=()=>{},refreshAccountPage=()=>{};
  let ready=Promise.resolve(),missingQr=false;
  function cacheMetadata(){try{const raw=localStorage.getItem(key());if(!raw)return {channels:[],modifiedAt:0};const saved=JSON.parse(raw);return Array.isArray(saved)?{channels:saved,modifiedAt:0,legacy:true}:saved;}catch(e){return {channels:[],modifiedAt:0};}}
  function cached(){try{return PaymentChannelData.normalize(cacheMetadata().channels||[]);}catch(e){return [];}}
  async function hydrate(){
    const meta=cacheMetadata();channels=cached();missingQr=(meta.channels||[]).some(r=>r.qrCached&&!r.qrDataUrl);
    try{const saved=typeof PaymentQrCache==='undefined'?null:await PaymentQrCache.read(store());if(saved && !meta.legacy && saved.modifiedAt>=(meta.modifiedAt||0)){channels=PaymentChannelData.normalize(saved.channels);missingQr=false;}}catch(e){/* Load from Google if browser image storage is unavailable. */}
    refreshPicker();refreshAccountPage();
  }
  async function remember(items,selectedKeys){
    const valid=PaymentChannelData.normalize(items),modifiedAt=Date.now();
    try{if(typeof PaymentQrCache!=='undefined')await PaymentQrCache.write(store(),{channels:valid,modifiedAt});}catch(e){/* Google remains the saved source if the browser cache is full. */}
    try{localStorage.setItem(key(),JSON.stringify({channels:valid.map(r=>({...r,qrCached:!!r.qrDataUrl,qrDataUrl:''})),modifiedAt}));}catch(e){/* Image data stays in IndexedDB and Google, never a full localStorage copy. */}
    channels=valid;missingQr=false;
    try{if(Array.isArray(selectedKeys))localStorage.setItem(key()+':useAccounts',JSON.stringify(selectedKeys));else if(selectedKeys===null)localStorage.removeItem(key()+':useAccounts');}catch(e){}
    refreshPicker();refreshAccountPage();
  }
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function text(keys){return PaymentChannelData.text(PaymentChannelData.select(channels,keys));}
  function append(message,keys){const details=text(keys);return message+(details?'\n\n'+details:'');}
  function html(keys){return PaymentChannelData.select(channels,keys).map(r=>'<section style="margin:16px 0;break-inside:avoid"><strong>'+escape(r.kind==='promptpay'?'พร้อมเพย์':r.provider)+'</strong><br>'+escape(r.provider)+'<br>ชื่อบัญชี: '+escape(r.accountName)+'<br>เลขบัญชี/หมายเลข: '+escape(r.number)+(r.note?'<br>'+escape(r.note):'')+(r.qrDataUrl?'<br><img alt="QR ชำระเงิน '+escape(r.provider)+'" src="'+r.qrDataUrl+'" style="width:180px;height:180px;object-fit:contain;background:white">':'')+'</section>').join('');}
  function showQr(root,keys){
    root.replaceChildren();
    PaymentChannelData.select(channels,keys).filter(r=>r.qrDataUrl).forEach((r,i)=>{
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
      dialog.innerHTML='<h2>ช่องทางรับชำระเงินของร้าน</h2><p data-payment-store></p><p>บันทึกแยกตามร้าน เพิ่มได้หลายบัญชี และเลือกบัญชีที่จะแนบก่อนส่งยอดแต่ละครั้ง รูป QR จะแสดงในเอกสารและดาวน์โหลดเพื่อแนบแชทได้</p><button type="button" class="btn secondary" data-load-payment>โหลดข้อมูลที่บันทึกบน Google</button><div data-payment-channel-list></div><button type="button" class="btn secondary" data-add-payment>เพิ่มบัญชีรับเงิน</button><p role="status" data-payment-channel-status></p><button type="button" class="btn" data-save-payment>บันทึกช่องทางและ QR บน Google</button> <button type="button" class="btn secondary" data-close-payment>ปิด</button>';
      const status=s=>dialog.querySelector('[data-payment-channel-status]').textContent=s;
      const list=dialog.querySelector('[data-payment-channel-list]');
      function add(item={kind:'bank',provider:'',accountName:'',number:'',note:'',enabled:true,qrDataUrl:''}){
        if(list.children.length>=10){status('เพิ่มได้ไม่เกิน 10 ช่องทาง');return;}
        const card=document.createElement('fieldset');card.style.cssText='border:1px solid #888;border-radius:10px;padding:14px;margin:16px 0';
        card.innerHTML='<legend>ช่องทางรับเงิน</legend><label>ประเภท<select data-field="kind"><option value="bank">บัญชีธนาคาร</option><option value="promptpay">พร้อมเพย์</option><option value="other">อื่นๆ</option></select></label><label>ชื่อธนาคาร / ช่องทาง<input data-field="provider" maxlength="120" placeholder="เช่น กสิกรไทย หรือพร้อมเพย์"></label><label>ชื่อบัญชี<input data-field="accountName" maxlength="120" autocomplete="off"></label><label>เลขบัญชี / หมายเลขพร้อมเพย์<input data-field="number" maxlength="120" inputmode="text" autocomplete="off"></label><label>หมายเหตุ<input data-field="note" maxlength="300" placeholder="เช่น กรุณาส่งสลิปหลังชำระ"></label><label><input type="checkbox" data-field="enabled"> เปิดใช้งานบัญชีนี้</label><label>รูป QR Code<input type="file" accept="image/png,image/jpeg,image/webp" data-qr-upload></label><p style="font-size:13px">ใช้รูป QR รับเงินของร้าน ขนาดไม่เกิน 5 MB</p><img data-qr-preview alt="ตัวอย่าง QR รับชำระเงิน" style="max-width:180px;max-height:180px;object-fit:contain;background:white" hidden><p><button type="button" class="btn small secondary" data-clear-qr>ลบรูป QR</button> <button type="button" class="btn small danger" data-remove-payment>นำช่องทางนี้ออก</button></p>';
        card.querySelectorAll('label').forEach(el=>{el.style.cssText='display:block;margin:10px 0';});
        const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:0 14px';
        const labels=Array.from(card.querySelectorAll('label'));labels.slice(0,5).forEach(label=>grid.append(label));labels[4].style.gridColumn='1 / -1';card.insertBefore(grid,labels[5]);
        labels[5].style.cssText='display:flex;align-items:center;gap:8px;margin:12px 0';labels[5].querySelector('input').style.cssText='width:18px;height:18px;min-height:18px;flex:0 0 18px;margin:0;padding:0';
        card.querySelectorAll('[data-field]').forEach(el=>{el.type==='checkbox'?el.checked=item[el.dataset.field]!==false:el.value=item[el.dataset.field]||'';});
        card.qrDataUrl=item.qrDataUrl||'';
        const preview=card.querySelector('[data-qr-preview]');function refreshQr(){preview.src=card.qrDataUrl;preview.hidden=!card.qrDataUrl;}
        refreshQr();
        card.querySelector('[data-qr-upload]').addEventListener('change',async event=>{
          const file=event.target.files[0];if(!file)return;
          if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>PaymentChannelData.MAX_QR_BYTES){status('ใช้รูป PNG, JPG หรือ WebP ขนาดไม่เกิน 5 MB');event.target.value='';return;}
          try{card.qrDataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});refreshQr();status('เลือกรูปแล้ว กดบันทึกเพื่อเก็บ QR ของร้าน');}catch(e){status('อ่านรูป QR ไม่สำเร็จ');}
        });
        card.querySelector('[data-clear-qr]').addEventListener('click',()=>{card.qrDataUrl='';card.querySelector('[data-qr-upload]').value='';refreshQr();});
        card.querySelector('[data-remove-payment]').addEventListener('click',()=>card.remove());list.append(card);
      }
      function render(){list.replaceChildren();channels.forEach(add);if(!channels.length)add();}
      dialog.querySelector('[data-add-payment]').addEventListener('click',()=>add());
      dialog.querySelector('[data-load-payment]').addEventListener('click',async()=>{
        try{dialog.querySelector('[data-save-payment]').disabled=true;list.inert=true;dialog.querySelector('[data-add-payment]').disabled=true;status('กำลังโหลดข้อมูลของร้าน…');const result=await sendOutstandingOwnerAction('getPaymentChannels',{store:store()},getSheetUrl());await remember(result.channels,result.selectedKeys);render();status('โหลดข้อมูลของร้านแล้ว '+channels.length+' ช่องทาง');}catch(e){status(e.message);}finally{dialog.querySelector('[data-save-payment]').disabled=false;list.inert=false;dialog.querySelector('[data-add-payment]').disabled=false;}
      });
      dialog.querySelector('[data-save-payment]').addEventListener('click',async()=>{
        const button=dialog.querySelector('[data-save-payment]');
        try{
          const items=Array.from(list.children).map(card=>{const item={qrDataUrl:card.qrDataUrl};card.querySelectorAll('[data-field]').forEach(el=>item[el.dataset.field]=el.type==='checkbox'?el.checked:el.value);return item;});
          const valid=PaymentChannelData.normalize(items);button.disabled=true;status('กำลังบันทึกข้อมูลและรูป QR ของร้าน…');
          const result=await sendOutstandingOwnerAction('savePaymentChannels',{store:store(),channels:valid},getSheetUrl());await remember(result.channels,result.selectedKeys);status('บันทึกบน Google แล้ว '+channels.length+' ช่องทาง พร้อมใช้ในข้อความแจ้งยอดและเอกสาร');
        }catch(e){status(e.message);}finally{button.disabled=false;}
      });
      dialog.querySelector('[data-close-payment]').addEventListener('click',()=>dialog.close());
      dialog.querySelector('[data-payment-store]').textContent=SHEET_TAB_NAME==='Chokdee'?'ร้านโชคดีการพิมพ์':'ร้านปริ้นอิมเมจ';
      document.body.append(dialog);render();
    }
    dialog.showModal();dialog.querySelector('[data-load-payment]').click();
  }

  let choosing=false;
  async function choose(actionLabel='ใช้บัญชีที่เลือก'){
    await ready;await hydrate();
    if(missingQr){const result=await sendOutstandingOwnerAction('getPaymentChannels',{store:store()},getSheetUrl());await remember(result.channels,result.selectedKeys);}
    try{const saved=JSON.parse(localStorage.getItem(key()+':useAccounts')||'null');if(Array.isArray(saved)){PaymentChannelData.select(channels,saved);return Promise.resolve(saved);}}catch(e){/* Re-open selection if accounts changed. */}
    if(choosing)return Promise.reject(new Error('กรุณาเลือกบัญชีในหน้าต่างที่เปิดไว้ก่อน'));
    choosing=true;
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','เลือกบัญชีรับเงินที่จะส่งให้ลูกค้า');dialog.id='paymentAccountPicker';
      dialog.style.cssText='width:calc(100% - 28px);max-width:680px;max-height:90vh;overflow:auto;padding:24px;border-radius:14px';
      dialog.innerHTML='<h2>เลือกบัญชีรับเงินที่จะส่งให้ลูกค้า</h2><p>เลือกได้หนึ่งบัญชีหรือหลายบัญชี ข้อความและ QR จะแสดงเฉพาะบัญชีที่เลือกครั้งนี้</p><div data-payment-pick-list></div><p><button type="button" class="btn secondary" data-pick-load>โหลดบัญชีที่บันทึกบน Google</button> <button type="button" class="btn secondary" data-pick-manage>เพิ่ม / แก้ไขบัญชี</button></p><p role="status" data-pick-status></p><button type="button" class="btn" data-pick-continue>ใช้บัญชีที่เลือก</button> <button type="button" class="btn secondary" data-pick-cancel>ยกเลิก</button>';
      let chosen=new Set(),initialized=false,finished=false;
      try{const saved=JSON.parse(localStorage.getItem(key()+':lastChoice')||'null');if(Array.isArray(saved)){chosen=new Set(saved);initialized=true;}}catch(e){}
      const status=message=>dialog.querySelector('[data-pick-status]').textContent=message;
      function render(){
        const list=dialog.querySelector('[data-payment-pick-list]');list.replaceChildren();
        const available=channels.map((r,i)=>({row:r,key:PaymentChannelData.selectionKey(r,i)})).filter(item=>item.row.enabled);
        if(!initialized && available.length){chosen.add(available[0].key);initialized=true;}
        const valid=new Set(available.map(item=>item.key));chosen=new Set([...chosen].filter(k=>valid.has(k)));
        available.forEach(item=>{
          const label=document.createElement('label');label.style.cssText='display:flex;align-items:flex-start;gap:12px;border:1px solid #888;border-radius:10px;padding:14px;margin:12px 0;cursor:pointer';
          const input=document.createElement('input');input.type='checkbox';input.checked=chosen.has(item.key);input.style.cssText='width:20px;height:20px;min-height:20px;flex:0 0 20px;margin:3px 0;padding:0';
          input.setAttribute('aria-label',item.row.provider+' · '+item.row.accountName+' · '+item.row.number);
          input.addEventListener('change',()=>{input.checked?chosen.add(item.key):chosen.delete(item.key);update();});
          const detail=document.createElement('span');detail.style.cssText='white-space:pre-line;overflow-wrap:anywhere';detail.textContent=item.row.provider+'\n'+item.row.accountName+'\n'+item.row.number+(item.row.qrDataUrl?'\nมี QR Code':'');
          label.append(input,detail);list.append(label);
        });
        if(!available.length)list.textContent='ยังไม่มีบัญชีรับเงินที่เปิดใช้งาน กดโหลดบัญชีจาก Google หรือเพิ่มบัญชีของร้าน';
        update();
      }
      function update(){dialog.querySelector('[data-pick-continue]').textContent=chosen.size?actionLabel+' ('+chosen.size+' บัญชี)':actionLabel+' · ไม่แนบบัญชี';}
      function finish(result){if(finished)return;finished=true;choosing=false;refreshPicker=()=>{};dialog.close();dialog.remove();resolve(result);}
      dialog.querySelector('[data-pick-continue]').addEventListener('click',()=>{
        try{const keys=[...chosen];PaymentChannelData.select(channels,keys);localStorage.setItem(key()+':lastChoice',JSON.stringify(keys));finish(keys);}catch(e){status(e.message);}
      });
      dialog.querySelector('[data-pick-cancel]').addEventListener('click',()=>finish(null));
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
      dialog.querySelector('[data-pick-load]').addEventListener('click',async()=>{
        const button=dialog.querySelector('[data-pick-load]'),proceed=dialog.querySelector('[data-pick-continue]');
        try{button.disabled=true;proceed.disabled=true;status('กำลังโหลดบัญชีของร้าน…');const result=await sendOutstandingOwnerAction('getPaymentChannels',{store:store()},getSheetUrl());await remember(result.channels,result.selectedKeys);status('โหลดแล้ว '+channels.filter(r=>r.enabled).length+' บัญชี เลือกบัญชีที่จะส่งได้เลย');}catch(e){status(e.message);}finally{button.disabled=false;proceed.disabled=false;}
      });
      dialog.querySelector('[data-pick-manage]').addEventListener('click',manage);
      refreshPicker=render;document.body.append(dialog);render();dialog.showModal();
    });
  }


  function mountPage(root){
    let chosen=new Set(),dirty=false;
    function resetChoice(){try{chosen=new Set(JSON.parse(localStorage.getItem(key()+':useAccounts')||localStorage.getItem(key()+':lastChoice')||'[]'));}catch(e){chosen=new Set();}}
    resetChoice();
    root.innerHTML='<div class="account-page-tools"><button class="btn" type="button" data-page-edit>เพิ่ม / แก้ไขข้อมูลบัญชี</button><button class="btn secondary" type="button" data-page-load>โหลดข้อมูลที่บันทึก</button><button class="btn" type="button" data-page-save>บันทึกบัญชีที่เลือก</button></div><p role="status" data-page-status></p><div class="account-cards" data-account-cards></div>';
    const status=message=>root.querySelector('[data-page-status]').textContent=message;
    function render(){
      const list=root.querySelector('[data-account-cards]');list.replaceChildren();
      const valid=new Set(channels.map((r,i)=>r.enabled?PaymentChannelData.selectionKey(r,i):null));chosen=new Set([...chosen].filter(k=>valid.has(k)));
      channels.forEach((r,i)=>{
        const selectionKey=PaymentChannelData.selectionKey(r,i),card=document.createElement('article');card.className='account-card';
        const label=document.createElement('label');label.className='account-check';const check=document.createElement('input');check.type='checkbox';check.checked=chosen.has(selectionKey);check.disabled=!r.enabled;check.setAttribute('aria-label','ใช้บัญชี '+r.provider+' '+r.number);
        const heading=document.createElement('strong');heading.textContent=r.provider;label.append(check,heading);
        check.addEventListener('change',()=>{check.checked?chosen.add(selectionKey):chosen.delete(selectionKey);dirty=true;update();});
        const info=document.createElement('p');info.className='account-details';info.textContent=(r.kind==='promptpay'?'พร้อมเพย์':'บัญชีรับเงิน')+'\nชื่อบัญชี: '+r.accountName+'\nเลขบัญชี / หมายเลข: '+r.number+(r.note?'\n'+r.note:'');card.append(label,info);
        if(r.qrDataUrl){const img=document.createElement('img');img.src=r.qrDataUrl;img.alt='QR รับเงิน '+r.provider;img.className='account-qr';card.append(img);}
        const state=document.createElement('span');state.className='account-state';state.textContent=r.enabled?'ติ๊กเพื่อใช้บัญชีนี้แจ้งยอดลูกค้า':'บัญชีนี้ปิดใช้งาน';card.append(state);list.append(card);
      });
      if(!channels.length){const empty=document.createElement('div');empty.className='account-empty';empty.textContent='ยังไม่มีข้อมูลบัญชีรับเงิน กดเพิ่ม / แก้ไขข้อมูลบัญชีเพื่อเพิ่มธนาคาร พร้อมเพย์ และรูป QR ของร้าน หรือกดโหลดข้อมูลที่บันทึก';list.append(empty);}
      update();
    }
    function update(){root.querySelector('[data-page-save]').textContent='บันทึกบัญชีที่เลือก ('+chosen.size+')';status(dirty?'มีการเปลี่ยนแปลง กดบันทึกบัญชีที่เลือกก่อนกลับไปส่งยอด':'เลือกไว้ '+chosen.size+' บัญชี · ข้อความและใบแจ้งยอดจะใช้บัญชีที่บันทึกเลือกไว้');}
    root.querySelector('[data-page-edit]').addEventListener('click',manage);
    root.querySelector('[data-page-load]').addEventListener('click',async()=>{
      const button=root.querySelector('[data-page-load]');try{button.disabled=true;status('กำลังโหลดข้อมูลบัญชีของร้าน…');const result=await sendOutstandingOwnerAction('getPaymentChannels',{store:store()},getSheetUrl());await remember(result.channels,result.selectedKeys);resetChoice();dirty=false;render();}catch(e){status(e.message);}finally{button.disabled=false;}
    });
    root.querySelector('[data-page-save]').addEventListener('click',async()=>{
      const button=root.querySelector('[data-page-save]');try{const selectedKeys=[...chosen];PaymentChannelData.select(channels,selectedKeys);button.disabled=true;status('กำลังบันทึกบัญชีที่เลือก…');const result=await sendOutstandingOwnerAction('savePaymentChannels',{store:store(),selectionOnly:true,selectedKeys},getSheetUrl());await remember(result.channels,result.selectedKeys);resetChoice();dirty=false;render();status('บันทึกแล้ว '+chosen.size+' บัญชี กลับไปส่งยอดได้เลย');}catch(e){status(e.message);}finally{button.disabled=false;}
    });
    refreshAccountPage=render;render();
  }

  function init(){channels=cached();ready=hydrate();document.querySelectorAll('[data-manage-payment-channels]').forEach(button=>button.addEventListener('click',manage));return ready;}
  return {init,manage,text,append,html,showQr,choose,mountPage};
})();
