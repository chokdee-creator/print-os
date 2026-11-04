const assert=require('node:assert/strict');
const C=require('../study-curriculum.js');
const blank={version:1,profile:{name:'ผู้เรียน',credits:129,year:2570},courses:[]};
const first=C.apply(blank);
assert.equal(first.added,21);assert.equal(first.state.courses.length,21);assert.equal(first.state.courses.reduce((n,c)=>n+c.credits,0),63);
assert.equal(new Set(first.state.courses.map(c=>c.code)).size,21);assert.equal(first.state.courses.filter(c=>c.group==='วิชาเอกเลือก').length,7);
assert.ok(first.state.courses.every(c=>c.grade===''&&c.status==='planned'));
for(const [code,term,slot] of [['MGT2201','4/1','4A'],['MGT2202','2/1','4B'],['MGT3204','3/2','2A'],['MGT4209','3/2','2B'],['MKT2101','2/1','3A'],['STA2016','3/1','3B'],['MGT3409','4/2','1B']]){
 const c=first.state.courses.find(c=>c.code===code);assert.equal(c.planTerm,term);assert.equal(c.slot,slot);
}
const old={id:'old',code:'mgt3203',name:'ชื่อที่เคยบันทึก',credits:3,grade:'A',status:'graded',term:'1/2569',slot:'5B',examDate:'2026-12-15',room:'ห้องเดิม'};
const merged=C.apply({...blank,courses:[old]});
assert.equal(merged.added,20);assert.equal(merged.state.courses.length,21);const kept=merged.state.courses[0];
for(const field of ['id','name','credits','grade','status','term','slot','examDate','room'])assert.equal(kept[field],old[field]);
assert.equal(kept.planTerm,'3/1');assert.equal(old.planTerm,undefined,'input must not be mutated');
assert.equal(C.apply(merged.state).changed,false);
const removed={...first.state,courses:first.state.courses.filter(c=>c.code!=='MGT2201')};
assert.equal(C.apply(removed).state.courses.length,20,'deleted courses must not return after migration');
assert.deepEqual(first.state.profile,blank.profile);
console.log('PASS: 21 courses / 63 credits; image fields; preserve grades, names, dates, slots; idempotent migration and deletions');
