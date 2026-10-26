/* Local-first sync with atomic per-record checks on Google. No credentials in knowledge storage. */
var KnowledgeCloud=(()=>{
  const states=new Map();let active='win',hooks={},timer,refreshTimer;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const metaKey=p=>KnowledgeProfiles.get(p).key+':google-sync-v1';
  function state(profile,local){if(!states.has(profile)){let base=null,receipt=null;try{const saved=JSON.parse(localStorage.getItem(metaKey(profile))||'null');if(saved?.base)base=KnowledgeData.validate(saved.base);}catch{}try{receipt=JSON.parse(localStorage.getItem(KnowledgeProfiles.get(profile).key+':legacy-migration-v2')||'null');}catch{}if(receipt?.version!==2)base=null;const sourceCount=Number.isInteger(receipt?.sourceCount)?receipt.sourceCount:local.entries.length;if(local.entries.length&&!localStorage.getItem(KnowledgeProfiles.get(profile).key+':before-google-v2'))localStorage.setItem(KnowledgeProfiles.get(profile).key+':before-google-v2',JSON.stringify(KnowledgeProfiles.backup(local,profile)));states.set(profile,{profile,local:clone(local),base,sourceCount,busy:false,again:false,error:''});}return states.get(profile);}
  function summary(){hooks.summary?.([...states.values()].map(s=>({profile:s.profile,name:KnowledgeProfiles.get(s.profile).name,sourceCount:s.sourceCount,cloudCount:s.base?.entries.length??0,mode:s.mode||'waiting'})));}
  function status(s,mode,message){s.mode=mode;s.message=message;if(s.profile===active)hooks.status?.({mode,message,profile:s.profile});summary();}
  function keepVisits(next,old){const visits=new Map(old.entries.map(e=>[e.id,e.lastOpened||""]));next.entries.forEach(e=>{if((visits.get(e.id)||"")>(e.lastOpened||""))e.lastOpened=visits.get(e.id);});return next;}
  function persist(s){localStorage.setItem(KnowledgeProfiles.get(s.profile).key,JSON.stringify(s.local));if(s.base)localStorage.setItem(metaKey(s.profile),JSON.stringify({base:s.base}));hooks.apply?.(s.profile,clone(s.local));}
  function pending(s){return !s.base||KnowledgeSync.diff(s.base,s.local).length>0;}
  async function run(s,quiet=false){
    if(s.busy){s.again=true;return;}s.busy=true;s.again=false;
    s.lastStarted=Date.now();
    if(!quiet||s.mode!=='synced'||pending(s))status(s,'syncing','กำลังดึงข้อมูลล่าสุดจาก Google…');
    try{
      const reply=await AccountsCloud.knowledgeGet(s.profile),remote=KnowledgeData.validate(reply.knowledge);
      if(!s.base){s.local=KnowledgeSync.mergeLegacy(remote,s.local,KnowledgeData.id).data;s.base=remote;}
      else{const merged=KnowledgeSync.rebase(s.base,s.local,remote,KnowledgeData.id);s.local=keepVisits(merged.data,s.local);s.base=remote;if(merged.conflicts)hooks.notice?.('มีการแก้ไขชนกัน เก็บสำเนาจากเครื่องนี้ไว้ให้แล้ว');}
      persist(s);
      for(let attempt=0;attempt<4;attempt++){
        const sent=clone(s.local),base=clone(s.base),changes=KnowledgeSync.diff(base,sent);if(!changes.length)break;
        const result=await AccountsCloud.knowledgePatch(s.profile,changes,crypto.randomUUID().replace(/-/g,'')),latest=KnowledgeData.validate(result.knowledge);
        if(result.conflict){const merged=KnowledgeSync.rebase(base,s.local,latest,KnowledgeData.id);s.local=keepVisits(merged.data,s.local);s.base=latest;if(merged.conflicts)hooks.notice?.('มีการแก้ไขชนกัน เก็บทั้งสองเวอร์ชันไว้แล้ว');}
        else{const editsWhileSaving=KnowledgeSync.diff(sent,s.local);s.base=latest;s.local=keepVisits(KnowledgeSync.apply(latest,editsWhileSaving),s.local);}
        persist(s);
      }
      s.error='';if(!pending(s))localStorage.setItem(KnowledgeProfiles.get(s.profile).key+':legacy-migration-v2',JSON.stringify({version:2,sourceCount:s.sourceCount,cloudCount:s.base.entries.length,verifiedAt:new Date().toISOString()}));status(s,pending(s)?'pending':'synced',pending(s)?'มีรายการรอซิงก์ จะส่งต่อให้อัตโนมัติ':'ซิงก์กับ Google แล้ว · ดึงข้อมูลอัตโนมัติทุก 20 วินาที · '+KnowledgeProfiles.get(s.profile).name);
    }catch(error){s.error=error.message;status(s,error.needsPair?'auth':'error',error.needsPair?'เชื่อมอุปกรณ์ครั้งเดียว เพื่อใช้ข้อมูลเดียวกันทุกเครื่อง':error.message+' · ข้อมูลในเครื่องยังอยู่ครบ');}
    finally{s.busy=false;if(s.again||(!s.error&&pending(s)))schedule(s);}
  }
  function schedule(s){clearTimeout(s.timer);s.timer=setTimeout(()=>run(s),900);}
  function activate(profile,local){active=profile;const s=state(profile,local);s.local=clone(local);if(s.mode)status(s,s.mode,s.message);run(s);}
  function changed(profile,data){const s=state(profile,data);s.local=clone(data);status(s,'pending','บันทึกในเครื่องแล้ว · กำลังรอซิงก์ Google');schedule(s);}
  function retry(){for(const s of states.values())if(s.profile===active||pending(s)||s.mode==='auth')run(s);}
  function refresh(){const s=states.get(active);if(!s||s.busy||document.hidden||(typeof navigator!=='undefined'&&navigator.onLine===false))return;if(Date.now()-(s.lastStarted||0)<3000)return;run(s,true);}
  async function migrateAll(){for(const profile of ['win','mana']){try{const raw=KnowledgeProfiles.read(localStorage,profile),local=raw?KnowledgeData.validate(JSON.parse(raw)):KnowledgeData.defaults(),s=state(profile,local);if(!s.busy)await run(s,true);}catch(error){hooks.summaryError?.(profile,error.message);}}}
  function downloadOriginal(profile){const raw=localStorage.getItem(KnowledgeProfiles.get(profile).key+':before-google-v2');if(!raw)throw Error('เครื่องนี้ยังไม่พบข้อมูลเดิมของ '+KnowledgeProfiles.get(profile).name);return raw;}
  function mount(callbacks){hooks=callbacks;window.addEventListener('online',retry);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);window.addEventListener('pageshow',refresh);window.addEventListener('accounts-auth-mode',refresh);window.addEventListener('storage',event=>{if(event.key==='printOS:notebooks:device:v1'||event.key==='printOS:notebooks:login:v1')retry();});refreshTimer=setInterval(()=>{const s=states.get(active);if(s&&s.mode!=='auth')refresh();},20000);}
  return{mount,activate,changed,retry,migrateAll,downloadOriginal};
})();
