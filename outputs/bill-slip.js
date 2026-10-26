/* Optional narrow receipt layout. Uses the existing document fields and totals. */
var BillSlip=(function(){
  const css=`
.slip-brand,.slip-count,.slip-thanks,.slip-item-size{display:none}
.sheet.document.bill-format-slip{width:74mm;max-width:74mm;min-height:0;margin:16px auto;padding:5mm 3mm;background:#fff;color:#111;font:11px/1.4 Tahoma,'Noto Sans Thai',sans-serif;border:0;border-radius:0;box-shadow:0 3px 20px #0002;overflow:visible}
.bill-format-slip::before,.bill-format-slip .header-art,.bill-format-slip .document-title small,.bill-format-slip .customer-caption,.bill-format-slip .terms,.bill-format-slip .screen-only,.bill-format-slip [data-html2canvas-ignore],.bill-format-slip [data-bill-empty]{display:none!important}
.sheet.document.bill-format-slip *{color:#111;border-color:#888;letter-spacing:0;box-sizing:border-box}
.sheet.document.bill-format-slip input,.sheet.document.bill-format-slip textarea{font:inherit;line-height:1.4;min-height:0;width:100%;padding:0;border:0;border-bottom:1px dotted #ccc;background:none;border-radius:0}
.sheet.document.bill-format-slip .head-grid{display:block;margin:0 0 7px;padding:0}
.sheet.document.bill-format-slip .slip-brand{display:block;text-align:center;font-size:13px;font-weight:700;margin:0 0 3px;overflow-wrap:anywhere}
.sheet.document.bill-format-slip .company{padding:0;text-align:center;font-size:10px;line-height:1.4}
.sheet.document.bill-format-slip .company label{font:inherit;margin:1px 0}
.sheet.document.bill-format-slip .company input,.sheet.document.bill-format-slip .company textarea{font-size:10px;text-align:center}
.sheet.document.bill-format-slip .company .inline{display:block}
.sheet.document.bill-format-slip .company .slip-contact-label{display:none}
.sheet.document.bill-format-slip .document-title{margin-top:9px}
.sheet.document.bill-format-slip .gold-heading,.sheet.document.bill-format-slip .document-title .gold-heading h2{background:none;border:0;border-radius:0;min-width:0;width:auto;padding:0;margin:0;font-size:12px;font-weight:700;line-height:1.4}
.sheet.document.bill-format-slip .document-title .gold-heading{margin-bottom:7px;text-align:center}
.sheet.document.bill-format-slip .document-title label{display:grid;grid-template-columns:63px minmax(0,1fr);gap:3px;margin:1px 0;font-size:10px;line-height:1.4}
.sheet.document.bill-format-slip .document-title label input{font-size:10px;padding:0}
.sheet.document.bill-format-slip .panel{border:0;border-radius:0;padding:0;margin:4px 0}
.sheet.document.bill-format-slip .customer-grid{display:block;font-size:10px}
.sheet.document.bill-format-slip .customer-grid label{display:grid;grid-template-columns:48px minmax(0,1fr);gap:5px;font-size:10px;line-height:1.4}
.sheet.document.bill-format-slip .customer-grid input{flex:1;min-width:0}
.sheet.document.bill-format-slip .customer-grid textarea{flex:1;min-height:0}
.sheet.document.bill-format-slip .panel:has(.customer-grid)>h2{display:none}
.sheet.document.bill-format-slip .items{margin:7px 0 0;border:0;border-radius:0;overflow:visible}
.sheet.document.bill-format-slip .items table,.sheet.document.bill-format-slip .items thead,.sheet.document.bill-format-slip .items tbody{display:block;width:100%;min-width:0;border:0}
.sheet.document.bill-format-slip .items tr{display:grid;grid-template-columns:minmax(0,1fr) 56px 58px;gap:0;border:0;border-radius:0;padding:0;margin:0;background:none}
.sheet.document.bill-format-slip .items thead{border-top:1px solid #555;border-bottom:1px solid #555}
.sheet.document.bill-format-slip .items th,.sheet.document.bill-format-slip .items td{display:block;border:0;background:none;height:auto;min-height:0;margin:0;padding:3px 1px;font-size:10px;line-height:1.4;overflow-wrap:anywhere;text-align:left}
.sheet.document.bill-format-slip .items th:nth-child(1),.sheet.document.bill-format-slip .items td:nth-child(1),.sheet.document.bill-format-slip .items th:nth-child(3),.sheet.document.bill-format-slip .items td:nth-child(3),.sheet.document.bill-format-slip .items th:nth-child(4){display:none!important}
.sheet.document.bill-format-slip .items th:nth-child(2){grid-column:1;text-align:center;width:auto}
.sheet.document.bill-format-slip .items th:nth-child(5){grid-column:2;width:auto;text-align:right}
.sheet.document.bill-format-slip .items th:nth-child(5){font-size:9px;white-space:nowrap}
.sheet.document.bill-format-slip .items th:nth-child(6){grid-column:3;width:auto;text-align:right}
.sheet.document.bill-format-slip .items td.description{grid-area:1/1;padding-left:26px;text-align:left}
.sheet.document.bill-format-slip .items td:nth-child(4){grid-area:1/1;width:24px;z-index:1;text-align:left;align-self:start}
.sheet.document.bill-format-slip .items td:nth-child(5){grid-area:1/2;text-align:right;white-space:normal}
.sheet.document.bill-format-slip .items td:nth-child(6){grid-area:1/3;text-align:right;white-space:normal}
.sheet.document.bill-format-slip .items td.amount{text-align:right!important}
.sheet.document.bill-format-slip .items td::before{content:none!important}
.sheet.document.bill-format-slip .items input{font-size:10px;text-align:inherit;padding:0}
.sheet.document.bill-format-slip input[type=number]{appearance:textfield;-moz-appearance:textfield}
.sheet.document.bill-format-slip input[type=number]::-webkit-inner-spin-button,.sheet.document.bill-format-slip input[type=number]::-webkit-outer-spin-button{appearance:none;margin:0}
.sheet.document.bill-format-slip .items .bill-item-date{display:none}
.sheet.document.bill-format-slip .items .bill-item-reference,.sheet.document.bill-format-slip .slip-item-size{display:block;font-size:8px;line-height:1.3;margin:1px 0;overflow-wrap:anywhere}
.sheet.document.bill-format-slip .items .bill-item-reference:empty,.sheet.document.bill-format-slip .slip-item-size:empty{display:none}
.sheet.document.bill-format-slip .slip-count{display:block;font-size:10px;border-top:1px solid #555;border-bottom:1px solid #555;margin:0 0 5px;padding:3px 0}
.sheet.document.bill-format-slip .bill-summary-grid{display:flex;flex-direction:column;gap:4px;margin:0}
.sheet.document.bill-format-slip .totals{order:0;width:100%;padding:0;margin:0}
.sheet.document.bill-format-slip .totals>div:not(.balance){display:flex}
.sheet.document.bill-format-slip .totals>div,.sheet.document.bill-format-slip .totals .balance{display:flex;justify-content:space-between;gap:8px;font-size:11px;line-height:1.4;border:0;border-radius:0;background:none;padding:2px 0;margin:0}
.sheet.document.bill-format-slip .totals .balance{border-top:1px solid #555;border-bottom:1px solid #555;font-size:12px;font-weight:700;padding:4px 0}
.sheet.document.bill-format-slip .totals output{font:inherit;white-space:nowrap}
.sheet.document.bill-format-slip[data-document-kind=receipt] .totals>div:nth-child(2){font-size:12px;font-weight:700;border-top:1px solid #555;border-bottom:1px solid #555;padding:4px 0}
.sheet.document.bill-format-slip[data-document-kind=receipt] .totals .balance{font-size:10px;font-weight:400;border:0;padding:2px 0}
.sheet.document.bill-format-slip .payment-details{order:1;width:100%;font-size:10px}
.sheet.document.bill-format-slip .payment-details>h2{font-size:10px;text-align:left;margin-bottom:3px}
.sheet.document.bill-format-slip .payment-details .bill-payment-account{display:flex;gap:6px;padding:3px 0;border:0;border-radius:0;margin:0}
.sheet.document.bill-format-slip .payment-details .bill-payment-description{padding:0;background:none;border:0;min-width:0;flex:1}
.sheet.document.bill-format-slip .payment-details .bill-payment-description strong{font-size:11px;line-height:1.4;margin:2px 0}
.sheet.document.bill-format-slip .payment-details .bill-payment-description small{font-size:8px}
.sheet.document.bill-format-slip .bill-account-field{gap:1px}
.sheet.document.bill-format-slip .bill-account-label{font-size:8px}
.sheet.document.bill-format-slip .bill-account-value,.sheet.document.bill-format-slip .bill-account-number .bill-account-value{font-size:11px;line-height:1.4;letter-spacing:0}
.sheet.document.bill-format-slip .payment-details[data-receiving=false]{display:none}
.sheet.document.bill-format-slip .payment-details img{max-width:100%;max-height:40mm;object-fit:contain}
.sheet.document.bill-format-slip .payment-details .bill-payment-qr{flex:0 0 30mm;max-width:30mm}
.sheet.document.bill-format-slip .empty-payment{font-size:9px;margin:2px 0}
.sheet.document.bill-format-slip .note{font-size:8px;line-height:1.4;margin:5px 0;text-align:left}
.sheet.document.bill-format-slip .slip-thanks{display:block;text-align:center;font-size:11px;margin:12px 0 2px}
@media print{body.bill-slip-active{background:#fff}.sheet.document.bill-format-slip{width:74mm;max-width:74mm;padding:0;margin:0;box-shadow:none;page-break-after:always;break-after:page}.sheet.document.bill-format-slip input,.sheet.document.bill-format-slip textarea{border:0}.sheet.document.bill-format-slip:last-child{page-break-after:auto;break-after:auto}}
`;
  function mount(frame,tools,status){
    let control=tools.querySelector('[data-bill-format]');
    if(!control){control=document.createElement('label');control.dataset.billFormat='';control.style.cssText='color:#fff;font-size:12px;display:flex;align-items:center;gap:6px';control.append('รูปแบบเอกสาร ');const select=document.createElement('select');select.setAttribute('aria-label','รูปแบบใบเสร็จ');select.innerHTML='<option value="a4">แบบเดิม A4</option><option value="slip">ใบเสร็จสลิป · 80 มม.</option>';select.style.cssText='max-width:210px;padding:6px 8px;border-radius:7px;border:1px solid #b9c6cd;background:#fff;color:#142342';control.append(select);tools.insertBefore(control,status);}
    const select=control.querySelector('select');select.disabled=true;select.value='a4';
    frame.addEventListener('load',()=>{
      const doc=frame.contentDocument,win=frame.contentWindow,bills=Array.from(doc.querySelectorAll('.sheet.document'));
      const style=doc.createElement('style');style.textContent=css;doc.head.append(style);const printStyle=doc.createElement('style');doc.head.append(printStyle);
      bills.forEach(bill=>{
        const brand=doc.createElement('div');brand.className='slip-brand';brand.textContent=bill.dataset.storeName||'ร้านโชคดีการพิมพ์';bill.querySelector('.head-grid').prepend(brand);
        const count=doc.createElement('div');count.className='slip-count';bill.querySelector('.items').after(count);
        const thanks=doc.createElement('div');thanks.className='slip-thanks';thanks.textContent='ขอบคุณที่ใช้บริการ';bill.append(thanks);
        bill.querySelectorAll('.company label').forEach((label,index)=>{if(index>2)return;Array.from(label.childNodes).filter(node=>node.nodeType===3).forEach(node=>{const span=doc.createElement('span');span.className='slip-contact-label';span.textContent=node.textContent;node.replaceWith(span);});});
      });
      function refresh(){
        bills.forEach(bill=>{
          const rows=Array.from(bill.querySelectorAll('.items tbody tr'));let quantity=0;
          rows.forEach(row=>{const cells=row.cells;if(!cells?.[3])return;const input=cells[3].querySelector('input');quantity+=Number(input?input.value:cells[3].textContent)||0;
            let size=cells[1].querySelector('.slip-item-size');if(!size){size=doc.createElement('span');size.className='slip-item-size';cells[1].append(size);}const text=cells[2].querySelector('input')?.value||cells[2].textContent.trim();if(size.textContent!==text)size.textContent=text;
          });
          bill.querySelector('.slip-count').textContent='รายการ: '+rows.length+'  จำนวนชิ้น: '+quantity.toLocaleString('th-TH',{maximumFractionDigits:3});
        });
        if(select.value==='slip'){const height=Math.max(1,...bills.map(b=>b.getBoundingClientRect().height));printStyle.textContent='@page{size:80mm '+Math.ceil(height*25.4/96+6)+'mm;margin:3mm}';}
      }
      bills.forEach(bill=>new MutationObserver(refresh).observe(bill.querySelector('.items tbody'),{childList:true}));
      doc.addEventListener('input',refresh);win.addEventListener('beforeprint',refresh);
      select.onchange=()=>{
        const slip=select.value==='slip',layout=tools.querySelector('[data-layout-tools]');
        if(slip)tools.querySelector('[data-layout-auto]')?.click();if(layout)layout.hidden=slip;
        bills.forEach(b=>b.classList.toggle('bill-format-slip',slip));doc.body.classList.toggle('bill-slip-active',slip);if(!slip)printStyle.textContent='';refresh();
        doc.dispatchEvent(new win.Event('input',{bubbles:true}));doc.dispatchEvent(new win.Event('bill-layout-change'));
        status.textContent=slip?'ใบเสร็จสลิป · กระดาษ 80 มม. เนื้อหากว้างประมาณ 280 px · ความยาวตามรายการ':'ใช้รูปแบบเอกสาร A4 เดิม';
      };
      select.disabled=!bills.length;refresh();
    },{once:true});
  }
  return {mount,css};
})();
if(typeof module!=='undefined')module.exports=BillSlip;
