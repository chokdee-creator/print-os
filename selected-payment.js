/* Printable documents use only the rows selected in the account page. */
var SelectedPayment = (function () {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const amount = value => (value / 100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
  function documents(rows) {
    if (!rows.length) throw new Error('กรุณาติ๊กรายการที่ต้องการก่อน');
    const groups = new Map();
    rows.forEach(row => {
      const sale = Math.round(Number(row.sale) * 100), paid = Math.round(Number(row.paid) * 100);
      if (!Number.isSafeInteger(sale) || !Number.isSafeInteger(paid) || sale < 0 || paid < 0 || paid > sale) throw new Error('ยอดชำระของรายการไม่ถูกต้อง กรุณาตรวจข้อมูลก่อนพิมพ์');
      const key = JSON.stringify([row.customerType,row.customerName]);
      const doc = groups.get(key) || {customerType:row.customerType,customerName:row.customerName,rows:[],sale:0,paid:0,balance:0};
      doc.rows.push({...row,sale,paid,balance:sale-paid});
      doc.sale += sale; doc.paid += paid; doc.balance += sale-paid;
      if (!Number.isSafeInteger(doc.sale)) throw new Error('ยอดรวมเกินขอบเขต');
      groups.set(key,doc);
    });
    return [...groups.values()];
  }
  function html(rows, date, storeName='ร้านปริ้นอิมเมจ', paymentHtml='', options={}) {
    const docs=documents(rows),invoice=options.kind==='invoice';
    const theme=typeof InvoiceTheme!=='undefined'?InvoiceTheme:typeof require==='function'?require('./bill-theme.js'):null;
    if(!theme)throw new Error('โหลดธีมบิลไม่สำเร็จ กรุณารีเฟรชเว็บ');
    const chokdee=storeName.includes('โชคดี');
    const field=(value='',placeholder='',type='text')=>'<input type="'+type+'" value="'+escape(value)+'" placeholder="'+escape(placeholder)+'">';
    const notes=value=>'<textarea rows="2">'+escape(value)+'</textarea>';
    const qty=r=>Number.isFinite(Number(r.quantity))&&Number(r.quantity)>0?Number(r.quantity):1;
    return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${invoice?'ใบแจ้งยอดชำระ':'ใบเสร็จ / ยอดชำระ'} ${escape(storeName)}</title><style>${theme.css}</style></head><body>
      <div class="tools"><button type="button" onclick="window.print()">พิมพ์ / บันทึก PDF</button><span>แยกเอกสารตามลูกค้า ${docs.length} ราย · แก้ไขข้อมูลติดต่อและรายละเอียดได้เฉพาะบิลนี้</span></div>
      ${docs.map(doc=>{
        const heading=invoice?'ใบแจ้งยอดชำระ':doc.paid>0?'ใบเสร็จรับเงิน':'ใบแจ้งยอดชำระ';
        return `<main class="sheet document" data-customer-name="${escape(doc.customerName)}">
        ${chokdee?`<header class="header-art"><img src="${theme.headerArt}" alt="โชคดีการพิมพ์"></header>`:`<header class="header-art prince-art"><div class="brand">ปริ้นอิมเมจ<small>PRINCE IMAGE</small></div><div class="printer-crop"><img src="${theme.headerArt}" alt="เครื่องพิมพ์งานป้าย"></div></header>`}
        <section class="head-grid head"><div class="company"><h1>${escape(storeName)}</h1><label>ที่อยู่ ${notes(chokdee?'1/11 ถ.สฤทฎิ์ยุทธศิลป์ ต.หน้าเมือง อ.เมือง จ.ปราจีนบุรี 25000':'')}</label><div class="inline"><label>โทร ${field(chokdee?'091-040-2986':'','เบอร์โทรร้าน')}</label><label>LINE ${field(chokdee?'@chokdeeprint':'','LINE ของร้าน')}</label></div><label>เลขประจำตัวผู้เสียภาษี ${field('','กรอกเมื่อต้องการแสดง')}</label></div>
        <div class="document-title"><div class="gold-heading large"><h2>${heading}</h2><small>${heading==='ใบเสร็จรับเงิน'?'RECEIPT':'INVOICE'}</small></div><label>เลขที่ ${field('','เลขที่เอกสาร')}</label><label>วันที่ ${field(date)}</label><label>ครบกำหนดชำระ ${field('','','date')}</label><label>อ้างอิง ${field('','เลขอ้างอิง')}</label></div></section>
        <section class="panel"><h2 class="gold-heading">ข้อมูลลูกค้า</h2><p class="customer-caption">ประเภทลูกค้า: ${escape(doc.customerType)}</p><div class="customer-grid"><label>ชื่อลูกค้า <input data-bill-customer value="${escape(doc.customerName)}" placeholder="ชื่อ/บริษัท"></label><label>เบอร์โทร ${field('','โทรศัพท์ลูกค้า')}</label><label class="span2">ที่อยู่ ${notes('')}</label><label class="span2">พนักงานขาย ${field('','ชื่อพนักงานขาย')}</label></div></section>
        <section class="items"><table><thead><tr><th>ลำดับ</th><th>รายการ</th><th>จำนวน</th><th>ราคา/หน่วย</th><th>รวมเงิน</th></tr></thead><tbody>${doc.rows.map((r,i)=>`<tr><td>${i+1}</td><td class="description">${escape(r.name)}<br><small>วันที่งาน: ${escape(r.date)} · อ้างอิง: ${escape(r.id)}</small>${r.paymentMethod?`<br><small>ช่องทางล่าสุด: ${escape(r.paymentMethod)} ${escape(r.paymentMethodNote||'')}</small>`:''}${(r.paymentHistory||[]).map(h=>`<br><small>รับชำระ ${escape(h.method)} ${amount(Math.round(h.amount*100))} บาท · ${escape(new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'short'}).format(new Date(h.date)))}</small>`).join('')}</td><td>${escape(qty(r))}</td><td class="amount">${amount(r.sale/qty(r))}</td><td class="amount">${amount(r.sale)}</td></tr>`).join('')}</tbody></table></section>
        <div class="bottom-grid"><section class="panel"><h2 class="gold-heading">หมายเหตุ</h2>${notes('แสดงเฉพาะรายการที่เลือก ยอดรวมใช้ยอดที่บันทึกไว้ในระบบ')}</section><section class="panel totals"><div><span>ยอดขายรวม</span><output>${amount(doc.sale)} บาท</output></div><div><span>รับชำระแล้ว</span><output>${amount(doc.paid)} บาท</output></div><div class="balance"><span>ค้างชำระ</span><output>${amount(doc.balance)} บาท</output></div></section></div>
        <div class="bottom-grid"><section class="panel payment-details"><h2 class="gold-heading">ช่องทางการชำระเงิน</h2>${doc.balance>0&&paymentHtml?paymentHtml:'<p class="empty-payment">'+(doc.balance>0?'ยังไม่ได้เลือกบัญชีรับชำระ':'รายการนี้รับชำระครบแล้ว')+'</p>'}</section><section class="panel signatures"><div><strong>ผู้รับงาน / ผู้วางบิล</strong><div class="sign-line"></div><span>วันที่ ${field('','','date')}</span></div><div><strong>ผู้อนุมัติ / ลูกค้า</strong><div class="sign-line"></div><span>วันที่ ${field('','','date')}</span></div></section></div>
        <section class="panel terms"><h2 class="gold-heading">เงื่อนไข</h2>${notes('1. กรุณาตรวจสอบรายละเอียดก่อนยืนยันการผลิต\n2. กำหนดชำระเงินตามที่ตกลงร่วมกัน\n3. หากต้องการแก้ไขรายการ กรุณาติดต่อร้านก่อนดำเนินการ')}</section>
        <p class="note">${invoice?'บิลนี้แสดงเฉพาะรายการค้างชำระที่เลือก และยอดค้างหลังหักเงินที่รับชำระแล้ว เอกสารนี้ไม่ใช่ใบเสร็จรับเงิน':doc.paid>0?'ใบเสร็จนี้แสดงเฉพาะยอดรับชำระที่บันทึกไว้แล้วของรายการที่เลือก วันที่พิมพ์ไม่ใช่วันที่รับเงิน':'เอกสารแจ้งยอดนี้ยังไม่ใช่หลักฐานการรับเงิน เนื่องจากรายการที่เลือกยังไม่มีการรับชำระ'}<br>การพิมพ์ไม่เปลี่ยนสถานะชำระเงินในระบบ และไม่บวกภาษีหรือค่าบริการเพิ่ม</p></main>`;
      }).join('')}</body></html>`;
  }
  return {documents,html};
})();
function selectedPaymentRows(rows) {
  return rows.map(r=>({id:r.id,name:r.name,date:r.date,customerType:customerType(r),customerName:customerName(r),sale:Number(r.saleTotal)||0,quantity:r.quantity,paid:paidAmount(r),paymentMethod:r.paymentMethod,paymentMethodNote:r.paymentMethodNote,paymentHistory:PaymentChannelData.readHistory(r.paymentHistory)}));
}
function showSelectedPaymentDocument(html, onSend, documentTitle) {
  let dialog=document.getElementById('selectedReceiptDialog');
  if(!dialog){
    dialog=document.createElement('dialog');dialog.id='selectedReceiptDialog';
    dialog.style.cssText='width:96vw;max-width:1060px;height:94vh;padding:12px;border:0;border-radius:12px;background:#122949';
    const outside=event=>{const r=dialog.getBoundingClientRect();return event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);};
    let backdropPress=false;
    dialog.addEventListener('pointerdown',event=>{backdropPress=outside(event);});
    dialog.addEventListener('click',event=>{if(backdropPress&&outside(event))dialog.close();backdropPress=false;});
    const tools=document.createElement('div');tools.style.cssText='display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px';
    const close=document.createElement('button');close.type='button';close.className='btn secondary';close.textContent='ปิดตัวอย่าง';close.addEventListener('click',()=>dialog.close());
    const send=document.createElement('button');send.type='button';send.className='btn';send.dataset.sendSelectedBill='';
    const status=document.createElement('span');status.setAttribute('role','status');
    tools.append(close,send,status);
    status.style.cssText='color:#fff;width:100%;font-size:13px';
    [close,send].forEach(button=>button.style.cssText='background:#f3d78c;color:#142342;border:1px solid #ddb350;font-weight:bold');
    const frame=document.createElement('iframe');frame.style.cssText='display:block;width:100%;min-height:0;flex:1;border:0;background:white';
    const layout=document.createElement('div');layout.style.cssText='display:flex;flex-direction:column;height:100%';tools.style.flexShrink='0';layout.append(tools,frame);dialog.append(layout);document.body.append(dialog);
  }
  const title=documentTitle||(onSend?'ตัวอย่างบิลยอดชำระของรายการที่เลือก':'ตัวอย่างใบเสร็จของรายการที่เลือก');
  dialog.setAttribute('aria-label',title);const frame=dialog.querySelector('iframe');frame.title=title;frame.srcdoc=html;
  const send=dialog.querySelector('[data-send-selected-bill]'),status=dialog.querySelector('[role="status"]');
  BillImage.mount(frame,send.parentElement,status);
  send.hidden=!onSend;send.disabled=false;send.textContent='ส่งยอดเข้า LINE';status.textContent='';
  send.onclick=onSend?async()=>{
    if(send.disabled)return;send.disabled=true;status.textContent='กำลังส่งยอดของรายการในบิลเข้า LINE…';
    try{const result=await onSend();status.textContent='ส่งยอดชำระเข้า LINE ของ '+result.recipientName+' แล้ว';send.textContent='ส่งยอดแล้ว';}
    catch(e){status.textContent=e.message;send.disabled=false;}
  }:null;
  if(!dialog.open)dialog.showModal();
}
async function printSelectedReceipt() {
  try {
    const rows=selectedPaymentRows(selectedRecords());
    SelectedPayment.documents(rows);
    const paymentKeys=rows.some(r=>r.sale>r.paid)?await StorePaymentChannels.choose('เปิดเอกสารด้วยบัญชีที่เลือก'):[];if(paymentKeys===null)return;
    const html=SelectedPayment.html(rows,new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'long'}).format(new Date()),SHEET_TAB_NAME==='Chokdee'?'ร้านโชคดีการพิมพ์':'ร้านปริ้นอิมเมจ',StorePaymentChannels.html(paymentKeys));
    showSelectedPaymentDocument(html);
  }catch(e){toast(e.message);}
}
async function openSavedJobBill(record) {
  try {
    const rows=selectedPaymentRows([record]);
    SelectedPayment.documents(rows);
    const unpaid=rows[0].sale>rows[0].paid;
    const keys=unpaid?await StorePaymentChannels.choose('ใช้บัญชีที่เลือกในบิล'):[];
    if(keys===null)return;
    const html=SelectedPayment.html(rows,new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'long'}).format(new Date()),SHEET_TAB_NAME==='Chokdee'?'ร้านโชคดีการพิมพ์':'ร้านปริ้นอิมเมจ',StorePaymentChannels.html(keys),{kind:unpaid?'invoice':'receipt'});
    showSelectedPaymentDocument(html,undefined,'ตัวอย่างบิลของรายการที่บันทึก');
  }catch(e){toast('บันทึกแล้ว แต่เปิดบิลไม่สำเร็จ: '+e.message);}
}
if (typeof module !== 'undefined' && module.exports) module.exports = SelectedPayment;
