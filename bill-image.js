/* Render locally; no bill or QR data is uploaded to an image service. */
var BillImage=(function(){
  function markEmptyFields(bill){
    bill.querySelectorAll('.company label,.document-title label,.customer-grid label').forEach(label=>{
      const fields=Array.from(label.querySelectorAll('input,textarea'));
      label.toggleAttribute('data-bill-empty',fields.length>0&&fields.every(field=>!String(field.value||'').trim()));
    });
    bill.querySelectorAll('.customer-grid').forEach(grid=>{
      const fields=Array.from(grid.querySelectorAll('input,textarea'));
      grid.closest('.panel').toggleAttribute('data-bill-empty',fields.every(field=>!String(field.value||'').trim()));
    });
  }
  async function render(section){
    if(typeof html2canvas!=='function')throw new Error('โหลดระบบสร้างรูปไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ');
    const doc=section.ownerDocument;
    if(doc.fonts)await doc.fonts.ready;
    await Promise.all(Array.from(section.querySelectorAll('img')).map(img=>img.decode()));
    // Measure the export clone after editing controls are removed. Measuring the
    // live form includes their height and leaves that space below the PNG.
    const options={backgroundColor:'#ffffff',logging:false,allowTaint:false,useCORS:false,
      windowWidth:doc.documentElement.clientWidth,windowHeight:doc.documentElement.clientHeight,
      onclone(clonedDoc,bill){
        bill.querySelectorAll('.screen-only,.tools,.toolbar,[data-html2canvas-ignore]').forEach(node=>node.remove());
        markEmptyFields(bill);
        bill.querySelectorAll('[data-bill-empty]').forEach(node=>node.remove());
        bill.querySelectorAll('input').forEach(field=>field.removeAttribute('placeholder'));
        bill.style.setProperty('min-height','0','important');
        if(!bill.classList?.contains('bill-layout-canvas'))bill.style.setProperty('height','auto','important');
        bill.style.setProperty('box-shadow','none','important');
        // Canvas textareas do not wrap reliably. Export their current text as
        // ordinary wrapping content, keeping the editing form unchanged.
        bill.querySelectorAll('textarea').forEach(field=>{
          const text=clonedDoc.createElement('div');
          text.textContent=field.value||'';
          text.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:inherit;padding:2px 3px;min-width:0;width:100%';
          const font=clonedDoc.defaultView.getComputedStyle(field);
          ['fontSize','fontFamily','fontWeight','fontStyle','lineHeight'].forEach(key=>text.style[key]=font[key]);
          field.replaceWith(text);
        });
        if(typeof BillLayout!=='undefined')BillLayout.prepareExport(bill);
        const bounds=bill.getBoundingClientRect(),width=Math.ceil(bounds.width),height=Math.ceil(Math.max(bounds.height,bill.scrollHeight));
        const scale=Math.min(2,16000/height,Math.sqrt(16000000/(width*height)));
        if(!width||!height||scale<0.75)throw new Error('บิลยาวเกินขนาดรูป กรุณาแบ่งเลือกรายการให้น้อยลง หรือบันทึกเป็น PDF');
        Object.assign(options,{width,height,scale});
      }};
    const canvas=await html2canvas(section,options);
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('สร้างรูปบิลไม่สำเร็จ')),'image/png'));
  }
  function mount(frame,tools,status){
    let controls=tools.querySelector('[data-bill-image-controls]');
    if(!controls){
      controls=document.createElement('span');controls.dataset.billImageControls='';controls.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap';
      controls.innerHTML='<label>บิลที่จะคัดลอก <select aria-label="เลือกบิลลูกค้าที่จะคัดลอก"></select></label><button type="button" class="btn secondary" data-copy-bill-image>คัดลอกบิลเป็นรูปภาพ</button><button type="button" class="btn secondary" data-download-bill-image>ดาวน์โหลดรูปบิล</button><a data-preview-bill-image target="_blank" rel="noopener" hidden>ดูรูปบิล</a>';
      tools.insertBefore(controls,status);
      controls.querySelectorAll('button').forEach(button=>{button.style.cssText='background:#f3d78c;color:#142342;border:1px solid #ddb350;font-weight:bold';});
      controls.style.color='#fff';
    }
    const select=controls.querySelector('select'),label=controls.querySelector('label'),copy=controls.querySelector('[data-copy-bill-image]'),download=controls.querySelector('[data-download-bill-image]');
    const preview=controls.querySelector('[data-preview-bill-image]');
    function clearPreview(){if(preview.hasAttribute('href'))URL.revokeObjectURL(preview.href);preview.removeAttribute('href');preview.hidden=true;}
    function showPreview(blob){clearPreview();preview.href=URL.createObjectURL(blob);preview.hidden=false;return preview.href;}
    clearPreview();let sections=[],cached=new Map(),revision=0;select.replaceChildren();copy.disabled=true;download.disabled=true;
    frame.onload=()=>{
      sections=Array.from(frame.contentDocument.querySelectorAll('.document'));
      function compact(){sections.forEach(bill=>{
        markEmptyFields(bill);
        bill.querySelectorAll('textarea').forEach(field=>{field.style.height='0';field.style.height=field.scrollHeight+'px';});
      });}
      compact();
      frame.contentDocument.addEventListener('input',compact);
      frame.contentWindow.addEventListener('beforeprint',compact);
      const caption=section=>section.querySelector('[data-bill-customer]')?.value||section.dataset.customerName||section.querySelector('.head p')?.textContent.split('ประเภทลูกค้า:')[0]||'บิล';
      sections.forEach((section,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=(index+1)+'. ลูกค้า: '+caption(section);select.append(option);});
      frame.contentDocument.addEventListener('input',()=>{
        revision++;
        cached.clear();clearPreview();sections.forEach((section,index)=>{select.options[index].textContent=(index+1)+'. ลูกค้า: '+caption(section);});
        status.textContent='รายละเอียดบิลเปลี่ยนแล้ว กดคัดลอกรูปอีกครั้งเพื่อใช้ข้อมูลล่าสุด';
      });
      frame.contentDocument.addEventListener('bill-layout-change',()=>{revision++;cached.clear();clearPreview();});
      label.hidden=sections.length<2;copy.disabled=download.disabled=!sections.length;
    };
    function image(){
      const index=Number(select.value),section=sections[index];
      if(!section)return Promise.reject(new Error('กรุณารอให้บิลโหลดเสร็จก่อน'));
      if(!cached.has(index)){const version=revision;cached.set(index,render(section).then(blob=>{if(version!==revision)throw new Error('บิลหรือ QR เปลี่ยนระหว่างสร้างรูป กรุณากดคัดลอกอีกครั้ง');return blob;}).catch(error=>{cached.delete(index);throw error;}));}
      return cached.get(index);
    }
    select.onchange=()=>{clearPreview();status.textContent='เลือกบิลแล้ว กดคัดลอกหรือดาวน์โหลดรูป';};
    copy.onclick=async()=>{
      if(copy.disabled)return;
      if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined'){status.textContent='เบราว์เซอร์นี้คัดลอกรูปไม่ได้ กดดาวน์โหลดรูปบิลแล้วแนบในแชทได้';return;}
      copy.disabled=true;select.disabled=true;download.disabled=true;status.textContent='กำลังสร้างรูปบิล…';
      try{
        // Start the clipboard write during the click, before rendering finishes.
        await navigator.clipboard.write([new ClipboardItem({'image/png':image()})]);
        showPreview(await image());
        status.textContent='คัดลอกรูปบิลแล้ว เปิดแชท LINE แล้วกด Ctrl+V เพื่อวางรูป';
      }catch(e){status.textContent='คัดลอกรูปไม่สำเร็จ: '+e.message+' — ลองอีกครั้ง หรือกดดาวน์โหลดรูปบิล';}
      finally{copy.disabled=false;select.disabled=false;download.disabled=false;}
    };
    download.onclick=async()=>{
      download.disabled=true;copy.disabled=true;select.disabled=true;status.textContent='กำลังเตรียมรูปบิล…';
      try{const blob=await image(),url=showPreview(blob),a=document.createElement('a');a.href=url;a.download='บิลชำระเงิน-'+(Number(select.value)+1)+'.png';a.click();status.textContent='ดาวน์โหลดรูปบิลแล้ว สามารถแนบรูปในแชท LINE ได้';}
      catch(e){status.textContent=e.message;}
      finally{download.disabled=false;copy.disabled=false;select.disabled=false;}
    };
  }
  return {render,mount};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=BillImage;
