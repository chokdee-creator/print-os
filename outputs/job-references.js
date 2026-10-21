/* Display references are separate from immutable internal job IDs. */
var JobReferences=(function(){
  function prefix(category){
    var value=String(category||'').trim().toLowerCase();
    return ['ไวนิล','vinyl','v'].indexOf(value)>=0?'v':['สติ๊กเกอร์','สติกเกอร์','sticker','s'].indexOf(value)>=0?'s':'o';
  }
  function parse(value){
    var match=/^([vso]\d{6})(\d{2,})$/.exec(String(value||''));
    return match&&Number(match[2])>0?{stem:match[1],sequence:Number(match[2])}:null;
  }
  function stem(record){
    var value=String(record.date||'').slice(0,10),match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if(!match||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw new Error('วันที่งานไม่ถูกต้อง ไม่สามารถออกเลขอ้างอิง');
    return prefix(record.category)+match[1].slice(2)+match[2]+match[3];
  }
  function allocate(records,highWater){
    var counters=Object.assign({},highWater||{}),references=new Array(records.length),seen={};
    records.forEach(function(record,index){var old=parse(record.reference);if(!old)return;
      if(seen[record.reference]&&seen[record.reference]!==String(record.id))throw new Error('พบเลขอ้างอิงซ้ำในข้อมูลเดิม');
      seen[record.reference]=String(record.id);references[index]=record.reference;counters[old.stem]=Math.max(Number(counters[old.stem])||0,old.sequence);
    });
    records.map(function(record,index){return {record:record,index:index};}).sort(function(a,b){
      return String(a.record.createdAt||'').localeCompare(String(b.record.createdAt||''))||String(a.record.id).localeCompare(String(b.record.id));
    }).forEach(function(item){if(references[item.index])return;var key=stem(item.record),next=(Number(counters[key])||0)+1;
      if(!Number.isSafeInteger(next))throw new Error('ลำดับเลขอ้างอิงเกินขอบเขต');
      counters[key]=next;references[item.index]=key+String(next).padStart(2,'0');
    });
    return {references:references,counters:counters};
  }
  return {prefix:prefix,parse:parse,stem:stem,allocate:allocate};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=JobReferences;
