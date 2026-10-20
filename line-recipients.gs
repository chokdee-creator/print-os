/** Recipient addresses stay on the server. Only owner-authenticated RPC may manage them. */
function orRecipients_() {
  const saved=JSON.parse(orProperties_().getProperty('PRINT_REPORT_RECIPIENTS') || '[]');
  if(!Array.isArray(saved)) throw new Error('ข้อมูลบัญชีผู้รับไม่ถูกต้อง');
  return [{id:'owner',name:'วินDS (บัญชีเดิมของฉัน)',target:prSettings_().target}].concat(saved);
}
function orRecipient_(id) {
  if(id===undefined) id='owner';
  const recipient=orRecipients_().find(r=>r.id===id);
  if(!recipient || !/^U[0-9a-f]{32}$/.test(recipient.target || '')) throw new Error('ไม่พบผู้รับที่ยืนยันไว้ กรุณาโหลดบัญชี LINE อีกครั้ง');
  return recipient;
}
function orRecipientAction_(data) {
  if(data.action==='recipients') return {ok:true,recipients:orRecipients_().map(r=>({id:r.id,name:r.name}))};
  if(data.action==='addRecipient') {
    const target=String(data.userId || '').trim();
    if(!/^U[0-9a-f]{32}$/.test(target)) throw new Error('ต้องใช้ User ID จาก Messaging API ซึ่งขึ้นต้น U และมี 33 ตัว ไม่ใช่ LINE ID หรือรหัสจากหน้าแชท');
    const config=prSettings_();prValidateLine_(config);
    const response=UrlFetchApp.fetch('https://api.line.me/v2/bot/profile/'+encodeURIComponent(target),{
      method:'get',headers:{Authorization:'Bearer '+config.token},muteHttpExceptions:true
    });
    if(response.getResponseCode()!==200) throw new Error('ยังยืนยันบัญชีไม่ได้ ให้เพิ่มเพื่อน OA ปริ้นอิมเมจก่อน และตรวจ User ID อีกครั้ง');
    const profile=JSON.parse(response.getContentText());
    if(profile.userId!==target || !profile.displayName) throw new Error('ข้อมูลบัญชีจาก LINE ไม่ตรงกัน');
    const all=orRecipients_(),existing=all.find(r=>r.target===target);
    if(existing) return {ok:true,recipient:{id:existing.id,name:existing.name}};
    if(all.length>=20) throw new Error('เพิ่มผู้รับได้สูงสุด 20 บัญชี');
    const recipient={id:Utilities.getUuid(),name:profile.displayName,target:target};
    const saved=all.filter(r=>r.id!=='owner');saved.push(recipient);
    const json=JSON.stringify(saved);
    if(Utilities.newBlob(json).getBytes().length>8000) throw new Error('ข้อมูลบัญชีผู้รับเกินขอบเขต');
    orProperties_().setProperty('PRINT_REPORT_RECIPIENTS',json);
    return {ok:true,recipient:{id:recipient.id,name:recipient.name}};
  }
  if(data.action==='removeRecipient') {
    if(data.recipientId==='owner') throw new Error('ไม่สามารถลบบัญชีผู้รับเดิมได้');
    const all=orRecipients_().filter(r=>r.id!=='owner');
    const remaining=all.filter(r=>r.id!==data.recipientId);
    if(remaining.length===all.length) throw new Error('ไม่พบบัญชีผู้รับ');
    orProperties_().setProperty('PRINT_REPORT_RECIPIENTS',JSON.stringify(remaining));
    return {ok:true};
  }
  throw new Error('คำขอจัดการผู้รับไม่ถูกต้อง');
}
