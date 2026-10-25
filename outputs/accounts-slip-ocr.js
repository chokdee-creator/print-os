/* Local-only receipt OCR. No image or recognized text is sent to an OCR service. */
var AccountSlipOCR=(function(){
  'use strict';
  const assetBase=typeof document==='undefined'?'':new URL('vendor/receipt-ocr/',document.currentScript.src).href;
  let library;
  function parties(lines){
    const recipientLabel=/^(?:ชื่อบัญชีผู้รับ|ชื่อผู้รับ|บัญชีผู้รับ|ผู้รับเงิน|ผู้รับ|โอนให้|โอนไปยัง|ไปยัง|ถึง|to\b|recipient\b|beneficiary\b)\s*[:：\-]?\s*/i;
    const senderLabel=/^(?:ชื่อบัญชีผู้โอน|ชื่อผู้โอน|ผู้โอนเงิน|ผู้โอน|จาก|from\b|sender\b)\s*[:：\-]?\s*/i;
    const stop=/จำนวนเงิน|ยอดเงิน|ยอดโอน|ค่าธรรมเนียม|วันที่|อ้างอิง|หมายเลขรายการ|amount|fee|reference|transaction/i;
    const nonName=/ธนาคาร|กสิกร|ไทยพาณิชย์|กรุงไทย|กรุงเทพ|กรุงศรี|ทหารไทย|ธนชาต|ออมสิน|พร้อมเพย์|promptpay|bank|kbank|scb|krungthai|ttb|account|เลขบัญชี|เลขที่บัญชี|ชื่อบัญชี$|สำเร็จ|successful/i;
    function find(label,opposite){
      const names=[];
      lines.forEach((line,index)=>{
        if(!label.test(line))return;
        for(let offset=0;offset<5&&index+offset<lines.length;offset++){
          let candidate=offset?lines[index+offset]:line.replace(label,'');
          if(offset&&(opposite.test(candidate)||stop.test(candidate)))break;
          candidate=candidate.replace(/^(?:ชื่อบัญชี|ชื่อ)\s*[:：]?\s*/,'').trim();
          if(!candidate||nonName.test(candidate)||/[0-9๐-๙]/.test(candidate)||candidate.length>160)continue;
          if((candidate.match(/[a-zA-Zก-๙]/g)||[]).length<4)continue;
          names.push(candidate);break;
        }
      });
      const unique=[...new Set(names)];return unique.length===1?unique[0]:null;
    }
    const text=lines.join('\n');
    const incoming=/ได้รับเงิน|รับเงินสำเร็จ|รับโอนเงิน|เงินเข้าบัญชี|money received|payment received|received from/i.test(text);
    const outgoing=/โอนเงินสำเร็จ|โอนสำเร็จ|ชำระเงินสำเร็จ|จ่ายเงินสำเร็จ|transfer successful|successful transfer|payment successful|paid to/i.test(text);
    return {recipient:find(recipientLabel,senderLabel),sender:find(senderLabel,recipientLabel),type:incoming===outgoing?null:incoming?'income':'expense'};
  }
  function parse(text){
    const lines=String(text).replace(/ํา/g,'ำ').replace(/[๐-๙]/g,c=>String(c.charCodeAt(0)-3664)).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const positive=/จำนวนเงิน|ยอดโอน|ยอดเงินโอน|ยอดชำระ|ยอดเงิน|จำนวนที่โอน|amount|transfer\s*amount|payment\s*amount|grand\s*total|total/i;
    const excluded=/ค่าธรรมเนียม|ยอดคงเหลือ|คงเหลือ|เลขบัญชี|เลขที่บัญชี|หมายเลข|อ้างอิง|เลขที่รายการ|วันที่|เวลา|fee|balance|account|reference|transaction\s*(id|no)|date|time|vat|tax|subtotal|ส่วนลด|discount/i;
    const currency=/บาท|\bTHB\b|฿/i,candidates=[];
    lines.forEach((line,index)=>{
      const compact=line.replace(/\s/g,'');
      if(excluded.test(line)||excluded.test(compact))return;
      const labelled=positive.test(line)||positive.test(compact);
      const previous=(lines[index-1]||'').replace(/\s/g,'');
      if(!labelled&&excluded.test(previous))return;
      const nearLabel=positive.test(previous);
      const hasCurrency=currency.test(line);
      if(!labelled&&!nearLabel&&!hasCurrency)return;
      const pattern=/(?<![\d.,/\-])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?(?![\d.,/\-])/g;
      for(const match of line.matchAll(pattern)){
        const raw=match[0],decimal=raw.includes('.');
        if(!decimal&&!labelled&&!nearLabel)continue;
        const around=line.slice(Math.max(0,match.index-2),match.index+raw.length+2);
        if(/[-/]/.test(around)||(!decimal&&raw.length>7))continue;
        const amount=Math.round(Number(raw.replace(/,/g,''))*100);
        if(!Number.isSafeInteger(amount)||amount<=0||amount>99999999999)continue;
        const score=(labelled?100:nearLabel?90:60)+(hasCurrency?10:0)+(decimal?5:0);
        candidates.push({amount,score});
      }
    });
    const unique=[...new Set(candidates.sort((a,b)=>b.score-a.score).map(c=>c.amount))];
    const best=candidates[0],ties=best?new Set(candidates.filter(c=>c.score>=best.score-10).map(c=>c.amount)):new Set();
    return {amount:ties.size===1?best.amount:null,candidates:unique.slice(0,6),...parties(lines)};
  }
  function load(){
    if(typeof Tesseract!=='undefined')return Promise.resolve();
    if(!library)library=new Promise((resolve,reject)=>{
      const script=document.createElement('script'),timer=setTimeout(()=>{script.remove();library=null;reject(Error('โหลดตัวอ่านสลิปไม่สำเร็จ'));},20000);
      script.src=new URL('tesseract.min.js',assetBase).href;
      script.onload=()=>{clearTimeout(timer);resolve();};
      script.onerror=()=>{clearTimeout(timer);script.remove();library=null;reject(Error('โหลดตัวอ่านสลิปไม่สำเร็จ'));};
      document.head.appendChild(script);
    });
    return library;
  }
  async function read(blob,{signal,onProgress=()=>{}}={}){
    let worker,timer,stop,finished=false;
    const aborted=()=>{throw new DOMException('Cancelled','AbortError');};
    const work=(async()=>{
      await load();if(signal?.aborted)aborted();
      worker=await Tesseract.createWorker(['tha','eng'],1,{
        workerPath:new URL('worker.min.js',assetBase).href,
        corePath:assetBase,langPath:assetBase.replace(/\/$/,''),workerBlobURL:false,
        logger:m=>{if(!signal?.aborted)onProgress(m.status==='recognizing text'?Math.round(m.progress*100):null);}
      });
      if(finished||signal?.aborted){worker.terminate();aborted();}
      await worker.setParameters({tessedit_pageseg_mode:'3',user_defined_dpi:'300'});
      const result=await worker.recognize(blob);
      if(signal?.aborted)aborted();
      const parsed=parse(result.data.text);
      // Weak recognition is offered for manual choice rather than silently applied.
      if(result.data.confidence<40){parsed.amount=null;parsed.recipient=null;parsed.sender=null;parsed.type=null;}
      return parsed;
    })();
    const cancelled=new Promise((_,reject)=>{
      stop=()=>{worker?.terminate();reject(new DOMException('Cancelled','AbortError'));};
      signal?.addEventListener('abort',stop,{once:true});
      timer=setTimeout(()=>{worker?.terminate();reject(Error('อ่านสลิปนานเกินไป กรุณากรอกยอดเอง'));},60000);
    });
    try{return await Promise.race([work,cancelled]);}
    finally{finished=true;clearTimeout(timer);signal?.removeEventListener('abort',stop);worker?.terminate();}
  }
  return {parse,read};
})();
if(typeof module!=='undefined')module.exports=AccountSlipOCR;
