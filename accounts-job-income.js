/* Canonical PRINCE IMAGE receipts, scoped to this deployment's owner and book 03. */
var AccountsJobIncome=(function(){
  'use strict';
  const endpoint='https://script.google.com/macros/s/AKfycbzDF5-Kvqf03RLCxpToRL7C9PAqlfhUvC_xLgnEExF7H4go7gybvzLaKDwtKVBHl6if/exec';
  const owner='chokdeeprintings@gmail.com',cutoff='2026-11-07',prefix='prince-income-';
  function enabled(data,scope){return scope?.endpoint===endpoint&&scope?.owner===owner&&data?.books?.find(b=>b.id==='book-3')?.name.trim()==='PRINCE IMAGE';}
  function managed(entry){return typeof entry?.id==='string'&&entry.id.startsWith(prefix);}
  function day(value){
    if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return !isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value?value:'';
    if(!value||isNaN(Date.parse(value)))return '';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;
  }
  function record(row){
    if(!Array.isArray(row)||row.length<25)throw Error('รูปแบบข้อมูลบันทึกงานไม่ถูกต้อง');
    return {id:String(row[0]||''),date:day(row[1]),status:String(row[5]||''),name:String(row[6]||''),sale:row[17],paid:row[18],customer:String(row[4]||''),createdAt:row[23],reference:String(row[29]||'')};
  }
  function satang(value){if(value===''||value===null||value===undefined)return 0;const n=Number(value);if(!Number.isFinite(n)||n<0)throw Error('ยอดเงินบันทึกงานไม่ถูกต้อง');const amount=Math.round((n+Number.EPSILON)*100);if(!Number.isSafeInteger(amount)||amount>99999999999)throw Error('ยอดเงินบันทึกงานเกินขอบเขต');return amount;}
  async function merge(data,payload,scope){
    if(!enabled(data,scope))return {data,changed:false};
    // Never reconcile deletions from a failed, truncated, or different store response.
    if(payload?.ok!==true||payload.sheetName!=='Data Account'||!Array.isArray(payload.records)||payload.records.length>10000)throw Error('ยืนยันข้อมูลร้าน PRINCE IMAGE ไม่สำเร็จ');
    const ids=new Set(),entries=[];
    for(const row of payload.records){
      const r=record(row);if(!r.id||ids.has(r.id))throw Error('รหัสบันทึกงานว่างหรือซ้ำ');ids.add(r.id);
      // Both dates must qualify: editing or receiving payment on an old job never imports it.
      if(!r.date||r.date<cutoff||!day(r.createdAt)||day(r.createdAt)<cutoff)continue;
      const sale=satang(r.sale),paid=Math.min(sale,satang(r.paid));
      const amount=r.status==='จ่ายแล้ว'?sale:paid;
      if(!amount)continue;
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.id));
      const id=prefix+Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
      entries.push({id,type:'income',date:r.date,name:('รับชำระ · '+(r.name||r.reference||r.id)).slice(0,160),amount,recipient:'',note:('จากบันทึกงาน PRINCE IMAGE · '+(r.reference||r.id)+(r.customer?' · '+r.customer:'')+' · อัปเดตอัตโนมัติ').slice(0,500),createdAt:new Date(r.createdAt).toISOString()});
    }
    entries.sort((a,b)=>a.id.localeCompare(b.id));
    const target=data.books.find(b=>b.id==='book-3'),previous=target.entries.filter(managed).slice().sort((a,b)=>a.id.localeCompare(b.id));
    const comparable=e=>({id:e.id,type:e.type,date:e.date,name:e.name,amount:e.amount,recipient:e.recipient||'',note:e.note,createdAt:e.createdAt});
    if(JSON.stringify(previous.map(comparable))===JSON.stringify(entries))return {data,changed:false};
    if(target.entries.filter(e=>!managed(e)).length+entries.length>10000)throw Error('สมุดบัญชีมีรายการเกินขอบเขต');
    const next=structuredClone(data),book=next.books.find(b=>b.id==='book-3');book.entries=book.entries.filter(e=>!managed(e)).concat(entries);return {data:next,changed:true};
  }
  function load(){return new Promise((resolve,reject)=>{
    const callback='princeIncome_'+crypto.randomUUID().replace(/-/g,''),script=document.createElement('script');
    const cleanup=()=>{clearTimeout(timer);delete window[callback];script.remove();};
    const timer=setTimeout(()=>{cleanup();reject(Error('โหลดรายรับจากบันทึกงานไม่สำเร็จ กรุณากดโหลดล่าสุดอีกครั้ง'));},20000);
    window[callback]=payload=>{cleanup();resolve(payload);};script.onerror=()=>{cleanup();reject(Error('เชื่อมต่อบันทึกงานไม่สำเร็จ'));};
    const url=new URL(endpoint);url.searchParams.set('action','list');url.searchParams.set('sheetName','Data Account');url.searchParams.set('callback',callback);url.searchParams.set('_',String(Date.now()));script.src=url.href;document.body.appendChild(script);
  });}
  return {enabled,managed,merge,load};
})();
