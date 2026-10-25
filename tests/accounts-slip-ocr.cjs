const assert=require('node:assert/strict');
const {parse}=require('../accounts-slip-ocr.js');
const cases=[
 ['จำนวนเงิน 1,800.00 บาท\nค่าธรรมเนียม 0.00 บาท\nยอดคงเหลือ 50,000.00 บาท',180000],
 ['โอนเงินสำเร็จ\nจำนวนเงิน\n1,234.56\nค่าธรรมเนียม\n0.00 บาท',123456],
 ['Amount: 123.45 THB\nDate 25/10/2026\nAccount 1234567890',12345],
 ['จำนวนเงิน ๑,๒๓๔.๕๖ บาท',123456],
 ['จํานวนเงิน\n250.00 บาท',25000],
 ['จำนวนเงิน 2000\nค่าธรรมเนียม 10.00 บาท',200000],
 ['จำนวนเงิน 100.00 บาท\nจำนวนเงิน 200.00 บาท',null],
 ['ยอดคงเหลือ 12,345.67 บาท\nค่าธรรมเนียม 20.00 บาท',null],
 ['ค่าธรรมเนียม\n20.00 บาท\nยอดคงเหลือ\n50,000.00 บาท',null],
 ['จำนวนเงิน\n200.00 บาท\nค่าธรรมเนียม\n10.00 บาท\nยอดคงเหลือ\n500.00 บาท',20000],
 ['เลขบัญชี 1234567890\nวันที่ 25/10/2026\nอ้างอิง 202610251800.00',null],
 ['จำนวนเงิน -100.00 บาท',null],
 ['Amount 1,23.45 THB',null],
 ['Account: 1234.56 THB',null],
 ['THB 1000000000.00',null],
 ['TEST RECEIPT\n120.00 THB\n123.00 THB',null],
 ['จำนวนเงิน 1,800.00 บาท\nรวม 1,800.00 บาท',180000],
 ['',null]
];
for(const [text,amount] of cases)assert.equal(parse(text).amount,amount,text);
assert.deepEqual(parse('100.00 THB\n200.00 THB').candidates,[10000,20000]);
assert.equal(parse('โอนเงินสำเร็จ\nจาก\nนาย ผู้โอน ทดสอบ\nธนาคารกสิกรไทย\nไปยัง\nธนาคารกรุงไทย\nนางสาว ผู้รับ ทดสอบ\nเลขบัญชี 1234567890\nจำนวนเงิน 100.00 บาท').recipient,'นางสาว ผู้รับ ทดสอบ');
assert.equal(parse('Transfer successful\nFrom: John Smith\nTo: Jane Green\nAmount 200.00 THB').type,'expense');
assert.equal(parse('Payment received\nFrom: John Smith\nTo: Jane Green').type,'income');
assert.equal(parse('โอนเงินสำเร็จ\nได้รับเงิน 100.00 บาท').type,null);
assert.equal(parse('จำนวนเงิน 100.00 บาท').type,null);
assert.equal(parse('ไปยัง\nธนาคารไทยพาณิชย์\n1234567890\nจำนวนเงิน 100.00 บาท').recipient,null);
assert.equal(parse('To: Jane Green\nTo: Jane Brown').recipient,null);
assert.equal(parse('จ่ายบิลสำเร็จ\nจาก\nร้าน ตัวอย่าง\nไปยัง\nPayment to ShopeeFood\nจำนวนเงิน 50.00 บาท\nค่าธรรมเนียม 0.00 บาท').type,'expense');
assert.equal(parse('จ่าย บิล สําเร็จ').type,'expense');
assert.equal(parse('Bill payment successful').type,'expense');
assert.equal(parse('จ่ายบิลไม่สำเร็จ').type,null);
assert.equal(parse('จ่ายบิลสำเร็จ\nยกเลิกรายการ').type,null);
assert.equal(parse('ได้รับเงิน 50.00 บาท').type,'income');
console.log('PASS receipt amount parsing: labels, Thai digits, fees, balances, ambiguity and invalid values');
// Exercise the actual UI controller with delayed recognition, without saving records.
const vm=require('node:vm'),fs=require('node:fs');
function harness(){
 const elements=new Map(),pending=[];
 const $=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:true,textContent:'',children:[],addEventListener(name,fn){this[name]=fn;},replaceChildren(){this.children=[];},appendChild(node){node.remove=()=>{this.children=this.children.filter(x=>x!==node);};this.children.push(node);}});return elements.get(id);};
 const ctx=vm.createContext({AbortController,$,money:n=>(n/100).toFixed(2),el:()=>({}),setType:value=>{$('entryType').value=value;},AccountSlipOCR:{read:(_,options)=>new Promise(resolve=>pending.push({resolve,options}))}});
 const source=fs.readFileSync('accounts.js','utf8');
 vm.runInContext('let ocrController=null,amountRevision=0,recipientRevision=0,typeRevision=0,editing=null,slipVersion=1;'+source.slice(source.indexOf('function clearSlipRead()'),source.indexOf('function revokePreview()')),ctx);
 return {ctx,$,pending,start:()=>ctx.readSlipAmount({},1)};
}
(async()=>{
 let h=harness(),task=h.start();h.pending[0].resolve({amount:12345,candidates:[12345]});await task;assert.equal(h.$('entryAmount').value,'123.45');
 h=harness();task=h.start();h.$('entryAmount').value='999.00';h.$('entryAmount').input();h.pending[0].resolve({amount:12345,candidates:[12345]});await task;assert.equal(h.$('entryAmount').value,'999.00');assert.equal(h.$('slipReadChoices').children.length,1);h.$('slipReadChoices').children[0].onclick();assert.equal(h.$('entryAmount').value,'123.45');
 h=harness();h.$('entryAmount').value='500.00';task=h.start();h.pending[0].resolve({amount:12345,candidates:[12345]});await task;assert.equal(h.$('entryAmount').value,'500.00','existing amount requires explicit replacement');
 h=harness();task=h.start();h.ctx.clearSlipRead();h.pending[0].resolve({amount:12345,candidates:[12345]});await task;assert.equal(h.$('entryAmount').value,'');assert.equal(h.$('slipRead').hidden,true);
 h=harness();task=h.start();vm.runInContext('slipVersion=2',h.ctx);h.pending[0].resolve({amount:12345,candidates:[12345]});await task;assert.equal(h.$('entryAmount').value,'','stale slip cannot change a new entry');
 h=harness();task=h.start();h.pending[0].resolve({amount:10000,candidates:[10000],recipient:'Jane Green',type:'expense'});await task;assert.equal(h.$('entryRecipient').value,'Jane Green');assert.equal(h.$('entryType').value,'expense');
 h=harness();task=h.start();h.$('entryRecipient').value='My correction';h.$('entryRecipient').input();vm.runInContext('typeRevision++',h.ctx);h.pending[0].resolve({amount:10000,candidates:[10000],recipient:'Jane Green',type:'expense'});await task;assert.equal(h.$('entryRecipient').value,'My correction');assert.equal(h.$('entryType').value,'');
 h=harness();task=h.start();h.pending[0].resolve({amount:null,candidates:[],recipient:null,nameCandidates:['นาย สมชาย ใจดี']});await task;assert.equal(h.$('entryRecipient').value,'');assert.equal(h.$('slipReadChoices').children.length,1);h.$('slipReadChoices').children[0].onclick();assert.equal(h.$('entryRecipient').value,'นาย สมชาย ใจดี');
 h=harness();vm.runInContext('editing={id:"existing"}',h.ctx);task=h.start();h.pending[0].resolve({amount:5000,candidates:[5000],type:'expense'});await task;assert.equal(h.$('entryType').value,'expense','explicit re-read must also classify an existing entry');
 console.log('PASS OCR UI: automatic amount, manual edits preserved, explicit replacement, cancellation and stale upload protection');
})().catch(error=>{console.error(error);process.exitCode=1;});
