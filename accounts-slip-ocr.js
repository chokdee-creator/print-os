/* Local-only receipt OCR. No image or recognized text is sent to an OCR service. */
var AccountSlipOCR=(function(){
  'use strict';
  const assetBase=typeof document==='undefined'?'':new URL('vendor/receipt-ocr/',document.currentScript.src).href;
  let library;
  const Names=typeof AccountSlipNames!=='undefined'?AccountSlipNames:typeof require==='function'?require('./accounts-slip-names.js'):null;
  function transactionType(lines){
    const status=lines.map(line=>line.replace(/\s/g,'').toLowerCase());
    const failed=/ไม่สำเร็จ|ยกเลิก|ล้มเหลว|รอดำเนินการ|unsuccessful|failed|cancelled|canceled|pending/;
    if(status.some(line=>failed.test(line)))return null;
    const incoming=status.some(line=>/ได้รับเงิน|รับเงินสำเร็จ|รับโอนเงิน|เงินเข้าบัญชี|moneyreceived|paymentreceived|receivedfrom/.test(line));
    const outgoing=status.some(line=>/โอนเงินสำเร็จ|โอนสำเร็จ|ชำระเงินสำเร็จ|จ่ายเงินสำเร็จ|จ่ายบิลสำเร็จ|จ่ายบิลเรียบร้อย|ชำระบิลสำเร็จ|ทำรายการจ่ายบิลสำเร็จ|transfersuccessful|successfultransfer|paymentsuccessful|paymentcompleted|billpaid|paidto/.test(line));
    return incoming===outgoing?null:incoming?'income':'expense';
  }
  function parties(lines,tsv){
    return {...Names.extract(lines.join('\n'),tsv),type:transactionType(lines)};
  }
  function parse(text,tsv){
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
    return {amount:ties.size===1?best.amount:null,candidates:unique.slice(0,6),...parties(lines,tsv)};
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
  async function prepareImage(blob){
    const image=await createImageBitmap(blob);
    try{
      const scale=Math.min(Math.max(1,1400/image.width),3200/Math.max(image.width,image.height),Math.sqrt(6000000/(image.width*image.height)));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
      const context=canvas.getContext('2d',{willReadFrequently:true});context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      const pixels=context.getImageData(0,0,canvas.width,canvas.height);for(let n=0;n<pixels.data.length;n+=4){const grey=.299*pixels.data[n]+.587*pixels.data[n+1]+.114*pixels.data[n+2],value=Math.max(0,Math.min(255,(grey-128)*1.12+128));pixels.data[n]=pixels.data[n+1]=pixels.data[n+2]=value;}context.putImageData(pixels,0,0);
      return await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(Error('เตรียมภาพไม่สำเร็จ')),'image/png'));
    }finally{image.close();}
  }
  function interpreted(data){
    const parsed=parse(data.text,data.tsv);
    if(data.confidence<40){parsed.amount=null;parsed.type=null;if(!parsed.spatialRecipient)parsed.recipient=null;if(!parsed.spatialSender)parsed.sender=null;}
    return parsed;
  }
  function merge(first,second){
    const combined={...first,candidates:[...new Set([...first.candidates,...second.candidates])].slice(0,6),nameCandidates:[...new Set([...first.nameCandidates,...second.nameCandidates])].slice(0,4)};
    for(const key of ['amount','type','recipient','sender']){const flag=key==='recipient'?'spatialRecipient':key==='sender'?'spatialSender':null;
      if(flag&&first[key]&&second[key]&&first[key].replace(/\s/g,'')===second[key].replace(/\s/g,'')){combined[key]=first.needsNameRetry&&!second.needsNameRetry?second[key]:first[key];continue;}
      combined[key]=first[key]&&second[key]&&first[key]!==second[key]?(flag&&first[flag]&&!second[flag]?first[key]:flag&&second[flag]&&!first[flag]?second[key]:null):first[key]||second[key];}
    combined.nameCandidates=combined.nameCandidates.filter(n=>n!==combined.sender);return combined;
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
      let image;try{image=await prepareImage(blob);}catch(error){image=blob;}if(signal?.aborted)aborted();
      const result=await worker.recognize(image,{}, {text:true,tsv:true});
      if(signal?.aborted)aborted();
      const parsed=interpreted(result.data);
      if(parsed.recipient&&parsed.sender&&!parsed.needsNameRetry)return parsed;
      await worker.setParameters({tessedit_pageseg_mode:'11'});
      const retry=await worker.recognize(image,{}, {text:true,tsv:true});if(signal?.aborted)aborted();
      return merge(parsed,interpreted(retry.data));
    })();
    const cancelled=new Promise((_,reject)=>{
      stop=()=>{worker?.terminate();reject(new DOMException('Cancelled','AbortError'));};
      signal?.addEventListener('abort',stop,{once:true});
      timer=setTimeout(()=>{worker?.terminate();reject(Error('อ่านสลิปนานเกินไป กรุณากรอกยอดเอง'));},60000);
    });
    try{return await Promise.race([work,cancelled]);}
    finally{finished=true;clearTimeout(timer);signal?.removeEventListener('abort',stop);worker?.terminate();}
  }
  return {parse,read,merge};
})();
if(typeof module!=='undefined')module.exports=AccountSlipOCR;
