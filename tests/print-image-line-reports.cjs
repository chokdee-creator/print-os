const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const props = {
  PRINT_REPORT_SPREADSHEET_ID: 'sheet', PRINT_REPORT_STORE_CONFIRMED: 'true',
  PRINT_REPORT_LINE_TOKEN: 'test-token', PRINT_REPORT_LINE_USER_ID: 'U' + 'a'.repeat(32)
};
let now = '2026-10-15T14:00:00Z';
let values = [['วันที่', 'ราคาขาย'], ['2026-10-01', 100], ['2026-10-15', 200], ['2026-10-16', 999]];
let calls = [], status = 200, accepted = false;
class ClockDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
}
const context = vm.createContext({
  Date: ClockDate, console,
  PropertiesService: { getScriptProperties: () => ({
    getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }
  }) },
  Utilities: {
    formatDate(date, tz, fmt) {
      const d = new Date(date.getTime() + 7 * 3600000), s = d.toISOString();
      if (fmt === 'yyyy-MM-dd') return s.slice(0, 10);
      if (fmt === 'HH') return s.slice(11, 13);
      return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) + ' ' + s.slice(11, 16);
    }, getUuid: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  SpreadsheetApp: { openById: () => ({ getSheetByName: name => name === 'Data Account'
    ? { getDataRange: () => ({ getValues: () => values }) } : null }) },
  UrlFetchApp: { fetch: (url, opts) => {
    calls.push(opts);
    return { getResponseCode: () => status, getAllHeaders: () => accepted ? {'X-Line-Accepted-Request-Id': 'request'} : {} };
  } }
});
vm.runInContext(fs.readFileSync('outputs/print-image-line-reports.gs', 'utf8'), context);
const periods = day => JSON.parse(JSON.stringify(context.prPeriods_(day)));
assert.equal(periods('2026-10-14').length, 1);
assert.equal(periods('2026-10-15')[1].start, '2026-10-01');
assert.equal(periods('2026-10-31')[1].start, '2026-10-16');
assert.equal(periods('2026-04-30').length, 2);
assert.equal(periods('2028-02-28').length, 1);
assert.equal(periods('2028-02-29').length, 2);
assert.equal(periods('2026-02-28').length, 2);
assert.equal(periods('2026-12-31')[1].end, '2026-12-31');
const msg = context.previewPrintImageReport();
assert.match(msg, /200.00 บาท/);
assert.match(msg, /300.00 บาท/);
assert.doesNotMatch(msg, /999.00 บาท/);
assert.equal(calls.length, 0);
now = '2026-10-15T13:59:00Z';
context.sendScheduledPrintImageReports();
assert.equal(calls.length, 0);
now = '2026-10-15T14:00:00Z';
status = 500;
assert.throws(() => context.sendScheduledPrintImageReports(), /HTTP 500/);
assert.equal(JSON.parse(props.PRINT_REPORT_LAST_DELIVERY).sent, false);
values.push(['2026-10-15', 888]);
status = 409; accepted = true;
context.sendScheduledPrintImageReports();
assert.equal(calls[0].payload, calls[1].payload);
assert.equal(calls[0].headers['X-Line-Retry-Key'], calls[1].headers['X-Line-Retry-Key']);
context.sendScheduledPrintImageReports();
assert.equal(calls.length, 2);
now = '2026-10-16T14:00:00Z'; status = 200;
context.sendScheduledPrintImageReports();
assert.equal(calls.length, 3);
assert.match(calls[2].payload, /999.00 บาท/);
assert.doesNotMatch(calls[2].payload, /ยอดครึ่งเดือน/);
assert.throws(() => context.prDay_('2026-02-30'), /Invalid date/);
assert.throws(() => context.prRows_([['วันที่','ราคาขาย'],['2026-10-15','oops']]), /Invalid sales/);
assert.throws(() => context.prRows_([['วันที่','ราคาขาย','ราคาขาย']]), /duplicate column/);
assert.throws(() => context.prRows_([['วันที่','ต้นทุน']]), /Missing/);
console.log('PASS: calendar boundaries, period totals, preview, time gate, retry, deduplication, next day, malformed data.');
