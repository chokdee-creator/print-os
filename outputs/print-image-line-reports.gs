/** Add as a NEW file in the Apps Script project attached to the sales sheet. */
const PR_TIMEZONE = 'Asia/Bangkok';

function prSettings_() {
  const p = PropertiesService.getScriptProperties();
  const config = {
    spreadsheetId: p.getProperty('PRINT_REPORT_SPREADSHEET_ID'),
    sheetName: p.getProperty('PRINT_REPORT_SHEET_NAME') || 'Data Account',
    token: p.getProperty('PRINT_REPORT_LINE_TOKEN'),
    target: p.getProperty('PRINT_REPORT_LINE_USER_ID')
  };
  if (!config.spreadsheetId) throw new Error('Set PRINT_REPORT_SPREADSHEET_ID');
  return config;
}

function prDay_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, PR_TIMEZONE, 'yyyy-MM-dd');
  }
  const s = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Unsupported date: ' + s);
  const d = new Date(s + 'T12:00:00Z');
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw new Error('Invalid date: ' + s);
  }
  return s;
}

function prPeriods_(day) {
  const n = Number(day.slice(8));
  const last = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0)).getUTCDate();
  const periods = [{ label: 'ยอดรายวัน', start: day, end: day }];
  if (n === 15 || n === last) {
    periods.push({
      label: 'ยอดครึ่งเดือน',
      start: day.slice(0, 8) + (n === 15 ? '01' : '16'), end: day
    });
  }
  return periods;
}

function prRows_(values) {
  if (!values.length) throw new Error('Sheet has no headers');
  const headers = values[0].map(function (v) { return String(v).trim(); });
  function column(name) {
    const index = headers.indexOf(name);
    if (index < 0 || headers.lastIndexOf(name) !== index) {
      throw new Error('Missing or duplicate column: ' + name);
    }
    return index;
  }
  const dateIndex = column('วันที่');
  const saleIndex = column('ราคาขาย');
  const jobIndex = column('รายชื่องาน');
  return values.slice(1).filter(function (row) {
    // The website also excludes rows without a job name.
    return String(row[jobIndex] || '').trim().length > 0;
  }).map(function (row, i) {
    const raw = row[saleIndex];
    if (raw === '' || raw === null || typeof raw === 'boolean' || !Number.isFinite(Number(raw))) {
      throw new Error('Invalid sales amount in data row ' + (i + 1));
    }
    return { day: prDay_(row[dateIndex]), sale: Number(raw) };
  });
}

function prMessage_(values, now) {
  const day = Utilities.formatDate(now, PR_TIMEZONE, 'yyyy-MM-dd');
  const rows = prRows_(values);
  const lines = ['สรุปยอดขาย ร้านปริ้นอิมเมจ'];
  prPeriods_(day).forEach(function (period) {
    const selected = rows.filter(function (r) { return r.day >= period.start && r.day <= period.end; });
    const total = selected.reduce(function (sum, r) { return sum + r.sale; }, 0);
    if (!Number.isFinite(total)) throw new Error('Sales total is out of range');
    const amount = total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    lines.push('', period.label + ': ' + period.start + (period.end === period.start ? '' : ' ถึง ' + period.end),
      'ยอดขายรวม: ' + amount + ' บาท', 'จำนวนรายการงาน: ' + selected.length);
  });
  lines.push('', 'ข้อมูล ณ ' + Utilities.formatDate(now, PR_TIMEZONE, 'dd/MM/yyyy HH:mm') + ' น. (เวลาไทย)',
    'คำนวณตามวันที่งาน จากข้อมูลที่บันทึกในชีต ณ เวลาส่ง');
  return lines.join('\n');
}

function prRead_(config) {
  const sheet = SpreadsheetApp.openById(config.spreadsheetId).getSheetByName(config.sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + config.sheetName);
  return sheet.getDataRange().getValues();
}

/** Preview only: logs report text. Does not send a LINE message. */
function previewPrintImageReport() {
  const message = prMessage_(prRead_(prSettings_()), new Date());
  console.log(message);
  return message;
}

function prValidateLine_(config) {
  if (!config.token) throw new Error('Set PRINT_REPORT_LINE_TOKEN');
  if (!/^U[0-9a-f]{32}$/.test(config.target || '')) {
    throw new Error('Set PRINT_REPORT_LINE_USER_ID to your Messaging API user ID');
  }
}

/** Run once after previewing the correct store and setting Script Properties. */
function enablePrintImageReports() {
  const config = prSettings_();
  prValidateLine_(config);
  if (PropertiesService.getScriptProperties().getProperty('PRINT_REPORT_STORE_CONFIRMED') !== 'true') {
    throw new Error('Preview and confirm this sheet contains only Print Image; set PRINT_REPORT_STORE_CONFIRMED=true');
  }
  prMessage_(prRead_(config), new Date());
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const existing = ScriptApp.getProjectTriggers().filter(function (t) {
      return t.getHandlerFunction() === 'sendScheduledPrintImageReports';
    });
    if (!existing.length) {
      ScriptApp.newTrigger('sendScheduledPrintImageReports').timeBased().everyMinutes(5).create();
    }
  } finally { lock.releaseLock(); }
}

function disablePrintImageReports() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'sendScheduledPrintImageReports') ScriptApp.deleteTrigger(t);
    });
  } finally { lock.releaseLock(); }
}

/** Checks every 5 minutes; sends once per local date, at or after 21:00. */
function sendScheduledPrintImageReports() {
  const now = new Date();
  if (Number(Utilities.formatDate(now, PR_TIMEZONE, 'HH')) < 21) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const p = PropertiesService.getScriptProperties();
    if (p.getProperty('PRINT_REPORT_STORE_CONFIRMED') !== 'true') throw new Error('Store not confirmed');
    const day = Utilities.formatDate(now, PR_TIMEZONE, 'yyyy-MM-dd');
    const config = prSettings_();
    prValidateLine_(config);
    let state = JSON.parse(p.getProperty('PRINT_REPORT_LAST_DELIVERY') || 'null');
    if (state && state.day === day && state.sent) return;
    if (!state || state.day !== day) {
      state = { day: day, sent: false, retryKey: Utilities.getUuid(),
        payload: JSON.stringify({ to: config.target,
          messages: [{ type: 'text', text: prMessage_(prRead_(config), now) }] }) };
      p.setProperty('PRINT_REPORT_LAST_DELIVERY', JSON.stringify(state));
    }
    const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + config.token, 'X-Line-Retry-Key': state.retryKey },
      payload: state.payload, muteHttpExceptions: true
    });
    const code = response.getResponseCode();
    const headers = response.getAllHeaders();
    const alreadyAccepted = code === 409 && Object.keys(headers).some(function (k) {
      return k.toLowerCase() === 'x-line-accepted-request-id' && Boolean(headers[k]);
    });
    if (!(code >= 200 && code < 300) && !alreadyAccepted) {
      throw new Error('LINE push failed (HTTP ' + code + '). Check token, target, quota and execution log.');
    }
    state.sent = true;
    p.setProperty('PRINT_REPORT_LAST_DELIVERY', JSON.stringify(state));
  } finally { lock.releaseLock(); }
}
