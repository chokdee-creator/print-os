/** Revocable bearer devices, scoped ONLY to the three notebooks and their slips. */
function ledgerHash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8).map(n=>('0'+((n+256)%256).toString(16)).slice(-2)).join('');}
function ledgerDeviceKey_(hash){return 'PRINT_NOTEBOOK_DEVICE_'+hash;}
function ledgerDeviceLabel_(label){if(typeof label!=='string'||!label.trim()||label.length>60)throw new Error('กรุณาตั้งชื่ออุปกรณ์ไม่เกิน 60 ตัวอักษร');return label.trim();}
function ledgerDeviceRecords_(){const values=orProperties_().getProperties();return Object.keys(values).filter(k=>k.indexOf('PRINT_NOTEBOOK_DEVICE_')===0).map(k=>JSON.parse(values[k]));}
function ledgerEnroll_(data){
  if(!/^[a-f0-9]{64}$/.test(data.deviceToken||''))throw new Error('ข้อมูลจับคู่อุปกรณ์ไม่ถูกต้อง');const hash=ledgerHash_(data.deviceToken),p=orProperties_(),key=ledgerDeviceKey_(hash),existing=p.getProperty(key);
  if(existing){const old=JSON.parse(existing);if(old.revokedAt)throw new Error('สิทธิ์อุปกรณ์นี้ถูกยกเลิกแล้ว');return {ok:true,device:{id:old.id,label:old.label}};}
  if(ledgerDeviceRecords_().filter(d=>!d.revokedAt).length>=30)throw new Error('จับคู่ได้สูงสุด 30 เครื่อง กรุณายกเลิกเครื่องที่ไม่ใช้ก่อน');
  const now=new Date().toISOString(),record={id:hash,label:ledgerDeviceLabel_(data.label),createdAt:now,lastSeen:now};p.setProperty(key,JSON.stringify(record));return {ok:true,device:{id:hash,label:record.label}};
}
function ledgerDeviceAuth_(token){if(!/^[a-f0-9]{64}$/.test(token||''))throw new Error('DEVICE_REQUIRED');const key=ledgerDeviceKey_(ledgerHash_(token)),raw=orProperties_().getProperty(key);if(!raw)throw new Error('DEVICE_REQUIRED');const record=JSON.parse(raw);if(record.revokedAt)throw new Error('DEVICE_REVOKED');if(Date.now()-Date.parse(record.lastSeen)>3600000){record.lastSeen=new Date().toISOString();orProperties_().setProperty(key,JSON.stringify(record));}return record;}
function ledgerPairCode_(device){
  const p=orProperties_(),values=p.getProperties();Object.keys(values).filter(k=>k.indexOf('PRINT_NOTEBOOK_PAIR_')===0).forEach(k=>{try{const row=JSON.parse(values[k]);if(row.expiresAt<Date.now()||row.createdBy===device.id)p.deleteProperty(k);}catch(e){p.deleteProperty(k);}});
  const code=ledgerHash_(Utilities.getUuid()+Utilities.getUuid()).slice(0,20).toUpperCase(),expiresAt=Math.min(Date.now()+10*60*1000,device.expiresAt||Infinity);p.setProperty('PRINT_NOTEBOOK_PAIR_'+ledgerHash_(code),JSON.stringify({expiresAt,createdBy:device.id,createdViaLogin:device.type==='login'}));return {ok:true,code:code.match(/.{1,5}/g).join('-'),expiresAt};
}
function ledgerRedeem_(data){
  const code=String(data.code||'').replace(/[\s-]/g,'').toUpperCase();if(!/^[A-F0-9]{20}$/.test(code))throw new Error('รหัสจับคู่ไม่ถูกต้องหรือหมดอายุ');const p=orProperties_(),key='PRINT_NOTEBOOK_PAIR_'+ledgerHash_(code),raw=p.getProperty(key);if(!raw)throw new Error('รหัสจับคู่ไม่ถูกต้องหรือหมดอายุ');const pair=JSON.parse(raw);
  if(pair.expiresAt<Date.now()){p.deleteProperty(key);throw new Error('รหัสจับคู่ไม่ถูกต้องหรือหมดอายุ');}
  const source=JSON.parse(p.getProperty(pair.createdViaLogin?'PRINT_NOTEBOOK_LOGIN_'+pair.createdBy:ledgerDeviceKey_(pair.createdBy))||'null');if(!source||source.revokedAt||(source.expiresAt&&source.expiresAt<=Date.now()))throw new Error('รหัสจับคู่ไม่ถูกต้องหรือหมดอายุ');const result=ledgerEnroll_(data);p.deleteProperty(key);return result;
}
function ledgerDeviceBridge_(data){
  const lock=LockService.getScriptLock();let acquired=false;try{
    if(!data||data.action!=='ledgerDevice')throw new Error('คำขอไม่ถูกต้อง');lock.waitLock(30000);acquired=true;
    let result;if(data.command==='pairRedeem')result=ledgerRedeem_(data);else{
      const device=data.loginToken?ledgerLoginAuth_(data.loginToken):ledgerDeviceAuth_(data.deviceToken);
      if(['ledgerGet','ledgerSave','ledgerSlipGet'].includes(data.command))result=ledgerAction_({...data,action:data.command});
      else if(data.command==='pairCreate')result=ledgerPairCode_(device);
      else if(data.command==='deviceList')result={ok:true,currentDevice:device.id,devices:ledgerDeviceRecords_().filter(d=>!d.revokedAt).map(d=>({id:d.id,label:d.label,createdAt:d.createdAt,lastSeen:d.lastSeen,current:d.id===device.id}))};
      else if(data.command==='deviceRevoke'){
        if(!/^[a-f0-9]{64}$/.test(data.deviceId||''))throw new Error('ไม่พบอุปกรณ์');const p=orProperties_(),key=ledgerDeviceKey_(data.deviceId),raw=p.getProperty(key);if(!raw)throw new Error('ไม่พบอุปกรณ์');const target=JSON.parse(raw);target.revokedAt=new Date().toISOString();p.setProperty(key,JSON.stringify(target));result={ok:true,currentRevoked:device.id===target.id};
      }else throw new Error('คำสั่งไม่อยู่ในสิทธิ์อุปกรณ์');
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }catch(error){const code=String(error.message||'');return ContentService.createTextOutput(JSON.stringify({ok:false,loginExpired:code==='LOGIN_EXPIRED',needsPair:code==='DEVICE_REQUIRED'||code==='DEVICE_REVOKED',error:code==='LOGIN_EXPIRED'?'เซสชัน Google หมดอายุ':code==='DEVICE_REVOKED'?'สิทธิ์เครื่องนี้ถูกยกเลิก กรุณาจับคู่อุปกรณ์ใหม่':code==='DEVICE_REQUIRED'?'กรุณาจับคู่อุปกรณ์ก่อนใช้งาน':code})).setMimeType(ContentService.MimeType.JSON);}finally{if(acquired)lock.releaseLock();}
}
