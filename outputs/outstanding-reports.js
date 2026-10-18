/* Shared browser / Apps Script report engine. Amounts are summed in satang. */
var PrintOutstanding = (function () {
  'use strict';
  function day(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('ระบุวันที่แบบ YYYY-MM-DD');
    var d = new Date(value + 'T12:00:00Z');
    if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw new Error('วันที่ไม่ถูกต้อง');
    return value;
  }
  function type(value) {
    if (value === 'พาร์ทเนอร์(มานา)' || value === 'มานา (พาร์ทเนอร์)') return 'มานา เด็กดื้อ';
    return ['ลูกค้าประจำ', 'ลูกค้าทั่วไป', 'มานา เด็กดื้อ', 'ตาชัย'].indexOf(value) >= 0 ? value : 'ลูกค้าทั่วไป';
  }
  function identity(customer) { return JSON.stringify([type(customer.type), String(customer.name || '-').trim() || '-']); }
  function money(value) {
    if (typeof value === 'boolean' || value === '' || value === null || !Number.isFinite(Number(value)) || Number(value) < 0) throw new Error('ยอดเงินไม่ถูกต้อง');
    var n = Math.round(Number(value) * 100);
    if (!Number.isSafeInteger(n)) throw new Error('ยอดเงินเกินขอบเขต');
    return n;
  }
  function balance(record) {
    var sale = money(record.saleTotal);
    if (String(record.paymentStatus || '').indexOf('จ่ายแล้ว') >= 0) return 0;
    var evidence = record.paymentSlipUrl || record.paymentSlipDataUrl || record.paymentSlipName;
    var paid = evidence && record.paidAmount !== '' && record.paidAmount != null ? money(record.paidAmount) : 0;
    // The existing sheet loader resets contradictory "unpaid but fully paid" values.
    if (String(record.paymentStatus || '').indexOf('ค้าง') >= 0 && paid >= sale) paid = 0;
    return Math.max(sale - paid, 0);
  }
  function validate(input) {
    if (!input || !Array.isArray(input.customers) || !input.customers.length || input.customers.length > 30) throw new Error('เลือกลูกค้า 1–30 ราย');
    var customers = input.customers.map(function (c) {
      if (!c || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 150) throw new Error('ระบุชื่อลูกค้าให้ครบ');
      if (type(c.type) !== c.type) throw new Error('ประเภทลูกค้าไม่ถูกต้อง');
      return {type: c.type, name: c.name.trim()};
    });
    if (new Set(customers.map(identity)).size !== customers.length) throw new Error('ลูกค้าซ้ำ');
    if (['day', 'month'].indexOf(input.group) < 0) throw new Error('เลือกรูปแบบรายวันหรือรายเดือน');
    if (['off', 'day', 'month'].indexOf(input.cadence) < 0) throw new Error('เลือกรอบส่ง');
    if (['fixed', 'throughToday', 'currentMonth'].indexOf(input.range) < 0) throw new Error('เลือกรูปแบบช่วงวันที่');
    var start = day(input.start), end = day(input.end);
    if (start > end) throw new Error('วันเริ่มต้องไม่เกินวันสิ้นสุด');
    return {customers: customers, start: start, end: end, group: input.group, cadence: input.cadence, range: input.range};
  }
  function dates(config, today) {
    day(today);
    return {start: config.range === 'currentMonth' ? today.slice(0, 8) + '01' : config.start,
      end: config.range === 'fixed' ? config.end : today};
  }
  function build(records, input, today) {
    var config = validate(input), period = dates(config, today);
    if (period.start > period.end) throw new Error('ช่วงวันที่ยังไม่เริ่ม');
    var wanted = new Set(config.customers.map(identity)), groups = new Map(), total = 0, count = 0;
    records.forEach(function (r) {
      if (!String(r.name || '').trim()) return;
      var customer = {type: type(r.customerType), name: String(r.customerName || '-').trim() || '-'};
      if (!wanted.has(identity(customer))) return;
      var date = day(r.date);
      if (date < period.start || date > period.end) return;
      var amount = balance(r);
      if (!amount) return;
      var bucket = config.group === 'month' ? date.slice(0, 7) : date;
      var key = JSON.stringify([identity(customer), bucket]);
      var row = groups.get(key) || {type:customer.type, name:customer.name, period:bucket, count:0, satang:0};
      row.count++; row.satang += amount; groups.set(key, row); total += amount; count++;
      if (!Number.isSafeInteger(total)) throw new Error('ยอดรวมเกินขอบเขต');
    });
    return {config:config, start:period.start, end:period.end, today:today, satang:total, count:count,
      rows:Array.from(groups.values()).sort(function (a,b) {return a.name.localeCompare(b.name,'th') || a.type.localeCompare(b.type,'th') || a.period.localeCompare(b.period);})};
  }
  function amount(n) {return (n / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');}
  function text(report) {
    var lines = ['สรุปยอดค้าง ร้านปริ้นอิมเมจ', 'วันที่งาน: ' + report.start + ' ถึง ' + report.end,
      'แยก' + (report.config.group === 'day' ? 'รายวัน' : 'รายเดือน'),
      'ลูกค้าที่เลือก: ' + report.config.customers.map(function(c){return c.name + ' (' + c.type + ')';}).join(', '), ''];
    report.rows.forEach(function(r){lines.push(r.name + ' (' + r.type + ') | ' + r.period + ' | ' + r.count + ' งาน | ' + amount(r.satang) + ' บาท');});
    if (!report.rows.length) lines.push('ไม่พบงานค้างชำระในช่วงที่เลือก');
    lines.push('', 'รวมค้าง ' + amount(report.satang) + ' บาท (' + report.count + ' งาน)',
      'ยอดค้างปัจจุบัน ณ ' + report.today + ' ของงานในช่วงวันที่ข้างต้น ไม่ใช่ยอดย้อนหลัง ณ วันสิ้นสุด');
    return lines.join('\n');
  }
  function command(config) {
    config=validate(config);
    var result = config.customers.some(function(c){return /[\r\n]/.test(c.name);})
      ? 'สรุปยอดค้าง ' + JSON.stringify(config)
      : ['สรุปยอดค้าง'].concat(config.customers.map(function(c){return 'ลูกค้า: '+c.type+' | '+c.name;}),
        ['เริ่ม: '+config.start,'ถึง: '+config.end,'แยก: '+(config.group==='day'?'รายวัน':'รายเดือน'),
          'ส่ง: '+({off:'ไม่อัตโนมัติ',day:'รายวัน',month:'รายเดือน'}[config.cadence]),
          'ช่วง: '+({fixed:'กำหนดเอง',throughToday:'ถึงวันส่ง',currentMonth:'เดือนที่ส่ง'}[config.range])]).join('\n');
    if(result.length > 4900) throw new Error('คำสั่ง LINE ยาวเกินไป กรุณาลดจำนวนลูกค้า');
    return result;
  }
  function parse(text) {
    var prefix = 'สรุปยอดค้าง';
    if (String(text).indexOf(prefix) !== 0) throw new Error('ใช้ปุ่มคัดลอกคำสั่ง LINE จากหน้ารายงานยอดค้าง');
    try {
      var body=text.slice(prefix.length).trim();
      if(body.charAt(0)==='{') return validate(JSON.parse(body));
      var result={customers:[]},seen=new Set();
      body.split(/\r?\n/).forEach(function(line){
        var colon=line.indexOf(':');if(colon<1) throw new Error('ใช้รูปแบบ หัวข้อ: ค่า');
        var key=line.slice(0,colon).trim(),value=line.slice(colon+1).trim();
        if(key==='ลูกค้า') {
          var separator=value.indexOf('|');if(separator<1) throw new Error('ลูกค้า: ประเภท | ชื่อ');
          result.customers.push({type:value.slice(0,separator).trim(),name:value.slice(separator+1).trim()});return;
        }
        if(seen.has(key)) throw new Error('หัวข้อซ้ำ '+key);seen.add(key);
        if(key==='เริ่ม') result.start=value;
        else if(key==='ถึง') result.end=value;
        else if(key==='แยก') result.group=({'รายวัน':'day','รายเดือน':'month'})[value];
        else if(key==='ส่ง') result.cadence=({'ไม่อัตโนมัติ':'off','รายวัน':'day','รายเดือน':'month'})[value];
        else if(key==='ช่วง') result.range=({'กำหนดเอง':'fixed','ถึงวันส่ง':'throughToday','เดือนที่ส่ง':'currentMonth'})[value];
        else throw new Error('ไม่รู้จักหัวข้อ '+key);
      });
      return validate(result);
    } catch(e) {throw new Error('คำสั่งไม่ถูกต้อง: ' + e.message);}
  }
  function due(config, today) {
    if (config.cadence === 'off') return false;
    if (config.range !== 'currentMonth' && config.start > today) return false;
    return config.cadence === 'day' || Number(today.slice(8)) === new Date(Date.UTC(Number(today.slice(0,4)), Number(today.slice(5,7)), 0)).getUTCDate();
  }
  return {day:day, type:type, identity:identity, balance:balance, validate:validate, dates:dates, build:build, text:text, command:command, parse:parse, due:due};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PrintOutstanding;
