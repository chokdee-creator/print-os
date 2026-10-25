/* Recipient/sender extraction uses explicit labels and OCR coordinates, never notebook names. */
var AccountSlipNames=(function(){
  'use strict';
  const labels={recipient:['ชื่อบัญชีผู้รับโอนเงิน','ชื่อบัญชีผู้รับโอน','ชื่อบัญชีผู้รับเงิน','ชื่อบัญชีผู้รับ','ชื่อผู้รับโอนเงิน','ชื่อผู้รับโอน','ชื่อผู้รับเงิน','ชื่อผู้รับ','บัญชีปลายทาง','บัญชีผู้รับ','ผู้รับโอนเงิน','ผู้รับเงิน','ผู้รับโอน','ผู้รับ','โอนเข้าบัญชี','โอนไปยัง','โอนให้','ไปยัง','ถึง','recipient','beneficiary','receiver','payee','to'],sender:['ชื่อบัญชีผู้โอน','ชื่อบัญชีผู้ส่ง','ชื่อผู้โอน','ชื่อผู้ส่ง','บัญชีต้นทาง','ผู้โอนเงิน','ผู้ส่งเงิน','ผู้โอน','ผู้ส่ง','ผู้จ่าย','ผู้ชำระ','จาก','sender','payer','from']};
  const expressions=Object.fromEntries(Object.entries(labels).map(([role,items])=>[role,new RegExp('^(?:'+items.map(s=>/[a-z]/.test(s)?s+'\\b':[...s].join('\\s*')).join('|')+')\\s*(?:\\((?:sender|receiver|recipient|from|to)\\))?\\s*[:：\\-]?\\s*','i')]));
  const tidy=s=>String(s||'').replace(/ํา/g,'ำ').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\s+/g,' ').trim().replace(/^น\s*า\s*ง\s*ส\s*า\s*ว\s*/,'นางสาว ').replace(/^น\s*า\s*ย\s*/,'นาย ').trim();
  const stop=/จำนวนเงิน|ยอดเงิน|ยอดโอน|ค่าธรรมเนียม|วันที่|อ้างอิง|หมายเลขรายการ|บันทึกช่วยจำ|กรุณา|โปรด|ขอบคุณ|รายละเอียด|ตรวจสอบ|สแกน|please|thank|scan|receipt|slip|amount|fee|reference|transaction|memo|note/i;
  const bank=/^(?:ธนาคาร|พร้อมเพย์|promptpay|bank\b|kbank\b|scb\b|krungthai\b|ttb\b|ออมสิน$|กสิกรไทย$|ไทยพาณิชย์$|กรุงไทย$|กรุงเทพ$|กรุงศรี$|ชื่อบัญชี$|เลข(?:ที่)?บัญชี|account\b)/i;
  const title=/^(?:นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|บริษัท|ห้างหุ้นส่วน|Mr\.?\s|Mrs\.?\s|Ms\.?\s)/i;
  const titleOnly=/^(?:นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|Mr\.?|Mrs\.?|Ms\.?)$/i;
  function role(line){for(const [key,expression] of Object.entries(expressions))if(expression.test(tidy(line)))return key;return null;}
  function name(line){
    let value=tidy(line).replace(/^(?:ชื่อบัญชี|ชื่อ)\s*[:：]?\s*/,'').replace(/\s*(?:ธนาคาร|เลข(?:ที่)?บัญชี|[xX*•]{2,}[-\d xX*•]*\d).*$/,'').trim();
    const compact=value.replace(/\s/g,'');
    if(!value||value.length>160||bank.test(value)||bank.test(compact)||stop.test(value)||stop.test(compact)||role(value)||/สำเร็จ|successful|โอนเงิน|รับเงิน|บาท|\bTHB\b|[\d๐-๙]/i.test(value))return null;
    if((value.match(/[a-zA-Zก-๙]/g)||[]).length<4||/^[xX*• .-]+$/.test(value))return null;
    return value;
  }
  function incomplete(value){return value.replace(title,'').trim().split(/\s+/).filter(Boolean).length<2;}
  function textFields(lines){
    const found={recipient:[],sender:[]};
    lines.forEach((line,index)=>{
      const kind=role(line);if(!kind)return;
      const inline=tidy(line).replace(expressions[kind],'');
      for(let offset=0;offset<9&&index+offset<lines.length;offset++){
        const raw=offset?lines[index+offset]:inline;
        if(offset&&(role(raw)||stop.test(raw)||stop.test(raw.replace(/\s/g,''))))break;
        let candidate=name(raw),consumed=0;
        if(titleOnly.test(raw)&&name(lines[index+offset+1])){candidate=raw+' '+name(lines[index+offset+1]);consumed=1;}
        if(!candidate)continue;
        const following=lines[index+offset+consumed+1];
        if(incomplete(candidate)&&following&&!role(following)&&!title.test(following)&&name(following))candidate+=' '+name(following);
        if(titleOnly.test(candidate))continue;
        found[kind].push(candidate);break;
      }
    });
    return found;
  }
  function segments(tsv){
    const groups=new Map();
    for(const row of String(tsv||'').split('\n').slice(1)){
      const c=row.split('\t');if(c.length<12||c[0]!=='5'||!c.slice(11).join('\t').trim())continue;
      const word={x:+c[6],y:+c[7],w:+c[8],h:+c[9],confidence:+c[10],text:tidy(c.slice(11).join(' '))};
      if(![word.x,word.y,word.w,word.h,word.confidence].every(Number.isFinite))continue;
      const key=c.slice(1,5).join(':');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(word);
    }
    const result=[];
    for(const words of groups.values()){
      words.sort((a,b)=>a.x-b.x);let current=[];
      const flush=()=>{if(!current.length)return;const x=current[0].x,y=Math.min(...current.map(w=>w.y)),right=Math.max(...current.map(w=>w.x+w.w)),bottom=Math.max(...current.map(w=>w.y+w.h));let text='';current.forEach((word,index)=>{const prev=current[index-1],tight=prev&&/[ก-๙]$/.test(prev.text)&&/^[ก-๙]/.test(word.text)&&word.x-prev.x-prev.w<Math.max(3,Math.max(prev.h,word.h)*.22);text+=(index&&!tight?' ':'')+word.text;});result.push({x,y,w:right-x,h:bottom-y,text,confidence:current.reduce((n,w)=>n+w.confidence,0)/current.length});current=[];};
      for(const word of words){const prev=current.at(-1);if(prev&&word.x-prev.x-prev.w>Math.max(35,Math.max(prev.h,word.h)*1.5))flush();current.push(word);}flush();
    }
    return result.sort((a,b)=>a.y-b.y||a.x-b.x);
  }
  function spatialFields(parts){
    const found={recipient:[],sender:[]};
    const anchors=parts.map(p=>({...p,role:role(p.text)})).filter(p=>p.role);
    for(const anchor of anchors){
      const inline=name(tidy(anchor.text).replace(expressions[anchor.role],''));
      if(inline&&!titleOnly.test(inline)&&anchor.confidence>=45){found[anchor.role].push(inline);continue;}
      const parallel=anchors.filter(p=>p.role!==anchor.role&&Math.abs(p.y-anchor.y)<Math.max(p.h,anchor.h)*2&&Math.abs(p.x-anchor.x)>anchor.h*3);
      const side=parallel[0],boundary=side?(side.x+anchor.x)/2:null;
      const nearby=parts.filter(p=>{
        if(p.y<anchor.y+anchor.h*.5||p.y-anchor.y>Math.max(240,anchor.h*13)||p.confidence<45)return false;
        if(side&&(anchor.x<side.x?p.x>=boundary:p.x<boundary))return false;
        return Math.abs(p.x-anchor.x)<Math.max(100,anchor.h*6);
      });
      for(const part of nearby){
        if(role(part.text)||stop.test(part.text))break;
        let candidate=name(part.text),consumed=0;
        const after=nearby[nearby.indexOf(part)+1];
        if(titleOnly.test(part.text)&&after&&after.y-part.y<part.h*2.5&&name(after.text)){candidate=part.text+' '+name(after.text);consumed=1;}
        if(!candidate)continue;
        if(inline&&titleOnly.test(inline)&&!title.test(candidate))candidate=inline+' '+candidate;
        const next=nearby[nearby.indexOf(part)+consumed+1];
        if(incomplete(candidate)&&next&&next.y-part.y<Math.max(part.h,next.h)*2.5&&!title.test(next.text)&&name(next.text))candidate+=' '+name(next.text);
        if(titleOnly.test(candidate))continue;
        found[anchor.role].push(candidate);break;
      }
    }
    return found;
  }
  function extract(text,tsv){
    const lines=String(text||'').split(/\r?\n/).map(tidy).filter(Boolean),plain=textFields(lines),parts=segments(tsv),spatial=spatialFields(parts);
    const choose=items=>{const unique=[...new Set(items)];return unique.length===1?unique[0]:null;};
    // Coordinates take precedence when columns have been merged into the plain text.
    const fragmented=value=>!!value&&value.replace(title,'').split(/\s+/).filter(s=>s.length>0&&s.length<3).length>=2;
    const compact=value=>String(value||'').replace(/\s/g,'').toLowerCase();
    function readable(value,alternatives){
      const matching=alternatives.filter(n=>compact(n)===compact(value)&&!fragmented(n));
      if(matching.length)return matching[0];
      if(!fragmented(value))return value;
      const prefix=value.match(title)?.[0]||'',body=value.slice(prefix.length);
      // Remove only artificial gaps; never invent or replace characters in a person's name.
      return /^[ก-๙ *•.]+$/.test(body)?prefix.trim()+' '+body.replace(/\s/g,''):value;
    }
    const rawRecipient=choose(spatial.recipient.length?spatial.recipient:plain.recipient),rawSender=choose(spatial.sender.length?spatial.sender:plain.sender);
    const recipient=rawRecipient?readable(rawRecipient,plain.recipient):null,sender=rawSender?readable(rawSender,plain.sender):null;
    const candidates=[...new Set([...spatial.recipient,...plain.recipient,...parts.filter(p=>p.confidence>=45&&title.test(p.text)).map(p=>name(p.text)),...lines.filter(s=>title.test(s)).map(name)].filter(Boolean))].filter(s=>s!==sender&&!titleOnly.test(s)).slice(0,4);
    return {recipient,sender,nameCandidates:candidates.map(n=>readable(n,[])),needsNameRetry:fragmented(rawRecipient)||fragmented(rawSender),spatialRecipient:!!recipient&&spatial.recipient.includes(rawRecipient),spatialSender:!!sender&&spatial.sender.includes(rawSender)};
  }
  return {extract,segments};
})();
if(typeof module!=='undefined')module.exports=AccountSlipNames;
