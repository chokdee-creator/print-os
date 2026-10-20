/* Manual invoices are local form drafts, separate from saved shop jobs. */
function openBlankInvoiceForm(){
  const date=new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'long'}).format(new Date());
  const store=SHEET_TAB_NAME==='Chokdee'?'ร้านโชคดีการพิมพ์':'ร้านปริ้นอิมเมจ';
  const html=SelectedPayment.html([{id:'',name:'',date:'',customerType:'',customerName:'',quantity:1,sale:0,paid:0}],date,store,'',{kind:'invoice'});
  showSelectedPaymentDocument(html,undefined,'กรอกข้อมูลออกบิล');
  const dialog=document.getElementById('selectedReceiptDialog'),frame=dialog.querySelector('iframe');
  frame.addEventListener('load',()=>prepareBlankInvoice(frame),{once:true});
}
function prepareBlankInvoice(frame){
  const doc=frame.contentDocument,root=doc.querySelector('.document'),body=root.querySelector('tbody');
  root.querySelector('.customer-caption').remove();root.querySelector('[data-bill-customer]').required=true;
  root.querySelector('.bottom-grid textarea').value='';
  root.querySelector('.note').textContent='เอกสารแจ้งยอดนี้ยังไม่ใช่หลักฐานการรับเงิน กรุณาตรวจสอบรายละเอียดและยอดชำระก่อนส่งให้ลูกค้า';
  const totals=root.querySelector('.totals').children,sale=totals[0].querySelector('output'),balance=totals[2].querySelector('output');
  const paid=doc.createElement('input');paid.type='number';paid.min='0';paid.step='0.01';paid.value='0';paid.required=true;paid.setAttribute('aria-label','ยอดรับชำระแล้ว');paid.style.cssText='width:110px;text-align:right';
  totals[1].querySelector('output').replaceWith(paid);
  const money=satang=>(satang/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+' บาท';
  function calculate(){
    let sum=0;
    Array.from(body.rows).forEach((row,index)=>{
      row.querySelector('[data-row-index]').textContent=index+1;
      const qty=Number(row.querySelector('[data-quantity]').value),price=Number(row.querySelector('[data-price]').value);
      const value=Number.isFinite(qty)&&Number.isFinite(price)?Math.round(qty*price*100):0;
      row.querySelector('output').textContent=money(value);sum+=value;
    });
    const received=Math.round(Number(paid.value)*100);
    paid.setCustomValidity(received>sum?'ยอดรับชำระต้องไม่เกินยอดรวมของบิล':'');
    sale.textContent=money(sum);balance.textContent=money(Math.max(sum-received,0));
  }
  function changed(){root.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));}
  function addRow(){
    const row=doc.createElement('tr');
    row.innerHTML='<td><span data-row-index></span></td><td class="description"><input aria-label="รายการงาน" placeholder="กรอกรายละเอียดงาน" required><button type="button" class="screen-only" data-html2canvas-ignore data-remove-row>ลบรายการ</button></td><td><input aria-label="จำนวน" data-quantity type="number" min="0.01" step="any" value="1" required></td><td><input aria-label="ราคา/หน่วย" data-price type="number" min="0" step="0.01" value="0" required></td><td class="amount"><output></output></td>';
    row.querySelector('[data-remove-row]').onclick=()=>{row.remove();if(!body.rows.length)addRow();calculate();changed();};
    body.append(row);calculate();
  }
  body.replaceChildren();addRow();root.addEventListener('input',calculate);
  const add=doc.createElement('button');add.type='button';add.textContent='+ เพิ่มรายการ';add.setAttribute('data-html2canvas-ignore','true');add.onclick=()=>{addRow();changed();};doc.querySelector('.tools').append(add);
  doc.querySelector('.tools button').onclick=()=>{const invalid=root.querySelector(':invalid');if(invalid){invalid.reportValidity();return;}frame.contentWindow.print();};
  const dialog=frame.closest('dialog'),tools=dialog.querySelector('[data-send-selected-bill]').parentElement;
  let bank=tools.querySelector('[data-blank-payment]');
  if(!bank){bank=document.createElement('button');bank.type='button';bank.className='btn secondary';bank.dataset.blankPayment='';bank.textContent='เลือกบัญชี / QR รับชำระ';bank.style.cssText='background:#f3d78c;color:#142342;border:1px solid #ddb350;font-weight:bold';tools.insertBefore(bank,tools.querySelector('[role="status"]'));}
  bank.hidden=false;
  const payment=root.querySelector('.payment-details');payment.innerHTML='<h2 class="gold-heading">ช่องทางการชำระเงิน</h2><p class="empty-payment">กดเลือกบัญชี / QR รับชำระ จากแถบด้านบน</p>';
  bank.onclick=async()=>{
    bank.disabled=true;
    try{const keys=await StorePaymentChannels.choose('ใช้บัญชีที่เลือกในบิล');if(keys===null)return;payment.innerHTML='<h2 class="gold-heading">ช่องทางการชำระเงิน</h2>'+StorePaymentChannels.html(keys);changed();}
    catch(e){tools.querySelector('[role="status"]').textContent=e.message;}
    finally{bank.disabled=false;}
  };
}
