const DEFAULT_SHEET_NAME = "Data Account";

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  if (data.action === "saveProfile") {
    const profile = saveProfile(data.profile || data);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, profile })).setMimeType(ContentService.MimeType.JSON);
  }
  if (data.action === "vaultSave") {
    const vault = saveVault(data);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, vault })).setMimeType(ContentService.MimeType.JSON);
  }
  const sheet = getSheet(data.sheetName);
  const rowIndex = findRow(sheet, data.id);
  if (data.action === "delete") {
    if (rowIndex) sheet.deleteRow(rowIndex);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, deleted: Boolean(rowIndex) })).setMimeType(ContentService.MimeType.JSON);
  }
  const old = rowIndex ? sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  const row = makeRow(data, old);
  if (rowIndex) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  if (params.action === "vaultLoad") {
    const payload = { ok: true, sheetName: cleanName(params.sheetName) || "SecureVault", vault: getVault(params.sheetName, params.id) };
    const json = JSON.stringify(payload);
    if (params.callback) {
      return ContentService.createTextOutput(params.callback + "(" + json + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  }
  if (params.action === "profile") {
    const payload = { ok: true, sheetName: "Profile", profile: getProfile() };
    const json = JSON.stringify(payload);
    if (params.callback) {
      return ContentService.createTextOutput(params.callback + "(" + json + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  }
  if (params.action === "list") {
    const sheet = getSheet(params.sheetName);
    const rows = sheet.getLastRow() < 2
      ? []
      : sheet.getRange(2, 1, sheet.getLastRow() - 1, 25).getValues();
    const payload = {
      ok: true,
      sheetName: sheet.getName(),
      records: rows.filter(row => row[0] || row[5])
    };
    const json = JSON.stringify(payload);
    if (params.callback) {
      return ContentService
        .createTextOutput(params.callback + "(" + json + ");")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput("OK");
}

function makeRow(data, old) {
  const paid = Math.min(Number(data.paidAmount) || 0, Number(data.saleTotal) || 0);
  const balance = Math.max((Number(data.saleTotal) || 0) - paid, 0);
  const slipIndex = old.length >= 25 ? 20 : 19;
  const oldSlip = String(old[slipIndex] || "").startsWith("http") ? old[slipIndex] : "";
  const slip = data.paymentSlipDataUrl ? saveSlip(data) : (data.paymentSlipUrl || oldSlip);
  return [
    data.id || "",
    data.date || "",
    data.category || "",
    data.customerType || "",
    data.customerName || "",
    data.paymentStatus || (balance <= 0 && Number(data.saleTotal) > 0 ? "จ่ายแล้ว" : "ค้างจ่าย"),
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
    paid,
    balance,
    slip,
    Number(data.costTotal) || 0,
    Number(data.profit) || 0,
    data.createdAt || new Date().toISOString(),
    data.updatedAt || "",
    Number(data.discount) || 0
  ];
}

function findRow(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return null;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2;
  }
  return null;
}

function getSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = cleanName(sheetName) || DEFAULT_SHEET_NAME;
  let sheet = ss.getSheetByName(name);
  const headers = ["ID", "วันที่", "หมวดหมู่", "ประเภทลูกค้า", "รายชื่อลูกค้า", "สถานะชำระเงิน", "รายชื่องาน", "กว้าง (เมตร)", "ยาว (เมตร)", "จำนวนชิ้นงาน", "พื้นที่ (ตร.ม.)", "ราคาขาย/ตร.ม.", "ค่าวัสดุ/ตร.ม.", "ค่าหมึก/ตร.ม.", "ค่าไฟ/ตร.ม.", "ค่า Maintenance เครื่องพิมพ์/ตร.ม.", "ต้นทุน/ตร.ม.", "ราคาขาย", "ลูกค้าชำระ", "ค้างเหลือ", "ลิงก์สลิป", "ต้นทุน", "กำไร", "เวลาบันทึก", "เวลาแก้ไขล่าสุด", "ส่วนลด"];
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  else {
    const currentCustomerNameHeader = sheet.getRange(1, 5).getValue();
    if (currentCustomerNameHeader !== "รายชื่อลูกค้า") sheet.insertColumnAfter(4);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

function cleanName(value) {
  const name = String(value || "").trim();
  if (!name) return "";
  return name.replace(/[\\/?*\[\]:]/g, "").slice(0, 100);
}

function getProfile() {
  const sheet = getProfileSheet();
  const values = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  const profile = {};
  values.forEach(row => {
    const key = String(row[0] || "").trim();
    if (key) profile[key] = row[1] || "";
  });
  return profile;
}

function saveProfile(profile) {
  const sheet = getProfileSheet();
  const keys = ["shopName", "displayName", "address", "taxId", "phone", "email", "website"];
  const labels = { shopName: "ชื่อร้าน/บริษัท", displayName: "ชื่อที่แสดงบนเอกสาร", address: "ที่อยู่ร้าน", taxId: "เลขผู้เสียภาษี", phone: "เบอร์โทร", email: "อีเมล", website: "เว็บไซต์/เพจ" };
  const rows = keys.map(key => [key, profile[key] || "", labels[key] || ""]);
  sheet.clear();
  sheet.getRange(1, 1, 1, 3).setValues([["key", "value", "label"]]).setFontWeight("bold");
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  sheet.setFrozenRows(1);
  return getProfile();
}

function getProfileSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Profile");
  if (!sheet) {
    sheet = ss.insertSheet("Profile");
    sheet.getRange(1, 1, 1, 3).setValues([["key", "value", "label"]]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function saveVault(data) {
  const sheet = getVaultSheet(data.sheetName);
  const row = [data.id || "secure-vault", data.updatedAt || new Date().toISOString(), Number(data.itemCount) || 0, data.encryptedVault || "", data.source || ""];
  sheet.getRange(2, 1, 1, row.length).setValues([row]);
  return { id: row[0], updatedAt: row[1], itemCount: row[2] };
}

function getVault(sheetName, id) {
  const sheet = getVaultSheet(sheetName);
  if (sheet.getLastRow() < 2) return null;
  const targetId = id || "secure-vault";
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || "") === targetId) return { id: rows[i][0], updatedAt: rows[i][1], itemCount: rows[i][2], encryptedVault: rows[i][3], source: rows[i][4] };
  }
  return null;
}

function getVaultSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = cleanName(sheetName) || "SecureVault";
  let sheet = ss.getSheetByName(name);
  const headers = ["ID", "updatedAt", "itemCount", "encryptedVault", "source"];
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  else sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

function saveSlip(data) {
  const match = String(data.paymentSlipDataUrl || "").match(/^data:(.+);base64,(.+)$/);
  if (!match) return data.paymentSlipUrl || "";
  const folders = DriveApp.getFoldersByName("Print Job Payment Slips");
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("Print Job Payment Slips");
  const ext = match[1] === "image/png" ? ".png" : ".jpg";
  const safe = String(data.paymentSlipName || "payment-slip").replace(/[\\/:*?"<>|]/g, "-");
  const name = [data.date || "date", data.id || Utilities.getUuid(), safe.endsWith(ext) ? safe : safe + ext].join("-");
  const blob = Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], name);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}
