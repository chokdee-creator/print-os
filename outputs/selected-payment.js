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
  function html(rows, date, storeName='ร้านปริ้นอิมเมจ', paymentHtml='') {
    const docs = documents(rows);
    return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ใบเสร็จ / ยอดชำระ ${escape(storeName)}</title>
      <style>*{box-sizing:border-box}body{font:14px/1.6 Tahoma,Arial,sans-serif;color:#17212d;background:#edf1f5;margin:0;padding:24px}.tools{max-width:900px;margin:0 auto 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}button{font:inherit;padding:10px 20px;background:#163c55;color:white;border:0;border-radius:8px;cursor:pointer}.document{max-width:900px;margin:0 auto 24px;background:white;padding:36px;border:1px solid #dce2e8}h1{font-size:24px;margin:0}h2{font-size:20px;margin:8px 0}.head{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}.muted{color:#546171}table{width:100%;border-collapse:collapse;margin:24px 0;table-layout:fixed}th,td{border-bottom:1px solid #dce2e8;padding:9px 5px;text-align:left;overflow-wrap:anywhere}.amount{text-align:right}tfoot{font-weight:bold}.totals{margin-left:auto;max-width:340px}.totals div{display:flex;justify-content:space-between;gap:20px;padding:5px}.balance{border-top:2px solid #17212d;font-weight:bold}.note{margin-top:24px;font-size:12px;color:#546171}.signature{margin-top:48px;text-align:right}thead{display:table-header-group}tr{break-inside:avoid}@page{size:A4;margin:12mm}@media print{body{padding:0;background:white}.tools{display:none}.document{max-width:none;border:0;padding:0;margin:0;break-after:page}.document:last-child{break-after:auto}button{display:none}}</style></head><body>
      <div class="tools"><button type="button" onclick="window.print()">พิมพ์ / บันทึก PDF</button><span>ตรวจยอดก่อนพิมพ์ แยกเอกสารตามลูกค้า ${docs.length} ราย</span></div>
      ${docs.map(doc => `<section class="document"><div class="head"><div><h1>${escape(storeName)}</h1><p>ลูกค้า: ${escape(doc.customerName)}<br>ประเภทลูกค้า: ${escape(doc.customerType)}</p></div><div><h2>${doc.paid > 0 ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งยอดชำระ'}</h2><span>วันที่พิมพ์: ${escape(date)}</span></div></div>
      <table><thead><tr><th style="width:6%">#</th><th style="width:15%">วันที่งาน</th><th style="width:34%">รายการ</th><th class="amount" style="width:15%">ยอดขาย</th><th class="amount" style="width:15%">ชำระแล้ว</th><th class="amount" style="width:15%">ค้างชำระ</th></tr></thead><tbody>${doc.rows.map((r,i)=>`<tr><td>${i+1}</td><td>${escape(r.date)}</td><td>${escape(r.name)}<br><small class="muted">อ้างอิง: ${escape(r.id)}</small>${r.paymentMethod?`<br><small>ช่องทางล่าสุด: ${escape(r.paymentMethod)} ${escape(r.paymentMethodNote||'')}</small>`:''}${(r.paymentHistory||[]).map(h=>`<br><small>รับชำระ ${escape(h.method)} ${amount(Math.round(h.amount*100))} บาท · ${escape(new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'short'}).format(new Date(h.date)))}</small>`).join('')}</td><td class="amount">${amount(r.sale)}</td><td class="amount">${amount(r.paid)}</td><td class="amount">${amount(r.balance)}</td></tr>`).join('')}</tbody></table>
      <div class="totals"><div><span>ยอดขายรวม</span><strong>${amount(doc.sale)} บาท</strong></div><div><span>รับชำระแล้ว</span><strong>${amount(doc.paid)} บาท</strong></div><div class="balance"><span>ค้างชำระ</span><span>${amount(doc.balance)} บาท</span></div></div>
      ${doc.balance>0?paymentHtml:''}<p class="note">${doc.paid > 0 ? 'ใบเสร็จนี้แสดงเฉพาะยอดรับชำระที่บันทึกไว้แล้วของรายการที่เลือก วันที่พิมพ์ไม่ใช่วันที่รับเงิน' : 'เอกสารแจ้งยอดนี้ยังไม่ใช่หลักฐานการรับเงิน เนื่องจากรายการที่เลือกยังไม่มีการรับชำระ'}<br>การพิมพ์ไม่เปลี่ยนสถานะชำระเงินในระบบ และไม่บวกภาษีหรือค่าบริการเพิ่ม</p><div class="signature">ผู้รับเงิน / ผู้ตรวจสอบ ............................................</div></section>`).join('')}
      </body></html>`;
  }
  return {documents,html};
})();
async function printSelectedReceipt() {
  try {
    const rows = selectedRecords().map(r=>({id:r.id,name:r.name,date:r.date,customerType:customerType(r),customerName:customerName(r),sale:Number(r.saleTotal)||0,paid:paidAmount(r),paymentMethod:r.paymentMethod,paymentMethodNote:r.paymentMethodNote,paymentHistory:PaymentChannelData.readHistory(r.paymentHistory)}));
    const paymentKeys=rows.some(r=>r.sale>r.paid)?await StorePaymentChannels.choose('เปิดเอกสารด้วยบัญชีที่เลือก'):[];if(paymentKeys===null)return;
    const html = SelectedPayment.html(rows, new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'long'}).format(new Date()), SHEET_TAB_NAME==='Chokdee'?'ร้านโชคดีการพิมพ์':'ร้านปริ้นอิมเมจ',StorePaymentChannels.html(paymentKeys));
    let dialog = document.getElementById('selectedReceiptDialog');
    if (!dialog) {
      dialog=document.createElement('dialog');dialog.id='selectedReceiptDialog';
      dialog.setAttribute('aria-label','ตัวอย่างใบเสร็จของรายการที่เลือก');
      dialog.style.cssText='width:96vw;max-width:1060px;height:94vh;padding:12px;border:0;border-radius:12px;background:#edf1f5';
      const close=document.createElement('button');close.type='button';close.className='btn secondary';close.textContent='ปิดตัวอย่าง';
      close.style.cssText='margin-bottom:8px';close.addEventListener('click',()=>dialog.close());
      const frame=document.createElement('iframe');frame.title='ใบเสร็จรายการที่เลือก';
      frame.style.cssText='display:block;width:100%;height:calc(100% - 58px);border:0;background:white';
      dialog.append(close,frame);document.body.append(dialog);
    }
    dialog.querySelector('iframe').srcdoc=html;
    dialog.showModal();
  } catch(e) {toast(e.message);}
}
if (typeof module !== 'undefined' && module.exports) module.exports = SelectedPayment;
