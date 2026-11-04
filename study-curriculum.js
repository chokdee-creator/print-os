/* Curriculum transcribed from the user's full study-plan image, 2026-11-04.
   Printed course information only; handwritten marks do not determine grades. */
var StudyCurriculum=(function(){
  'use strict';
  const version=2;
  const groups=[
    ['ศึกษาทั่วไป',[
      ['ENG1001',3,'1/1','4B'],['ENG1002',3,'1/2','1A'],['ENG2001',3,'2/1','2A'],['ENG2002',3,'2/2','3A'],
      ['HPR1001',1,'1/1','3A'],['LIS1001',2,'1/1','1A'],['INT1004',3,'1/2','3B'],['MTH1003',3,'1/1','4A'],
      ['POL1101',3,'1/1','2B'],['PSY1001',3,'1/1','1B'],['THA1003',3,'1/2','1B'],['RAM1000',3,'4/2','4B']
    ]],
    ['วิชาแกน',[
      ['ACC1101',3,'1/1','3B'],['ACC1102',3,'1/2','4A'],['BUS2101',3,'3/1','1A'],['ECO1121',3,'1/1','2A'],['ECO1122',3,'1/2','3A'],
      ['FIN2101',3,'2/1','2B'],['HRM2101',3,'2/2','2A'],['LAW2116',3,'2/2','4B'],['MGT2101',3,'2/1','1B'],['MGT2102',3,'2/2','1B'],
      ['MGT3101',3,'4/2','3B'],['MGT3102',3,'3/1','1B'],['MKT2101',3,'2/1','3A'],['STA2016',3,'3/1','3B']
    ]],
    ['วิชาเอกบังคับ',[
      ['ACC2134',3,'2/1','1A'],['MGT2201',3,'4/1','4A'],['MGT2202',3,'2/1','4B'],['MGT3203',3,'3/1','2A'],['MGT3204',3,'3/2','2A'],
      ['MGT3205',3,'4/2','3A'],['MGT4206',3,'3/2','1B'],['MGT4207',3,'4/1','1A'],['MGT4208',3,'4/1','2A'],['MGT4209',3,'3/2','2B']
    ]],
    ['วิชาเอกเลือก',[
      ['MGT3401',3,'2/2','3B'],['MGT3402',3,'4/2','1A'],['MGT3403',3,'3/2','3A'],['MGT3404',3,'4/1','2B'],
      ['MGT3405',3,'3/1','2B'],['MGT3408',3,'2/2','1A'],['MGT3409',3,'4/2','1B']
    ]],
    ['วิชาเลือกเสรี',[
      ['MGT3310',3,'2/1','3B'],['MGT3412',3,'4/1','4B']
    ]]
  ];
  const courses=groups.flatMap(([group,rows])=>rows.map(([code,credits,planTerm,slot])=>({code,credits,planTerm,slot,group})));
  if(new Set(courses.map(c=>c.code)).size!==courses.length)throw Error('พบรหัสวิชาซ้ำในแผนการเรียน');
  function apply(state){
    if(Number(state.curriculumVersion)>=version)return {state,changed:false,added:0,matched:0};
    const next=JSON.parse(JSON.stringify(state));
    const existing=new Map(next.courses.map(c=>[c.code.trim().toUpperCase(),c]));
    let added=0,matched=0;
    courses.forEach(source=>{
      const current=existing.get(source.code);
      if(current){
        matched++;
        if(!current.planTerm)current.planTerm=source.planTerm;
        if(!current.group)current.group=source.group;
        if(!current.slot)current.slot=source.slot;
      }else{
        const created={id:'curriculum-'+source.code.toLowerCase(),code:source.code,name:'รายวิชา '+source.code,
          credits:source.credits,planTerm:source.planTerm,group:source.group,slot:source.slot,inPlan:false,
          status:'planned',grade:'',term:'',examDate:'',examTime:'',room:''};
        next.courses.push(created);existing.set(source.code,created);
        added++;
      }
    });
    next.curriculumVersion=version;
    return {state:next,changed:true,added,matched};
  }
  return {version,courses,apply};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudyCurriculum;
