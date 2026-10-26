/* Local workspaces, not authenticated accounts. Keep Win's original key intact. */
var KnowledgeProfiles=(()=>{
  const preferenceKey='print-os-knowledge-active-profile';
  const profiles={win:{name:'วิน',key:'print-os-knowledge-v1',theme:'knowledge.css',color:'#121017'},mana:{name:'มานา',key:'print-os-knowledge-mana-v1',theme:'knowledge-mana.css',color:'#ffdf00'}};
  function get(id){if(!Object.hasOwn(profiles,id))throw Error('ไม่พบผู้ใช้ที่เลือก');return profiles[id];}
  function active(storage){try{const id=storage.getItem(preferenceKey);return Object.hasOwn(profiles,id)?id:'win';}catch{return 'win';}}
  function select(storage,id){get(id);storage.setItem(preferenceKey,id);}
  function read(storage,id){return storage.getItem(get(id).key);}
  function write(storage,id,data){storage.setItem(get(id).key,JSON.stringify(data));}
  function backup(data,id){get(id);return{...data,profile:id};}
  function checkBackup(data,id){if(data?.profile&&data.profile!==id)throw Error('ไฟล์สำรองนี้เป็นของ '+(profiles[data.profile]?.name||'ผู้ใช้อื่น')+' กรุณาเลือกผู้ใช้ให้ตรงกับไฟล์ก่อนนำเข้า');}
  return{get,active,select,read,write,backup,checkBackup};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=KnowledgeProfiles;
