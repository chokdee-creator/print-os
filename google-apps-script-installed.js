const DEFAULT_SHEET_NAME = "Data Account";

function doPost(e) {
  const data = parsePayload_(e);
  if (data.action === "ledgerDevice") return ledgerDeviceBridge_(data);
  if (data.action === "outstandingBridge") return outstandingBridge_(data);
  if (data.action === "saveProfile") {
    const profile = saveProfile_(data.profile || data);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, profile: profile }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (data.action === "vaultSave") {
    const vault = saveVault_(data);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, vault: vault }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (data.action === "vaultBackupDrive") {
    const backup = backupVaultToDrive_(data);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, backup: backup }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const jobLock=LockService.getScriptLock();jobLock.waitLock(30000);
  try {
  const sheet = getSheet_(data.sheetName);
  jobReferenceRows_(sheet);
  const rowIndex = findRowById_(sheet, data.id);
  if (data.action === "delete") {
    if (rowIndex) sheet.deleteRow(rowIndex);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, deleted: Boolean(rowIndex), sheetName: sheet.getName() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const existingValues = rowIndex
    ? sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0]
    : [];
  const reference=jobReferenceReserve_(sheet,[{id:data.id,date:jobReferenceDate_(data.date,data.createdAt),category:data.category,createdAt:data.createdAt,reference:String(existingValues[29]||'')}])[0];
  const row = buildRow_(data, existingValues);
  row.push(reference,jobImageSave_(data,existingValues[30]));

  if (rowIndex) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, sheetName: sheet.getName(), reference:reference }))
    .setMimeType(ContentService.MimeType.JSON);
  } finally {jobLock.releaseLock();}
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  if (params.action === "outstandingOwner") return outstandingOwnerPage_();
  if (params.action === "vaultLoad") {
    const payload = {
      ok: true,
      sheetName: sanitizeSheetName_(params.sheetName) || "SecureVault",
      vault: getVault_(params.sheetName, params.id)
    };
    const json = JSON.stringify(payload);
    if (params.callback) {
      return ContentService
        .createTextOutput(params.callback + "(" + json + ");")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  }
  if (params.action === "profile") {
    const payload = {
      ok: true,
      sheetName: "Profile",
      profile: getProfile_()
    };
    const json = JSON.stringify(payload);
    if (params.callback) {
      return ContentService
        .createTextOutput(params.callback + "(" + json + ");")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  }
  if (params.action === "list") {
    const sheet = getSheet_(params.sheetName);
    const listLock=LockService.getScriptLock();listLock.waitLock(30000);
    let rows;try{rows=jobReferenceRows_(sheet);}finally{listLock.releaseLock();}
    const payload = {
      ok: true,
      sheetName: sheet.getName(),
      referenceVersion:1,
      records: rows.filter(row => row[0] || row[6])
    };
    const json = JSON.stringify(payload);
    if (params.callback) {
      return ContentService
        .createTextOutput(params.callback + "(" + json + ");")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: "print-job-tracker" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Missing POST body");
  }
  return JSON.parse(e.postData.contents);
}

function buildRow_(data, existingValues) {
  const paidAmount = Math.min(Number(data.paidAmount) || 0, Number(data.saleTotal) || 0);
  const balanceTotal = Math.max((Number(data.saleTotal) || 0) - paidAmount, 0);
  const slipIndex = existingValues.length >= 25 ? 20 : 19;
  const existingSlipUrl = String(existingValues[slipIndex] || "").startsWith("http") ? existingValues[slipIndex] : "";
  const slipUrl = data.paymentSlipDataUrl
    ? savePaymentSlip_(data)
    : (data.paymentSlipUrl || existingSlipUrl);

  return [
    data.id || "",
    data.date || "",
    data.category || "",
    data.customerType || "",
    data.customerName || "",
    data.paymentStatus || (balanceTotal <= 0 && Number(data.saleTotal) > 0 ? "จ่ายแล้ว" : "ค้างจ่าย"),
    data.name || "",
    Number(data.width) || 0,
    Number(data.length) || 0,
    Number(data.quantity) || 1,
    Number(data.area) || 0,
    Number(data.saleRate) || 0,
    Number(data.materialCost) || 0,
    Number(data.inkCost) || 0,
    Number(data.electricityCost) || 0,
    Number(data.maintenanceCost) || 0,
    Number(data.costRate) || 0,
    Number(data.saleTotal) || 0,
    paidAmount,
    balanceTotal,
    slipUrl,
    Number(data.costTotal) || 0,
    Number(data.profit) || 0,
    data.createdAt || new Date().toISOString(),
    data.updatedAt || "",
    Number(data.discount) || 0,
    data.paymentMethod===undefined?String(existingValues[26]||''):PaymentChannelData.methods.includes(data.paymentMethod)?data.paymentMethod:'',
    data.paymentHistory===undefined?String(existingValues[27]||'[]'):JSON.stringify(PaymentChannelData.readHistory(data.paymentHistory)),
    data.paymentMethodNote===undefined?String(existingValues[28]||''):String(data.paymentMethodNote||'').slice(0,300)
  ];
}

function findRowById_(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return null;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i += 1) {
    if (ids[i][0] === id) return i + 2;
  }
  return null;
}

function getSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const targetSheetName = sanitizeSheetName_(sheetName) || DEFAULT_SHEET_NAME;
  let sheet = spreadsheet.getSheetByName(targetSheetName);
  const headers = [
    "ID",
    "วันที่",
    "หมวดหมู่",
    "ประเภทลูกค้า",
    "รายชื่อลูกค้า",
    "สถานะชำระเงิน",
    "รายชื่องาน",
    "กว้าง (เมตร)",
    "ยาว (เมตร)",
    "จำนวนชิ้นงาน",
    "พื้นที่ (ตร.ม.)",
    "ราคาขาย/ตร.ม.",
    "ค่าวัสดุ/ตร.ม.",
    "ค่าหมึก/ตร.ม.",
    "ค่าไฟ/ตร.ม.",
    "ค่า Maintenance เครื่องพิมพ์/ตร.ม.",
    "ต้นทุน/ตร.ม.",
    "ราคาขาย",
    "ลูกค้าชำระ",
    "ค้างเหลือ",
    "ลิงก์สลิป",
    "ต้นทุน",
    "กำไร",
    "เวลาบันทึก",
    "เวลาแก้ไขล่าสุด",
    "ส่วนลด",
    "ช่องทางชำระเงินล่าสุด",
    "ประวัติรับชำระ",
    "หมายเหตุช่องทางชำระ",
    "เลขอ้างอิง",
    "รูปงาน"
  ];

  if (!sheet) {
    sheet = spreadsheet.insertSheet(targetSheetName);
  }

  if(sheet.getMaxColumns()<headers.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),headers.length-sheet.getMaxColumns());
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    const currentCustomerNameHeader = sheet.getRange(1, 5).getValue();
    if (currentCustomerNameHeader !== "รายชื่อลูกค้า") sheet.insertColumnAfter(4);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

function sanitizeSheetName_(value) {
  const name = String(value || "").trim();
  if (!name) return "";
  return name.replace(/[\\/?*[\]:]/g, "").slice(0, 100);
}

function getProfile_() {
  const sheet = getProfileSheet_();
  const values = sheet.getLastRow() < 2
    ? []
    : sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  const profile = {};
  values.forEach(function(row) {
    const key = String(row[0] || "").trim();
    if (key) profile[key] = row[1] || "";
  });
  return profile;
}

function saveProfile_(profile) {
  const sheet = getProfileSheet_();
  const keys = ["shopName", "displayName", "address", "taxId", "phone", "email", "website"];
  const labels = {
    shopName: "ชื่อร้าน/บริษัท",
    displayName: "ชื่อที่แสดงบนเอกสาร",
    address: "ที่อยู่ร้าน",
    taxId: "เลขผู้เสียภาษี",
    phone: "เบอร์โทร",
    email: "อีเมล",
    website: "เว็บไซต์/เพจ"
  };
  const rows = keys.map(function(key) {
    return [key, profile[key] || "", labels[key] || ""];
  });
  sheet.clear();
  sheet.getRange(1, 1, 1, 3).setValues([["key", "value", "label"]]).setFontWeight("bold");
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  sheet.setFrozenRows(1);
  return getProfile_();
}

function getProfileSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName("Profile");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("Profile");
    sheet.getRange(1, 1, 1, 3).setValues([["key", "value", "label"]]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function saveVault_(data) {
  const sheet = getVaultSheet_(data.sheetName);
  const targetId = data.id || "secure-vault";
  const row = [
    targetId,
    data.updatedAt || new Date().toISOString(),
    Number(data.itemCount) || 0,
    data.encryptedVault || "",
    data.source || ""
  ];
  const rowIndex = findVaultRowById_(sheet, targetId);
  if (rowIndex) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  return {
    id: row[0],
    updatedAt: row[1],
    itemCount: row[2]
  };
}

function getVault_(sheetName, id) {
  const sheet = getVaultSheet_(sheetName);
  if (sheet.getLastRow() < 2) return null;
  const targetId = id || "secure-vault";
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  for (let i = 0; i < rows.length; i += 1) {
    if (String(rows[i][0] || "") === targetId) {
      return {
        id: rows[i][0],
        updatedAt: rows[i][1],
        itemCount: rows[i][2],
        encryptedVault: rows[i][3],
        source: rows[i][4]
      };
    }
  }
  return null;
}

function findVaultRowById_(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return null;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < values.length; i += 1) {
    if (String(values[i][0] || "") === String(id)) return i + 2;
  }
  return null;
}

function getVaultSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const targetSheetName = sanitizeSheetName_(sheetName) || "SecureVault";
  let sheet = spreadsheet.getSheetByName(targetSheetName);
  const headers = ["ID", "updatedAt", "itemCount", "encryptedVault", "source"];
  if (!sheet) sheet = spreadsheet.insertSheet(targetSheetName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

function backupVaultToDrive_(data) {
  const encryptedVault = String(data.encryptedVault || "");
  if (!encryptedVault) throw new Error("Missing encryptedVault");

  const updatedAt = data.updatedAt || new Date().toISOString();
  const account = data.account || {};
  const accountId = sanitizeFileNamePart_(account.id || data.accountId || data.id || "secure-vault");
  const accountLabel = sanitizeFileNamePart_(account.email || account.displayName || accountId);
  const rootFolder = getOrCreateFolder_(data.folderName || "Secure Vault Backups");
  const folder = getOrCreateSubFolder_(rootFolder, accountLabel);
  const payload = JSON.stringify({
    id: data.id || "secure-vault",
    account: {
      id: account.id || accountId,
      email: account.email || "",
      displayName: account.displayName || "",
      storageKey: account.storageKey || ""
    },
    accounts: data.accounts || [],
    updatedAt: updatedAt,
    itemCount: Number(data.itemCount) || 0,
    encryptedVault: encryptedVault,
    source: data.source || "",
    note: "Encrypted Secure Vault backup. Restore with the original master password."
  }, null, 2);

  const latestName = accountId + "-latest.json";
  const dailyName = accountId + "-" + Utilities.formatDate(new Date(updatedAt), Session.getScriptTimeZone(), "yyyy-MM-dd") + ".json";
  const latest = upsertTextFile_(folder, latestName, payload);
  const daily = upsertTextFile_(folder, dailyName, payload);

  return {
    folderName: folder.getName(),
    latestName: latest.getName(),
    latestUrl: latest.getUrl(),
    dailyName: daily.getName(),
    dailyUrl: daily.getUrl()
  };
}

function upsertTextFile_(folder, fileName, content) {
  const files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    const file = files.next();
    file.setContent(content);
    return file;
  }
  return folder.createFile(fileName, content, MimeType.JSON);
}

function getOrCreateSubFolder_(parentFolder, name) {
  const folders = parentFolder.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parentFolder.createFolder(name);
}

function sanitizeFileNamePart_(value) {
  return String(value || "secure-vault")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "secure-vault";
}

function savePaymentSlip_(data) {
  const match = String(data.paymentSlipDataUrl || "").match(/^data:(.+);base64,(.+)$/);
  if (!match) return data.paymentSlipUrl || "";

  const folder = getOrCreateFolder_("Print Job Payment Slips");
  const extension = extensionFromMime_(match[1]);
  const safeName = String(data.paymentSlipName || "payment-slip").replace(/[\\/:*?"<>|]/g, "-");
  const fileName = [
    data.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
    data.id || Utilities.getUuid(),
    safeName.endsWith(extension) ? safeName : safeName + extension
  ].join("-");
  const blob = Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function getOrCreateFolder_(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function extensionFromMime_(mimeType) {
  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf"
  };
  return map[mimeType] || "";
}


/* Display references are separate from immutable internal job IDs. */
var JobReferences=(function(){
  function prefix(category){
    var value=String(category||'').trim().toLowerCase();
    return ['ไวนิล','vinyl','v'].indexOf(value)>=0?'v':['สติ๊กเกอร์','สติกเกอร์','sticker','s'].indexOf(value)>=0?'s':'o';
  }
  function parse(value){
    var match=/^([vso]\d{6})(\d{2,})$/.exec(String(value||''));
    return match&&Number(match[2])>0?{stem:match[1],sequence:Number(match[2])}:null;
  }
  function stem(record){
    var value=String(record.date||'').slice(0,10),match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if(!match||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw new Error('วันที่งานไม่ถูกต้อง ไม่สามารถออกเลขอ้างอิง');
    return prefix(record.category)+match[1].slice(2)+match[2]+match[3];
  }
  function allocate(records,highWater){
    var counters=Object.assign({},highWater||{}),references=new Array(records.length),seen={};
    records.forEach(function(record,index){var old=parse(record.reference);if(!old)return;
      if(seen[record.reference]&&seen[record.reference]!==String(record.id))throw new Error('พบเลขอ้างอิงซ้ำในข้อมูลเดิม');
      seen[record.reference]=String(record.id);references[index]=record.reference;counters[old.stem]=Math.max(Number(counters[old.stem])||0,old.sequence);
    });
    records.map(function(record,index){return {record:record,index:index};}).sort(function(a,b){
      return String(a.record.createdAt||'').localeCompare(String(b.record.createdAt||''))||String(a.record.id).localeCompare(String(b.record.id));
    }).forEach(function(item){if(references[item.index])return;var key=stem(item.record),next=(Number(counters[key])||0)+1;
      if(!Number.isSafeInteger(next))throw new Error('ลำดับเลขอ้างอิงเกินขอบเขต');
      counters[key]=next;references[item.index]=key+String(next).padStart(2,'0');
    });
    return {references:references,counters:counters};
  }
  return {prefix:prefix,parse:parse,stem:stem,allocate:allocate};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=JobReferences;


/* Called only under the script lock shared by saves and list migration. */
function jobReferenceDate_(value,fallback){
  if(value instanceof Date&&!isNaN(value.getTime()))return Utilities.formatDate(value,'Asia/Bangkok','yyyy-MM-dd');
  var text=String(value||'').slice(0,10);
  if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text;
  var date=new Date(fallback);return !isNaN(date.getTime())?Utilities.formatDate(date,'Asia/Bangkok','yyyy-MM-dd'):'';
}
function jobReferenceKey_(sheet,stem){return 'JOB_REF_V1:'+sheet.getSheetId()+':'+stem;}
function jobReferenceReserve_(sheet,records){
  var properties=PropertiesService.getScriptProperties(),counters={},keys={};
  records.forEach(function(record){var old=JobReferences.parse(record.reference),stem=old?old.stem:JobReferences.stem(record);keys[stem]=jobReferenceKey_(sheet,stem);});
  Object.keys(keys).forEach(function(stem){counters[stem]=Number(properties.getProperty(keys[stem]))||0;});
  var result=JobReferences.allocate(records,counters),updates={};
  Object.keys(result.counters).forEach(function(stem){if(result.counters[stem]!==counters[stem])updates[jobReferenceKey_(sheet,stem)]=String(result.counters[stem]);});
  // Persist the counter first: a failed row write may leave a gap, never reuse.
  if(Object.keys(updates).length)properties.setProperties(updates,false);
  return result.references;
}
function jobReferenceRows_(sheet){
  if(sheet.getLastRow()<2)return [];
  var rows=sheet.getRange(2,1,sheet.getLastRow()-1,31).getValues(),models=[],indices=[];
  rows.forEach(function(row,index){if(!row[0]||!String(row[6]||'').trim())return;
    indices.push(index);models.push({id:row[0],date:jobReferenceDate_(row[1],row[23]),category:row[2],createdAt:row[23] instanceof Date?row[23].toISOString():String(row[23]||''),reference:String(row[29]||'')});
  });
  var references=jobReferenceReserve_(sheet,models),changed=false;
  indices.forEach(function(index,i){if(rows[index][29]!==references[i]){rows[index][29]=references[i];changed=true;}});
  if(changed)sheet.getRange(2,30,rows.length,1).setNumberFormat('@').setValues(rows.map(function(row){return [row[29]];}));
  return rows;
}
function migrateJobReferences(){
  orRequireOwner_();var lock=LockService.getScriptLock();lock.waitLock(30000);
  try{var result=['Data Account','Chokdee'].map(function(name){var sheet=getSheet_(name),rows=jobReferenceRows_(sheet);return {store:name,count:rows.filter(function(row){return !!row[29];}).length};});console.log(JSON.stringify(result));return result;}
  finally{lock.releaseLock();}
}

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
