/* Transcribed from the three curriculum images supplied by the user, 2026-11-04.
   The images specify codes, credits, curriculum year/term and exam slots, not names or grades. */
var StudyCurriculum=(function(){
  'use strict';
  const version=1;
  const rows=[
    ['MGT2201','4/1','4A'],['MGT2202','2/1','4B'],
    ['MGT3203','3/1','2A'],['MGT3204','3/2','2A'],['MGT3205','4/2','3A'],
    ['MGT4206','3/2','1B'],['MGT4207','4/1','1A'],['MGT4208','4/1','2A'],['MGT4209','3/2','2B'],
    ['MGT2102','2/2','1B'],['MGT3101','4/2','3B'],['MGT3102','3/1','1B'],['MKT2101','2/1','3A'],['STA2016','3/1','3B'],
    ['MGT3401','2/2','3B','วิชาเอกเลือก'],['MGT3402','4/2','1A','วิชาเอกเลือก'],['MGT3403','3/2','3A','วิชาเอกเลือก'],
    ['MGT3404','4/1','2B','วิชาเอกเลือก'],['MGT3405','3/1','2B','วิชาเอกเลือก'],['MGT3408','2/2','1A','วิชาเอกเลือก'],['MGT3409','4/2','1B','วิชาเอกเลือก']
  ];
  const courses=rows.map(([code,planTerm,slot,group=''])=>({code,credits:3,planTerm,slot,group}));
  function apply(state){
    if(Number(state.curriculumVersion)>=version)return {state,changed:false,added:0};
    const next=JSON.parse(JSON.stringify(state));
    const existing=new Map(next.courses.map(c=>[c.code.trim().toUpperCase(),c]));
    let added=0;
    courses.forEach(source=>{
      const current=existing.get(source.code);
      if(current){
        if(!current.planTerm)current.planTerm=source.planTerm;
        if(!current.group)current.group=source.group;
        if(!current.slot)current.slot=source.slot;
      }else{
        next.courses.push({id:'curriculum-'+source.code.toLowerCase(),code:source.code,name:'รายวิชา '+source.code,
          credits:source.credits,planTerm:source.planTerm,group:source.group,slot:source.slot,
          status:'planned',grade:'',term:'',examDate:'',examTime:'',room:''});
        added++;
      }
    });
    next.curriculumVersion=version;
    return {state:next,changed:true,added};
  }
  return {version,courses,apply};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudyCurriculum;
