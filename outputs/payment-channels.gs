/** Receiving accounts are shared by both shops. Legacy files remain as migration backups. */
var orPaymentMemo_;
function orPaymentEntry_(){
  if(orPaymentMemo_)return orPaymentMemo_;
  const existing=orReadDelivery_('payment-channels:shared');
  if(existing)return orPaymentMemo_=existing;
  const merged=PaymentChannelData.mergeSettings(['printImage','chokdee'].map(id=>orReadDelivery_('payment-channels:'+id)));
  const entry={channels:merged.channels,selectedKeys:merged.selectedKeys,updatedAt:new Date().toISOString(),migratedFrom:['printImage','chokdee']};
  orWriteDelivery_('payment-channels:shared',entry);
  return orPaymentMemo_=entry;
}
function orPaymentChannels_(store){
  orStore_(store);
  return PaymentChannelData.normalize(orPaymentEntry_().channels||[]);
}
function orPaymentChannelAction_(data){
  const store=orStore_(data.store),key='payment-channels:shared',entry=orPaymentEntry_();
  if(data.action==='getPaymentChannels'&&data.revision&&data.revision===entry.updatedAt)return {ok:true,notModified:true,revision:entry.updatedAt,store:store.id,shared:true};
  let revision=entry.updatedAt||'';
  let channels=PaymentChannelData.normalize(entry.channels||[]),selectedKeys=Array.isArray(entry.selectedKeys)?entry.selectedKeys:null;
  if(data.action==='savePaymentChannels'){
    if(data.selectionOnly){
      PaymentChannelData.select(channels,data.selectedKeys);
      if(!Array.isArray(data.selectedKeys))throw new Error('กรุณาติ๊กเลือกบัญชีรับเงิน');
      selectedKeys=data.selectedKeys;
    }else{
      channels=PaymentChannelData.normalize(data.channels);
      if(selectedKeys){const valid=new Set(channels.map((r,i)=>r.enabled?PaymentChannelData.selectionKey(r,i):null));selectedKeys=selectedKeys.filter(key=>valid.has(key));}
    }
    revision=new Date().toISOString();
    const saved={channels:channels,selectedKeys:selectedKeys,updatedAt:revision};orWriteDelivery_(key,saved);orPaymentMemo_=saved;
  }
  return {ok:true,channels:channels,selectedKeys:selectedKeys,revision:revision,store:store.id,shared:true};
}
function preparePaymentChannelsSetup(){
  orRequireOwner_();
  const book=SpreadsheetApp.openById(prSettings_().spreadsheetId),headers=['ช่องทางชำระเงินล่าสุด','ประวัติรับชำระ','หมายเหตุช่องทางชำระ'];
  ['printImage','chokdee'].forEach(store=>{
    const spec=orStore_(store),sheet=book.getSheetByName(spec.sheet);if(!sheet)throw new Error('ไม่พบชีต '+spec.sheet);
    if(sheet.getMaxColumns()<29)sheet.insertColumnsAfter(sheet.getMaxColumns(),29-sheet.getMaxColumns());
    const current=sheet.getRange(1,27,1,3).getValues()[0];
    current.forEach((v,i)=>{if(v && String(v)!==headers[i])throw new Error('คอลัมน์ใหม่มีข้อมูลเดิม กรุณาตรวจชีต '+spec.sheet);});
    sheet.getRange(1,27,1,3).setValues([headers]);
    console.log(spec.name+': '+Math.max(sheet.getLastRow()-1,0)+' existing rows; payment columns ready; '+orPaymentChannels_(store).length+' receiving channels. No LINE message sent.');
  });
}

function migrateSharedPaymentChannels(){
  orRequireOwner_();
  const entry=orPaymentEntry_();
  console.log('Shared receiving accounts ready: '+entry.channels.length+' accounts; '+(entry.selectedKeys||[]).length+' selected. Both legacy files retained. No payment or LINE message created.');
}
