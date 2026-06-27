const DEFAULT_SHEET_NAME = "Data Account";

function doPost(e) {
  const data = parsePayload_(e);
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
  const sheet = getSheet_(data.sheetName);
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
  const row = buildRow_(data, existingValues);

  if (rowIndex) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, sheetName: sheet.getName() }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
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
    Number(data.discount) || 0
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
    "ส่วนลด"
  ];

  if (!sheet) {
    sheet = spreadsheet.insertSheet(targetSheetName);
  }

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
