/* Merge a private transcript into course data without duplicate earned credits. */
var StudyResults=(function(){
 'use strict';
 const grades=['A','B+','B','C+','C','D+','D','F','S','U','W','I'];
 const order=term=>{const m=/^([1-3])\s*\/\s*(25\d{2})$/.exec(term);return m?Number(m[2])*10+Number(m[1]):0;};
 function attempts(rows){
  if(rows===undefined)return [];
  if(!Array.isArray(rows)||rows.length>100)throw Error('ประวัติผลการเรียนไม่ถูกต้อง');
  const result=new Map();
  rows.forEach(row=>{
   if(!row||typeof row.term!=='string'||(row.term&&!order(row.term))||!grades.includes(row.grade)||!Number.isFinite(row.credits)||row.credits<0||row.credits>30)throw Error('ผลการเรียนหรือภาคเรียนไม่ถูกต้อง');
   const value={term:row.term.replace(/\s/g,''),grade:row.grade,credits:row.credits};
   result.set([value.term,value.grade,value.credits].join('|'),value);
  });
  return [...result.values()].sort((a,b)=>order(b.term)-order(a.term));
 }
 function merge(state,file){
  if(!file||file.kind!=='study-results'||file.version!==1||!Array.isArray(file.results)||!file.results.length||file.results.length>1000)throw Error('ไฟล์ผลการเรียนไม่ถูกต้อง');
  const next=JSON.parse(JSON.stringify(state)),byCode=new Map(next.courses.map(c=>[c.code.toUpperCase(),c]));
  const imported=new Map();
  file.results.forEach(row=>{
   if(!row||typeof row.code!=='string'||!(/^[A-Z]{2,5}\d{3,5}$/.test(row.code.trim().toUpperCase()))||!row.term||!order(row.term))throw Error('รหัสวิชาหรือภาคเรียนไม่ถูกต้อง');
   const code=row.code.trim().toUpperCase(),list=imported.get(code)||[];
   list.push(...attempts([row]));imported.set(code,list);
  });
  imported.forEach((list,code)=>{
   let c=byCode.get(code);
   if(!c){c={id:'results-'+code.toLowerCase(),code,name:'รายวิชา '+code,credits:list[0].credits,status:'planned',grade:'',term:'',planTerm:'',group:'',slot:'',examDate:'',examTime:'',room:''};next.courses.push(c);byCode.set(code,c);}
   const current=c.grade?[{term:c.term||'',grade:c.grade,credits:c.credits}]:[];
   c.history=attempts([...(c.history||[]),...current,...list]);
   const latest=c.history[0];c.grade=latest.grade;c.term=latest.term;c.credits=latest.credits;c.status='graded';
  });
  return {state:next,courses:imported.size,results:file.results.length};
 }
 return {attempts,merge};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudyResults;
