/** Private knowledge workspaces. Invoke only after ledger login/device authentication and under ScriptLock. */
function knowledgeProfile_(profile){if(profile!=='win'&&profile!=='mana')throw Error('ไม่พบผู้ใช้คลังความรู้');return profile;}
function knowledgeEmpty_(){return {version:1,revision:'',categories:[{id:'printing',name:'เทคนิคงานพิมพ์',color:'#557c65'},{id:'design',name:'ออกแบบ & โปรแกรม',color:'#7b7fac'},{id:'tools',name:'เครื่องมือใช้งาน',color:'#b08849'},{id:'ideas',name:'ไอเดีย & แรงบันดาลใจ',color:'#568c9c'}],entries:[]};}
function knowledgeRead_(profile){return orReadDelivery_('knowledge:'+knowledgeProfile_(profile)+':v1')||knowledgeEmpty_();}
function knowledgeValidate_(data){
  if(!data||data.version!==1||!Array.isArray(data.categories)||!Array.isArray(data.entries)||data.categories.length>200||data.entries.length>10000)throw Error('ข้อมูลคลังความรู้ไม่ถูกต้อง');
  const ids=new Set(),colors=['#557c65','#7b7fac','#b08849','#568c9c','#ae7386','#8a8170'];
  function text(x,max){return typeof x==='string'&&x.length<=max;}
  function id(x){return text(x,100)&&/^[\w-]{1,100}$/.test(x);}
  const categories=data.categories.map(c=>{if(!c||!id(c.id)||ids.has(c.id)||!text(c.name,60)||!c.name.trim()||!colors.includes(c.color))throw Error('หมวดหมู่ไม่ถูกต้อง');ids.add(c.id);return{id:c.id,name:c.name.trim(),color:c.color};});ids.clear();
  const categoryIds=new Set(categories.map(c=>c.id));
  const entries=data.entries.map(e=>{
    if(!e||!id(e.id)||ids.has(e.id)||!text(e.title,180)||!e.title.trim()||!text(e.url,4000)||!text(e.note,3000)||!['note','link','video'].includes(e.type)||!Array.isArray(e.tags)||e.tags.length>12||e.tags.some(t=>!text(t,40))||typeof e.favorite!=='boolean')throw Error('รายการความรู้ไม่ถูกต้อง');
    if(e.url&&!/^https?:\/\/[^\s/@:]+(?::\d+)?(?:[/?#][^\s]*)?$/i.test(e.url))throw Error('ลิงก์ไม่ถูกต้อง');
    ids.add(e.id);const createdAt=Date.parse(e.createdAt);if(!Number.isFinite(createdAt))throw Error('วันที่บันทึกไม่ถูกต้อง');
    return{id:e.id,title:e.title.trim(),url:e.url,type:e.url?e.type:'note',category:categoryIds.has(e.category)?e.category:'',note:e.note,tags:e.tags.slice(),favorite:e.favorite,createdAt:new Date(createdAt).toISOString(),updatedAt:Number.isFinite(Date.parse(e.updatedAt))?new Date(e.updatedAt).toISOString():new Date().toISOString(),lastOpened:Number.isFinite(Date.parse(e.lastOpened))?new Date(e.lastOpened).toISOString():''};
  });return{version:1,categories,entries};
}
function knowledgeComparable_(item){if(item==null)return 'null';const sorted={};Object.keys(item).sort().filter(k=>k!=='updatedAt'&&k!=='lastOpened').forEach(k=>sorted[k]=item[k]);return JSON.stringify(sorted);}
function knowledgeAction_(data){
  const profile=knowledgeProfile_(data.profile),current=knowledgeRead_(profile);
  if(data.command==='knowledgeGet')return{ok:true,knowledge:current};
  if(data.command!=='knowledgePatch'||!Array.isArray(data.changes)||data.changes.length>10200||!/^[\w-]{20,100}$/.test(data.operationId||''))throw Error('คำขอซิงก์ไม่ถูกต้อง');
  if((current.recentOperations||[]).includes(data.operationId))return{ok:true,knowledge:current};
  if(JSON.stringify(data.changes).length>6000000)throw Error('ข้อมูลมากเกินไป กรุณาแบ่งนำเข้า');
  const conflicts=[],seen=new Set();
  for(const change of data.changes){if(!change||!['categories','entries'].includes(change.group)||!/^[\w-]{1,100}$/.test(change.id||'')||seen.has(change.group+':'+change.id)||(change.after&&change.after.id!==change.id)||(change.before&&change.before.id!==change.id))throw Error('รายการเปลี่ยนแปลงไม่ถูกต้อง');seen.add(change.group+':'+change.id);const item=current[change.group].find(e=>e.id===change.id)||null;if(knowledgeComparable_(item)!==knowledgeComparable_(change.before)&&knowledgeComparable_(item)!==knowledgeComparable_(change.after))conflicts.push(change.id);}
  if(conflicts.length)return{ok:true,conflict:true,knowledge:current};
  const next=JSON.parse(JSON.stringify(current));
  for(const change of data.changes){const rows=next[change.group],index=rows.findIndex(e=>e.id===change.id);if(change.after){if(index<0)rows.push(change.after);else rows[index]=change.after;}else if(index>=0)rows.splice(index,1);}
  const valid=knowledgeValidate_(next);valid.revision=Utilities.getUuid();valid.updatedAt=new Date().toISOString();valid.recentOperations=(current.recentOperations||[]).concat(data.operationId).slice(-30);orWriteDelivery_('knowledge:'+profile+':v1',valid);return{ok:true,knowledge:valid};
}
