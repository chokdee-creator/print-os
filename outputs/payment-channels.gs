/** Payment details are private owner settings, separated by store. */
function orPaymentChannels_(store){
  const entry=orReadDelivery_('payment-channels:'+orStore_(store).id);
  return PaymentChannelData.normalize(entry && entry.channels || []);
}
function orPaymentChannelAction_(data){
  const store=orStore_(data.store);
  if(data.action==='savePaymentChannels'){
    const channels=PaymentChannelData.normalize(data.channels);
    orWriteDelivery_('payment-channels:'+store.id,{channels:channels,updatedAt:new Date().toISOString()});
    return {ok:true,channels:channels,store:store.id};
  }
  return {ok:true,channels:orPaymentChannels_(store.id),store:store.id};
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
