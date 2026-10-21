/* Called only under the script lock shared by saves and list migration. */
function jobReferenceDate_(value,fallback){
  if(value instanceof Date&&!isNaN(value.getTime()))return Utilities.formatDate(value,'Asia/Bangkok','yyyy-MM-dd');
  var text=String(value||'').slice(0,10);
  if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text;
  var date=new Date(fallback);return !isNaN(date.getTime())?Utilities.formatDate(date,'Asia/Bangkok','yyyy-MM-dd'):'';
}
function jobReferenceKey_(sheet,stem){return 'JOB_REF_V1:'+sheet.getSheetId()+':'+stem;}
function jobReferenceReserve_(sheet,records){
  var properties=PropertiesService.getScriptProperties(),counters={},keys={};
  records.forEach(function(record){var old=JobReferences.parse(record.reference),stem=old?old.stem:JobReferences.stem(record);keys[stem]=jobReferenceKey_(sheet,stem);});
  Object.keys(keys).forEach(function(stem){counters[stem]=Number(properties.getProperty(keys[stem]))||0;});
  var result=JobReferences.allocate(records,counters),updates={};
  Object.keys(result.counters).forEach(function(stem){if(result.counters[stem]!==counters[stem])updates[jobReferenceKey_(sheet,stem)]=String(result.counters[stem]);});
  // Persist the counter first: a failed row write may leave a gap, never reuse.
  if(Object.keys(updates).length)properties.setProperties(updates,false);
  return result.references;
}
function jobReferenceRows_(sheet){
  if(sheet.getLastRow()<2)return [];
  var rows=sheet.getRange(2,1,sheet.getLastRow()-1,30).getValues(),models=[],indices=[];
  rows.forEach(function(row,index){if(!row[0]||!String(row[6]||'').trim())return;
    indices.push(index);models.push({id:row[0],date:jobReferenceDate_(row[1],row[23]),category:row[2],createdAt:row[23] instanceof Date?row[23].toISOString():String(row[23]||''),reference:String(row[29]||'')});
  });
  var references=jobReferenceReserve_(sheet,models),changed=false;
  indices.forEach(function(index,i){if(rows[index][29]!==references[i]){rows[index][29]=references[i];changed=true;}});
  if(changed)sheet.getRange(2,30,rows.length,1).setNumberFormat('@').setValues(rows.map(function(row){return [row[29]];}));
  return rows;
}
function migrateJobReferences(){
  orRequireOwner_();var lock=LockService.getScriptLock();lock.waitLock(30000);
  try{var result=['Data Account','Chokdee'].map(function(name){var sheet=getSheet_(name),rows=jobReferenceRows_(sheet);return {store:name,count:rows.filter(function(row){return !!row[29];}).length};});console.log(JSON.stringify(result));return result;}
  finally{lock.releaseLock();}
}
