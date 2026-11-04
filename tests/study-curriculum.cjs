const assert=require('node:assert/strict'),C=require('../study-curriculum.js');
const blank={version:1,profile:{name:'ผู้เรียน',credits:129,year:2570},courses:[]};
const first=C.apply(blank);
assert.equal(first.added,45);assert.equal(first.state.courses.length,45);assert.equal(first.state.courses.reduce((n,c)=>n+c.credits,0),132);
assert.equal(new Set(first.state.courses.map(c=>c.code)).size,45);
for(const [group,count,credits] of [['ศึกษาทั่วไป',12,33],['วิชาแกน',14,42],['วิชาเอกบังคับ',10,30],['วิชาเอกเลือก',7,21],['วิชาเลือกเสรี',2,6]]){
 const rows=first.state.courses.filter(c=>c.group===group);assert.equal(rows.length,count);assert.equal(rows.reduce((n,c)=>n+c.credits,0),credits);
}
assert.ok(first.state.courses.every(c=>c.grade===''&&c.status==='planned'&&c.inPlan===false));
for(const [code,credits,term,slot] of [['ENG1001',3,'1/1','4B'],['HPR1001',1,'1/1','3A'],['LIS1001',2,'1/1','1A'],['ACC1101',3,'1/1','3B'],['ACC2134',3,'2/1','1A'],['MGT3204',3,'3/2','2A'],['MGT3310',3,'2/1','3B'],['MGT3412',3,'4/1','4B']]){
 const c=first.state.courses.find(c=>c.code===code);assert.equal(c.credits,credits);assert.equal(c.planTerm,term);assert.equal(c.slot,slot);
}
const old={id:'old',code:'mgt3203',name:'ชื่อที่เคยบันทึก',credits:3,grade:'A',status:'graded',term:'1/2569',slot:'5B',inPlan:false,history:[{term:'1/2569',grade:'A',credits:3}],examDate:'2026-12-15',room:'ห้องเดิม'};
const merged=C.apply({...blank,curriculumVersion:1,courses:[old]});assert.equal(merged.added,44);assert.equal(merged.matched,1);const kept=merged.state.courses[0];
for(const field of ['id','name','credits','grade','status','term','slot','examDate','room','inPlan','history'])assert.deepEqual(kept[field],old[field]);
assert.equal(kept.planTerm,'3/1');assert.equal(old.planTerm,undefined);
const previous={...blank,curriculumVersion:1,courses:first.state.courses.slice(0,24)};const update=C.apply(previous);assert.equal(update.added,21);assert.equal(update.matched,24);assert.equal(new Set(update.state.courses.map(c=>c.code.toUpperCase())).size,45);
assert.equal(C.apply(merged.state).changed,false);
const removed={...first.state,courses:first.state.courses.filter(c=>c.code!=='MGT2201')};assert.equal(C.apply(removed).state.courses.length,44);
assert.deepEqual(first.state.profile,blank.profile);
console.log('PASS: 45 unique codes / 132 credits, all category totals, nonstandard credits, 24 existing + 21 new, preserve grades/history/plan and idempotence');
