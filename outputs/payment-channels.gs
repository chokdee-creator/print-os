/** Payment details are private owner settings, separated by store. */
function orPaymentChannels_(store){
  const entry=orReadDelivery_('payment-channels:'+orStore_(store).id);
  return PaymentChannelData.normalize(entry && entry.channels || []);
}
function orPaymentChannelAction_(data){
  const store=orStore_(data.store),key='payment-channels:'+store.id,entry=orReadDelivery_(key)||{};
  let channels=orPaymentChannels_(store.id),selectedKeys=Array.isArray(entry.selectedKeys)?entry.selectedKeys:null;
  if(data.action==='savePaymentChannels'){
    if(data.selectionOnly){
      PaymentChannelData.select(channels,data.selectedKeys);
      if(!Array.isArray(data.selectedKeys))throw new Error('กรุณาติ๊กเลือกบัญชีรับเงิน');
      selectedKeys=data.selectedKeys;
    }else{
      channels=PaymentChannelData.normalize(data.channels);
      if(selectedKeys){const valid=new Set(channels.map((r,i)=>r.enabled?PaymentChannelData.selectionKey(r,i):null));selectedKeys=selectedKeys.filter(key=>valid.has(key));}
    }
    orWriteDelivery_(key,{channels:channels,selectedKeys:selectedKeys,updatedAt:new Date().toISOString()});
  }
  return {ok:true,channels:channels,selectedKeys:selectedKeys,store:store.id};
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
