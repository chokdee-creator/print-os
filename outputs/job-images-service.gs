/* Store one compressed job reference image, privately, with retry deduplication. */
function jobImageSave_(data,existing){
  if(!Object.prototype.hasOwnProperty.call(data,'jobImage'))return String(existing||'');
  var image=data.jobImage;
  if(image===null)return '';
  if(!image||typeof image!=='object')throw new Error('ข้อมูลรูปงานไม่ถูกต้อง');
  if(!data.jobImageDataUrl)return String(existing||'');
  var match=/^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(data.jobImageDataUrl));
  if(!match||!/^[a-zA-Z0-9-]{8,80}$/.test(String(image.uploadKey||'')))throw new Error('ชนิดรูปงานไม่ถูกต้อง');
  var bytes=Utilities.base64Decode(match[2]);if(bytes.length>700*1024)throw new Error('รูปงานต้องไม่เกิน 700 KB หลังบีบอัด');
  var folder=getOrCreateFolder_('Print Job Reference Images'),ext=match[1]==='jpeg'?'jpg':match[1];
  var name=sanitizeFileNamePart_(data.sheetName||DEFAULT_SHEET_NAME)+'-'+sanitizeFileNamePart_(data.id)+'-'+image.uploadKey+'.'+ext;
  var found=folder.getFilesByName(name),file=found.hasNext()?found.next():folder.createFile(Utilities.newBlob(bytes,'image/'+match[1],name));
  return JSON.stringify({name:String(image.name||name).slice(0,200),type:'image/'+match[1],bytes:bytes.length,width:Number(image.width)||0,height:Number(image.height)||0,uploadKey:image.uploadKey,url:file.getUrl(),fileId:file.getId(),pending:false});
}
