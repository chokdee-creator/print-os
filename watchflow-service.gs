/** Owner workspace. Called only from the authenticated ledger bridge under its script lock. */
function watchflowValidate_(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.titles) || !Array.isArray(data.events) ||
      data.titles.length > 3000 || data.events.length > 25000 || JSON.stringify(data).length > 4000000) {
    throw Error('ข้อมูล WatchFlow ไม่ถูกต้องหรือมีขนาดใหญ่เกินไป');
  }
  const text = (value, max) => {
    if (typeof value !== 'string' || value.length > max) throw Error('ข้อความ WatchFlow ไม่ถูกต้อง');
    return value;
  };
  const choice = (value, options) => {
    if (!options.includes(value)) throw Error('ตัวเลือก WatchFlow ไม่ถูกต้อง');
    return value;
  };
  const id = value => {
    if (typeof value !== 'string' || !/^[\w-]{1,100}$/.test(value)) throw Error('รหัส WatchFlow ไม่ถูกต้อง');
    return value;
  };
  const count = value => {
    if (!Number.isSafeInteger(value) || value < 0) throw Error('ความคืบหน้าไม่ถูกต้อง');
    return value;
  };
  const url = value => {
    if (text(value, 4000) && !/^https?:\/\/[^\s]+$/i.test(value)) throw Error('ลิงก์ WatchFlow ไม่ถูกต้อง');
    return value;
  };
  const cover = value => {
    if (value===undefined||value==='') return '';
    if (!text(value,43800)||!/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw Error('ภาพปก WatchFlow ไม่ถูกต้อง');
    return value;
  };
  const stamp = value => {
    if (text(value, 35) && !Number.isFinite(Date.parse(value))) throw Error('เวลา WatchFlow ไม่ถูกต้อง');
    return value;
  };
  const zones = ['Asia/Bangkok','Asia/Tokyo','Asia/Seoul','Asia/Singapore','Europe/London','America/New_York','America/Los_Angeles','UTC'];
  const modes = ['off','day','release','both'];
  const titleIds = new Set(), eventIds = new Set();
  const titles = data.titles.map(t => {
    const key = id(t.id), name = text(t.name,160);
    if (!name.trim() || titleIds.has(key)) throw Error('ชื่อเรื่อง WatchFlow ไม่ถูกต้อง');
    titleIds.add(key);
    return {
      id:key,name,type:choice(t.type,['series','anime','film','manga']),poster:url(t.poster),cover:cover(t.cover),source:url(t.source),
      provider:choice(t.provider,['','tvmaze','kitsu']),platform:text(t.platform,100),territory:text(t.territory,20),
      year:text(t.year,12),releaseStatus:text(t.releaseStatus,45),genres:text(t.genres,160),description:text(t.description,8000),
      status:choice(t.status,['','active','planned','done','hold','dropped']),season:count(t.season)||1,
      progress:count(t.progress),note:text(t.note,1200),reminder:choice(t.reminder,['default'].concat(modes)),
      updated:stamp(t.updated),synced:stamp(t.synced)
    };
  });
  const events = data.events.map(e => {
    const key = id(e.id), titleId = id(e.titleId), name = text(e.name,180);
    if (!name.trim() || !titleIds.has(titleId) || eventIds.has(key)) throw Error('กำหนดการ WatchFlow ไม่ถูกต้อง');
    eventIds.add(key);
    const certainty = choice(e.certainty,['confirmed','estimated','tba']), date = text(e.date,10), at = stamp(e.at);
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0,10) !== date)) throw Error('วันที่ WatchFlow ไม่ถูกต้อง');
    if (certainty !== 'tba' && !date && !at) throw Error('กรุณาระบุวันเผยแพร่');
    return {
      id:key,titleId,name,date:certainty==='tba'?'':date,at:certainty==='tba'?'':at,season:count(e.season)||1,
      number:count(e.number),kind:choice(e.kind,['original','thai','cinema','chapter','season']),certainty,
      platform:text(e.platform,100),territory:text(e.territory,20),source:url(e.source),automatic:e.automatic===true,
      repeatZone:certainty==='tba'||e.automatic?'':choice(e.repeatZone??'',[''].concat(zones)),
      repeatFrequency:choice(e.repeatFrequency??'weekly',['daily','weekly'])
    };
  });
  if (!data.read || typeof data.read !== 'object' || Array.isArray(data.read) || Object.keys(data.read).length > 5000) {
    throw Error('ข้อมูลแจ้งเตือน WatchFlow ไม่ถูกต้อง');
  }
  const read = {};
  for (const [key,value] of Object.entries(data.read)) {
    if (!/^[\w-]{1,100}\|[\dT:.Z-]{10,35}\|(day|release)$/.test(key) || !stamp(value)) continue;
    read[key] = value;
  }
  const s = data.settings;
  if (!s || typeof s !== 'object') throw Error('ไม่พบการตั้งค่า WatchFlow');
  const settings = {
    name:text(s.name,45),zone:choice(s.zone,zones),
    territory:text(s.territory,20),reminder:choice(s.reminder,modes)
  };
  return {version:1,titles,events,read,settings};
}
function watchflowAction_(request) {
  const key = 'watchflow:owner:v1';
  const current = orReadDelivery_(key) || {revision:'',data:null};
  if (request.command === 'watchflowGet') return {ok:true,watchflow:current};
  if (request.command !== 'watchflowSave' || typeof request.revision !== 'string') throw Error('คำขอ WatchFlow ไม่ถูกต้อง');
  if (request.revision !== current.revision) return {ok:true,conflict:true,watchflow:current};
  const incoming=request.watchflow;
  // Older tabs omit these fields when saving unrelated changes.
  if(Array.isArray(incoming?.titles)){
    const covers=new Map((current.data?.titles||[]).filter(t=>t.cover).map(t=>[t.id,t.cover]));
    incoming.titles=incoming.titles.map(title=>title&&title.cover===undefined&&covers.has(title.id)?{...title,cover:covers.get(title.id)}:title);
  }
  if(Array.isArray(incoming?.events)){
    const rules=new Map((current.data?.events||[]).filter(e=>e.repeatZone).map(e=>[e.id,e]));
    incoming.events=incoming.events.map(event=>{
      const prior=event&&rules.get(event.id);
      if(!prior)return event;
      const repeatZone=event.repeatZone??prior.repeatZone;
      return {...event,repeatZone,repeatFrequency:event.repeatFrequency??prior.repeatFrequency};
    });
  }
  const watchflow = {revision:Utilities.getUuid(),data:watchflowValidate_(incoming)};
  orWriteDelivery_(key,watchflow);
  return {ok:true,watchflow};
}
