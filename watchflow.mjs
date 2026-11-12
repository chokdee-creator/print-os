import {syncWatchflow} from './watchflow-sync.mjs?v=google1';

const TYPES={series:'ซีรีส์',anime:'อนิเมะ',film:'ภาพยนตร์',manga:'มังงะ / การ์ตูน'};
const STATUS={active:'กำลังดู / อ่าน',planned:'วางแผนไว้',done:'จบแล้ว',hold:'พักไว้',dropped:'เลิกติดตาม'};
const CERT={confirmed:'ยืนยันแล้ว',estimated:'คาดการณ์',tba:'ยังไม่ประกาศ'};
const RELEASE={original:'ออกอากาศต้นทาง',thai:'สตรีมมิงในไทย',cinema:'เข้าฉายในโรง',chapter:'เผยแพร่ตอน / บท',season:'ประกาศซีซัน'};
const ZONES=['Asia/Bangkok','Asia/Tokyo','Asia/Seoul','Asia/Singapore','Europe/London','America/New_York','America/Los_Angeles','UTC'];
const KEY='printOS:watchflow:v1';
const PAGES={dashboard:'ภาพรวม',calendar:'ปฏิทิน',watchlist:'รายการของฉัน',discover:'ค้นหา',notifications:'แจ้งเตือน',settings:'ตั้งค่า'};
const icons={home:'<path d="M3 10.5 12 3l9 7.5V21H3z M9 21v-7h6v7"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2"/>',bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',bell:'<path d="M18 9a6 6 0 0 0-12 0c0 6-3 6-3 8h18c0-2-3-2-3-8m-8 11a2 2 0 0 0 4 0"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1-2 4 2 2v4l3 2 3-1 3 3 4-2v-3l3-2v-4l-3-2V5l-4-2-2 2z"/>'};
const icon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[name]+'</svg>';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=value=>{try{const url=new URL(value);return /^https?:$/.test(url.protocol)?url.href:'';}catch{return '';}};
const str=(value,max=250)=>String(value??'').trim().slice(0,max);
const nonneg=value=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):0;
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const uid=()=>crypto.randomUUID();
const iso=date=>date.toISOString().slice(0,10);
const day=(value,offset=0)=>iso(new Date(Date.parse(value)+offset*86400000));
const startWeek=value=>day(value,-((new Date(value).getUTCDay()+6)%7));
const fmtDay=(value,options={day:'numeric',month:'short'})=>new Intl.DateTimeFormat('th-TH',{timeZone:'UTC',...options}).format(new Date(value));
const dateFormats=new Map();
function dateParts(date,zone){
  if(!dateFormats.has(zone))dateFormats.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
  return Object.fromEntries(dateFormats.get(zone).formatToParts(date).map(p=>[p.type,p.value]));
}
export function localDay(date,zone){
  const p=dateParts(date,zone);
  return p.year+'-'+p.month+'-'+p.day;
}
export function localTimestamp(date,time,zone){
  if(!validDate(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return '';
  const wanted=Date.parse(date+'T'+time+':00Z');
  let guess=wanted;
  for(let i=0;i<4;i++){
    const p=dateParts(new Date(guess),zone);
    const shown=Date.parse(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':00Z');
    if(shown===wanted)return new Date(guess).toISOString();
    guess+=wanted-shown;
  }
  return '';
}
export function eventDay(event,zone){return event.at?localDay(new Date(event.at),zone):event.date;}
const DAY_MS=86400000;
const repeatDays=event=>event.repeatFrequency==='daily'?1:7;
function recurringOccurrence(event,date){
  const zone=event.repeatZone;
  if(!zone||!validDate(date))return null;
  const start=eventDay(event,zone);
  const offset=(Date.parse(date)-Date.parse(start))/(repeatDays(event)*DAY_MS);
  if(!Number.isInteger(offset)||offset<0)return null;
  let at='';
  if(event.at){
    const time=dateParts(new Date(event.at),zone);
    at=offset===0?event.at:localTimestamp(date,time.hour+':'+time.minute,zone);
    if(!at)return null;
  }
  return {...event,date,at,occurrence:date,number:event.number?event.number+offset:0};
}
export function eventsInRange(events,from,to,zone){
  const within=event=>{const date=eventDay(event,zone);return date>=from&&date<=to;};
  return events.flatMap(event=>{
    if(!event.repeatZone)return within(event)?[event]:[];
    const anchor=eventDay(event,event.repeatZone);
    // A timezone conversion can move a timed occurrence onto a neighboring date.
    const margin=event.at&&event.repeatZone!==zone?2:0;
    const step=repeatDays(event),limit=day(to,margin);
    const first=Math.max(0,Math.ceil((Date.parse(day(from,-margin))-Date.parse(anchor))/(step*DAY_MS)));
    const occurrences=[];
    for(let date=day(anchor,first*step);date<=limit;date=day(date,step)){
      const occurrence=recurringOccurrence(event,date);
      if(occurrence&&within(occurrence))occurrences.push(occurrence);
    }
    return occurrences;
  });
}
const occurrenceRef=e=>e.occurrence?e.id+'~'+e.occurrence:e.id;
const occurrenceNumber=(e,t)=>e.occurrence&&e.number&&t.type!=='film'?(t.type==='manga'?'บทที่ ':'ตอนที่ ')+e.number:'';
const repeatLabel=e=>e.repeatZone?(e.repeatFrequency==='daily'?'ทุกวัน':'ทุก'+fmtDay(eventDay(e,e.repeatZone),{weekday:'long'})):'';
const blank=()=>({version:1,titles:[],events:[],read:{},settings:{name:'',zone:'Asia/Bangkok',territory:'',reminder:'off'}});
const today=()=>localDay(new Date(),state.settings.zone);
const matchTerritory=(territory,filter)=>!filter||territory.toUpperCase()===filter;
const followed=t=>Boolean(t?.status);
const isWatched=(t,e)=>Boolean(followed(t)&&(t.status==='done'||(e.number>0&&(t.season>e.season||(t.season===e.season&&t.progress>=e.number)))));
const displayTime=(e,zone=state.settings.zone)=>e.at?new Intl.DateTimeFormat('th-TH',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(e.at)):'';
const option=(map,value)=>Object.entries(map).map(([key,label])=>'<option value="'+esc(key)+'"'+(key===value?' selected':'')+'>'+esc(label)+'</option>').join('');
const button=(action,label,id='',cls='')=>'<button type="button" data-action="'+action+'"'+(id?' data-id="'+esc(id)+'"':'')+(cls?' class="'+cls+'"':'')+'>'+label+'</button>';
const a=(page,label,cls='')=>'<a class="button '+cls+'" href="#'+page+'">'+label+'</a>';
const badge=type=>'<span class="badge '+type+'">'+TYPES[type]+'</span>';
const cert=e=>'<span class="badge '+e.certainty+'">'+CERT[e.certainty]+'</span>';
const poster=(t,cls='')=>(t.cover||t.poster)?'<img class="poster '+cls+'" src="'+esc(t.cover||t.poster)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'<div aria-hidden="true" class="poster '+t.type+' '+cls+'">'+esc(Array.from(t.name)[0]||'▶')+'</div>';
const heading=(title,sub='',actions='')=>'<div class="heading"><div><h1>'+title+'</h1><p>'+sub+'</p></div><div class="actions">'+actions+'</div></div>';
const empty=(title,desc='',actions='')=>'<div class="empty"><strong>'+title+'</strong><p>'+desc+'</p>'+(actions?'<div class="actions">'+actions+'</div>':'')+'</div>';
const lookup=id=>state.titles.find(t=>t.id===id);
const titleFor=id=>lookup(id)||results.find(t=>t.id===id);
const nextFor=t=>{
  const now=today(),zone=state.settings.zone,events=state.events.filter(e=>e.titleId===t.id);
  return events.filter(e=>!e.repeatZone&&eventDay(e,zone)>=now)
    .concat(eventsInRange(events.filter(e=>e.repeatZone),now,day(now,56),zone)).sort(compare)[0];
};
const compare=(x,y)=>(eventDay(x,state.settings.zone)||'9999').localeCompare(eventDay(y,state.settings.zone)||'9999')||(x.at||'').localeCompare(y.at||'');
const progress=t=>t.type==='film'?'ภาพยนตร์':t.type==='manga'?'บทที่ '+t.progress:'ซีซัน '+t.season+' · ตอนที่ '+t.progress;
const summary=t=>[t.year,t.genres,t.platform].filter(Boolean).join(' · ');
const timeText=e=>[eventDay(e,state.settings.zone)&&fmtDay(eventDay(e,state.settings.zone)),displayTime(e)].filter(Boolean).join(' · ')||'ยังไม่ประกาศวัน';
const coverImage=value=>typeof value==='string'&&value.length<=43800&&/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)?value:'';
const cleanTitle=t=>({id:str(t.id,100),name:str(t.name,160),type:Object.hasOwn(TYPES,t.type)?t.type:'series',poster:link(t.poster),cover:coverImage(t.cover),source:link(t.source),provider:['tvmaze','kitsu'].includes(t.provider)?t.provider:'',platform:str(t.platform,100),territory:str(t.territory,20).toUpperCase(),year:str(t.year,12),releaseStatus:str(t.releaseStatus,45),genres:str(t.genres,160),description:str(t.description,8000),status:Object.hasOwn(STATUS,t.status)?t.status:'',season:nonneg(t.season)||1,progress:nonneg(t.progress),note:str(t.note,1200),reminder:['default','off','day','release','both'].includes(t.reminder)?t.reminder:'default',updated:str(t.updated,35),synced:str(t.synced,35)});
const cleanEvent=e=>({id:str(e.id,100),titleId:str(e.titleId,100),name:str(e.name,180),date:validDate(e.date)?e.date:'',at:typeof e.at==='string'&&e.at&&Number.isFinite(Date.parse(e.at))?new Date(e.at).toISOString():'',season:nonneg(e.season)||1,number:nonneg(e.number),kind:Object.hasOwn(RELEASE,e.kind)?e.kind:'original',certainty:Object.hasOwn(CERT,e.certainty)?e.certainty:'tba',platform:str(e.platform,100),territory:str(e.territory,20).toUpperCase(),source:link(e.source),automatic:e.automatic===true,repeatZone:!e.automatic&&e.certainty!=='tba'&&ZONES.includes(e.repeatZone)&&(validDate(e.date)||(typeof e.at==='string'&&e.at&&Number.isFinite(Date.parse(e.at))))?e.repeatZone:'',repeatFrequency:e.repeatFrequency==='daily'?'daily':'weekly'});
export function restore(data){
  if(data?.version!==1||!Array.isArray(data.titles)||!Array.isArray(data.events))throw Error('ไฟล์ข้อมูล WatchFlow ไม่ถูกต้อง');
  if(data.titles.length>3000||data.events.length>25000)throw Error('ไฟล์มีรายการมากเกินไป');
  const titles=[...new Map(data.titles.filter(t=>t&&t.id&&t.name).map(cleanTitle).map(t=>[t.id,t])).values()];
  const ids=new Set(titles.map(t=>t.id));
  const events=[...new Map(data.events.filter(e=>e&&e.id&&ids.has(e.titleId)).map(cleanEvent).map(e=>[e.id,e])).values()].map(e=>{
    if(e.certainty==='tba'||(!e.date&&!e.at))return {...e,certainty:'tba',date:'',at:''};
    return e;
  });
  const s=data.settings||{};
  const read=Object.fromEntries(Object.entries(data.read||{}).filter(([key,value])=>key.length<=200&&typeof value==='string'&&Number.isFinite(Date.parse(value))).slice(-5000));
  return {version:1,titles,events,read,settings:{name:str(s.name,45),zone:ZONES.includes(s.zone)?s.zone:'Asia/Bangkok',territory:str(s.territory,20).toUpperCase(),reminder:['off','day','release','both'].includes(s.reminder)?s.reminder:'off'}};
}
export function dueAlerts(data,now){
  const {zone,reminder}=data.settings;
  const current=localDay(now,zone),byId=new Map(data.titles.map(t=>[t.id,t]));
  const alerts=[];
  for(const e of eventsInRange(data.events,day(current,-6),day(current,1),zone)){
    const t=byId.get(e.titleId),date=eventDay(e,zone);
    if(!followed(t)||!date||e.certainty==='tba')continue;
    const mode=t.reminder==='default'?reminder:t.reminder;
    const stamp=e.at||e.date;
    if((mode==='day'||mode==='both')&&day(date,-1)===current)alerts.push({id:e.id+'|'+stamp+'|day',date:current,t,e,label:'กำหนดเผยแพร่พรุ่งนี้'});
    if((mode==='release'||mode==='both')&&date<=current&&date>=day(current,-6)&&(!e.at||Date.parse(e.at)<=now.getTime()))alerts.push({id:e.id+'|'+stamp+'|release',date,t,e,label:'ถึงวันเผยแพร่แล้ว'});
  }
  return alerts.sort((a,b)=>b.date.localeCompare(a.date));
}
function demoData(){
  const data=blank();
  const labels=[['คลื่นสุดท้าย','series','ซีซัน 2 · ตอนที่ 5'],['จดหมายจากดาวเหนือ','anime','ตอนที่ 8'],['หลังแสงจอ','film','เข้าฉายในโรง'],['ร้านหนังสือเที่ยงคืน','manga','บทที่ 18']];
  const base=localDay(new Date(),data.settings.zone);
  labels.forEach(([name,type,label],i)=>{
    const id='demo-'+i;
    data.titles.push(cleanTitle({id,name,type,status:i<2?'active':'planned',season:i===0?2:1,progress:i===0?4:0,description:'เรื่องสมมติสำหรับทดลองใช้ WatchFlow',platform:'ช่องทางตัวอย่าง'}));
    data.events.push(cleanEvent({id:'demo-event-'+i,titleId:id,name:label,date:day(base,i*2),kind:i===2?'cinema':i===3?'chapter':'original',season:i===0?2:1,number:[5,8,1,18][i],certainty:i===2?'estimated':'confirmed',platform:'ช่องทางตัวอย่าง'}));
  });
  return data;
}
let state=blank(), demo=false, storageError=false, page='dashboard', date='', calendarMode='month';
let filters={type:'',certainty:'',platform:'',territory:'',all:false}, listFilter={type:'',status:'',q:'',sort:'recent'};
let results=[], discoveryFilters={}, searchQuery='', searchType='series', searchState='', searchController, syncing=false, toastTimer, dialogReturn;
let view, modal, cloudBase=null, cloudBusy=false, cloudTimer, cloudPending=false, cloudChanged=false;
function persist(){
  if(demo)return;
  try{localStorage.setItem(KEY,JSON.stringify({...state,cloudBase}));storageError=false;}
  catch{storageError=true;}
  document.getElementById('storageBanner').hidden=!storageError;
}
function readSnapshot(){
  const raw=localStorage.getItem(KEY);
  if(!raw)return null;
  const saved=JSON.parse(raw);
  return {state:restore(saved),base:saved.cloudBase?restore(saved.cloudBase):null};
}
function load(){
  try{const saved=readSnapshot();cloudBase=saved?.base||null;return saved?.state||blank();}
  catch{storageError=true;cloudBase=null;return blank();}
}
function cloudStatus(label,detail='',pair=false){
  document.getElementById('cloudLabel').textContent=label;
  document.getElementById('cloudDetail').textContent=detail;
  document.getElementById('cloudPair').hidden=!pair;
  document.getElementById('cloudRefresh').disabled=cloudBusy;
}
function queueCloud(delay=650){
  clearTimeout(cloudTimer);
  cloudTimer=setTimeout(()=>refreshCloud(),delay);
}
function save(){
  if(demo)return;
  persist();
  cloudPending=true;
  if(!cloudBusy)cloudStatus('บันทึกในเครื่องแล้ว','กำลังรอซิงก์ขึ้น Google Drive');
  queueCloud();
}
function cloudSnapshot(){
  if(demo)return null;
  if(!storageError){try{const saved=readSnapshot();if(saved)return saved;}catch{}}
  return {state:structuredClone(state),base:cloudBase};
}
async function refreshCloud(){
  if(demo||cloudBusy||(modal.open&&!cloudPending))return;
  if(!navigator.onLine){cloudStatus('ออฟไลน์ · เก็บข้อมูลในเครื่อง','จะซิงก์เมื่อกลับมาออนไลน์');return;}
  cloudBusy=true;
  cloudStatus('กำลังซิงก์ Google Drive…');
  let retry=false, applied=false;
  try{
    retry=await syncWatchflow({
      client:window.AccountsCloud,snapshot:cloudSnapshot,normalize:restore,empty:blank(),
      apply(next,base){
        if(demo)return;
        const changed=JSON.stringify(state)!==JSON.stringify(next);
        state=next;cloudBase=base;persist();applied=true;
        if(changed){
          if(modal.open||view.querySelector('form')?.contains(document.activeElement)){cloudChanged=true;updateBadge();}
          else render();
        }
      }
    });
    if(applied){
      cloudPending=Boolean(retry);
      cloudStatus(retry?'กำลังซิงก์การแก้ไขล่าสุด…':'ซิงก์กับ Google แล้ว',retry?'':'เปิด WatchFlow บนอุปกรณ์ที่จับคู่ไว้เพื่อดูข้อมูลชุดเดียวกัน');
    }
  }catch(error){
    cloudStatus(error.needsPair?'ใช้สิทธิ์จากหน้าบัญชี':'ยังซิงก์กับ Google ไม่สำเร็จ',
      error.needsPair?'จับคู่อุปกรณ์นี้ครั้งเดียวในหน้าบัญชี แล้วกลับมาที่ WatchFlow':'ข้อมูลที่แก้ไขจะรอซิงก์เมื่อเชื่อมต่อได้อีกครั้ง',Boolean(error.needsPair));
  }finally{
    cloudBusy=false;
    document.getElementById('cloudRefresh').disabled=false;
    if(retry||(!applied&&!demo&&cloudPending&&window.AccountsCloud?.mode()!=='none'))queueCloud(retry?300:45000);
  }
}
function toast(message){
  const box=document.getElementById('toast');
  box.textContent=message;clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{box.textContent='';},4200);
}
function eventCard(e){
  const t=lookup(e.titleId);
  if(!t)return '';
  const watched=isWatched(t,e);
  return '<article class="event '+t.type+'">'+poster(t)+'<div><div class="when">'+esc(timeText(e))+'</div><h3>'+esc(t.name)+'</h3><p>'+esc([e.name,occurrenceNumber(e,t),repeatLabel(e),e.platform,e.territory].filter(Boolean).join(' · '))+'</p><div class="meta">'+cert(e)+(watched?'<span class="badge seen">✓ ดู / อ่านแล้ว</span>':'')+'</div></div><div class="event-action">'+button('event','รายละเอียด',occurrenceRef(e))+'</div></article>';
}
const eventList=events=>'<div class="events">'+events.map(eventCard).join('')+'</div>';
function mediaCard(t,discover=false){
  const active=followed(lookup(t.id));
  const next=!discover&&nextFor(t);
  return '<article class="media">'+poster(t)+'<div>'+badge(t.type)+'<h3>'+esc(t.name)+'</h3><p>'+esc(discover?(summary(t)||'ข้อมูลชื่อเรื่อง'):(STATUS[t.status]+' · '+progress(t)))+'</p>'+(next?'<p>ครั้งถัดไป '+esc(timeText(next))+'</p>':'')+'<div class="actions">'+button('title',discover?'ดูเรื่อง':'จัดการ',t.id)+(discover&&!active?button('follow','＋ ติดตาม',t.id,'primary'):'')+'</div></div></article>';
}
function dashboard(){
  const now=today(), through=day(now,6);
  const all=state.events.filter(e=>followed(lookup(e.titleId))&&e.certainty!=='tba');
  const week=eventsInRange(all,now,through,state.settings.zone).sort(compare);
  const counts=[state.titles.filter(followed).length,week.filter(e=>eventDay(e,state.settings.zone)===now&&e.certainty==='confirmed').length,week.length];
  const active=state.titles.filter(t=>t.status==='active').sort((a,b)=>b.updated.localeCompare(a.updated)).slice(0,4);
  const tiles=Array.from({length:12},(_,i)=>'<span'+(i===6?' class="lit"':'')+'>'+String(i+1).padStart(2,'0')+'</span>').join('');
  const panels='<div class="grid"><section class="panel"><div class="panel-title"><div><span class="eyebrow">NEXT 7 DAYS</span><h2>กำหนดการสัปดาห์นี้</h2></div>'+a('calendar','เปิดปฏิทิน →','ghost')+'</div>'+(week.length?eventList(week.slice(0,7)):empty('ยังไม่มีกำหนดเผยแพร่','ติดตามเรื่องแล้วเพิ่มวันเผยแพร่เพื่อให้แสดงที่นี่',a('discover','ค้นหาชื่อเรื่อง')))+'</section><section class="panel"><div class="panel-title"><div><span class="eyebrow">IN PROGRESS</span><h2>ดูหรืออ่านต่อ</h2></div>'+a('watchlist','รายการของฉัน','ghost')+'</div>'+(active.length?'<div class="media-grid">'+active.map(t=>mediaCard(t)).join('')+'</div>':empty('ยังไม่มีเรื่องที่กำลังดูหรืออ่าน','เปลี่ยนสถานะเรื่องที่ติดตามเป็นกำลังดู / อ่าน'))+'</section></div>';
  const announced=week.filter(e=>e.kind==='season');
  return '<section class="hero"><div class="hero-copy"><span class="eyebrow">WATCHFLOW / '+esc(fmtDay(now,{day:'numeric',month:'long'}))+'</span><h1>เรื่องที่รอ<br>วันไหนได้ดู</h1><p>รวมวันฉายและตอนใหม่ของเรื่องที่คุณติดตาม แล้วกลับมาดูหรืออ่านต่อจากจุดเดิมได้ทุกเมื่อ</p><div class="actions">'+a('calendar','เปิดปฏิทิน','primary')+button('manual','＋ เพิ่มเรื่อง')+(!demo&&!state.titles.length?button('demo','ลองข้อมูลตัวอย่าง','','ghost'):'')+'</div></div><div class="frame" aria-hidden="true"><div class="frame-caption"><span>WATCHFLOW</span><span>FRAME / 07</span></div><div class="frame-inner">'+tiles+'</div></div></section><div class="stats">'+['เรื่องที่ติดตาม','ยืนยันฉายวันนี้','กำหนดใน 7 วัน'].map((label,i)=>'<div class="stat"><span>'+label+'</span><strong>'+counts[i]+'</strong></div>').join('')+'</div>'+panels+(announced.length?'<section class="panel agenda"><h2>ประกาศซีซัน</h2>'+eventList(announced)+'</section>':'');
}
function filterSelect(name,label,map,value){
  return '<label>'+label+'<select data-filter="'+name+'">'+option(map,value)+'</select></label>';
}
function calendar(){
  const zone=state.settings.zone;
  const all=state.events.filter(e=>lookup(e.titleId)&&(filters.all||followed(lookup(e.titleId))));
  const platforms=[...new Set(all.map(e=>e.platform).filter(Boolean))].sort();
  const regions=[...new Set(all.map(e=>e.territory).filter(Boolean))].sort();
  const matching=all.filter(e=>(!filters.type||lookup(e.titleId).type===filters.type)&&(!filters.certainty||e.certainty===filters.certainty)&&(!filters.platform||e.platform===filters.platform)&&matchTerritory(e.territory,filters.territory));
  const now=today(), first=calendarMode==='month'?date.slice(0,7)+'-01':startWeek(date);
  const last=calendarMode==='month'?day(iso(new Date(Date.UTC(+date.slice(0,4),+date.slice(5,7),1))),-1):day(first,6);
  const start=startWeek(first), end=day(startWeek(last),6);
  const found=eventsInRange(matching,calendarMode==='agenda'?date:start,calendarMode==='agenda'?day(date,29):end,zone).sort(compare);
  const byDay=new Map();
  for(const e of found){
    const key=eventDay(e,zone);
    if(!byDay.has(key))byDay.set(key,[]);
    byDay.get(key).push(e);
  }
  const dates=[];
  for(let d=start;d<=end;d=day(d,1))dates.push(d);
  const cells=dates.map(d=>{
    const events=byDay.get(d)||[];
    const dots=[...new Set(events.map(e=>lookup(e.titleId).type))].map(type=>'<i class="'+type+'"></i>').join('');
    return '<button type="button" class="day'+(d<first||d>last?' outside':'')+'" data-action="day" data-id="'+d+'" aria-label="'+esc(fmtDay(d,{dateStyle:'long'})+', '+events.length+' รายการ')+'" aria-pressed="'+(date===d)+'"'+(d===now?' aria-current="date"':'')+'><span>'+Number(d.slice(-2))+'</span><div class="day-dots" aria-hidden="true">'+dots+'</div>'+(events.length?'<small>'+events.length+' รายการ</small>':'')+'</button>';
  }).join('');
  const visible=calendarMode==='agenda'?found.filter(e=>{const d=eventDay(e,zone);return d>=date&&d<=day(date,29);}):byDay.get(date)||[];
  const uncertain=matching.filter(e=>e.certainty==='tba');
  const legend=Object.keys(TYPES).map(badge).join(' ');
  const monthLabel=calendarMode==='month'?fmtDay(date,{month:'long',year:'numeric'}):calendarMode==='week'?fmtDay(first)+' – '+fmtDay(last):fmtDay(date)+' – '+fmtDay(day(date,29));
  return heading('ปฏิทินวันเผยแพร่','แสดงวันตาม '+esc(zone)+' · วันที่ไม่มีเวลาใช้วันตามแหล่งข้อมูล',button('release-form','＋ เพิ่มกำหนดการ','','primary'))+
  '<section class="panel"><div class="chips" aria-label="รูปแบบปฏิทิน">'+Object.entries({month:'เดือน',week:'สัปดาห์',agenda:'รายการ'}).map(([k,v])=>'<button type="button" data-action="mode" data-id="'+k+'" aria-pressed="'+(calendarMode===k)+'">'+v+'</button>').join('')+'</div><div class="toolbar calendar-filters">'+
  filterSelect('type','ประเภท',{'':'ทั้งหมด',...TYPES},filters.type)+filterSelect('certainty','ความแน่นอน',{'':'ทั้งหมด',...CERT},filters.certainty)+
  filterSelect('platform','ช่องทาง',Object.fromEntries([['','ทั้งหมด'],...platforms.map(x=>[x,x])]),filters.platform)+
  filterSelect('territory','พื้นที่',Object.fromEntries([['','ทั้งหมด'],...regions.map(x=>[x,x])]),filters.territory)+
  '<label class="switch"><input type="checkbox" data-filter="all"'+(filters.all?' checked':'')+'> แสดงทุกเรื่องที่บันทึก</label></div><div class="calendar-bar"><h2>'+esc(monthLabel)+'</h2><div class="actions">'+button('prev','‹ ก่อนหน้า')+button('today','วันนี้')+button('next','ถัดไป ›')+'</div></div>'+
  (calendarMode==='agenda'?'<div class="toolbar"><label>เริ่มจากวันที่ <input type="date" id="agendaDate" value="'+date+'"></label></div>':'<div class="calendar">'+['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'].map(w=>'<div class="weekday">'+w+'</div>').join('')+cells+'</div>')+
  '<div class="toolbar">'+legend+'</div></section><section class="panel agenda"><h2>'+(calendarMode==='agenda'?'กำหนดการ 30 วัน':esc(fmtDay(date,{dateStyle:'full'})))+'</h2>'+(visible.length?eventList(visible):empty('ไม่มีกำหนดการในช่วงที่เลือก','เปลี่ยนวัน ตัวกรอง หรือเพิ่มกำหนดการจากชื่อเรื่องที่บันทึก'))+'</section>'+
  (uncertain.length?'<section class="panel agenda"><h2>ยังไม่ประกาศวัน</h2>'+eventList(uncertain)+'</section>':'');
}
function watchlist(){
  const saved=state.titles.filter(followed);
  const q=listFilter.q.toLocaleLowerCase();
  const shown=saved.filter(t=>(!listFilter.status||t.status===listFilter.status)&&(!listFilter.type||t.type===listFilter.type)&&(!q||(t.name+' '+t.note).toLocaleLowerCase().includes(q)));
  const dates=new Map(shown.map(t=>{const e=nextFor(t);return [t.id,e?eventDay(e,state.settings.zone):'9999'];}));
  shown.sort((a,b)=>listFilter.sort==='name'?a.name.localeCompare(b.name,'th'):listFilter.sort==='release'?dates.get(a.id).localeCompare(dates.get(b.id)):b.updated.localeCompare(a.updated));
  return heading('รายการของฉัน',saved.length+' เรื่องที่ติดตาม',button('manual','＋ เพิ่มเรื่องเอง','','primary')+button('sync',syncing?'กำลังอัปเดต…':'อัปเดตกำหนดซีรีส์'))+
  '<section class="panel"><form id="listSearch" class="search-page"><label>ค้นหาในรายการ<input type="search" name="q" value="'+esc(listFilter.q)+'" placeholder="ชื่อเรื่องหรือโน้ต"></label><button>ค้นหา</button></form><div class="toolbar">'+
  filterSelect('list-type','ประเภท',{'':'ทั้งหมด',...TYPES},listFilter.type)+filterSelect('list-status','สถานะ',{'':'ทั้งหมด',...STATUS},listFilter.status)+
  filterSelect('list-sort','เรียงตาม',{recent:'อัปเดตล่าสุด',name:'ชื่อเรื่อง',release:'กำหนดเผยแพร่ใกล้ที่สุด'},listFilter.sort)+'</div></section>'+
  (shown.length?'<div class="media-grid">'+shown.map(t=>mediaCard(t)).join('')+'</div>':empty(saved.length?'ไม่พบเรื่องที่ตรงกับตัวกรอง':'ยังไม่มีเรื่องที่ติดตาม','ค้นหาชื่อเรื่องหรือเพิ่มเรื่องด้วยตัวเอง',a('discover','ค้นหาชื่อเรื่อง')));
}
function discover(){
  const traits={genres:'แนว',territory:'ประเทศ',year:'ปี',platform:'ช่องทาง',releaseStatus:'สถานะเผยแพร่'};
  const values=(t,k)=>k==='genres'?t[k].split(',').map(s=>s.trim()).filter(Boolean):[t[k]].filter(Boolean);
  const matching=results.filter(t=>Object.keys(traits).every(k=>!discoveryFilters[k]||values(t,k).includes(discoveryFilters[k])));
  const controls=Object.entries(traits).map(([k,label])=>{
    const choices=[...new Set(results.flatMap(t=>values(t,k)))].sort();
    return choices.length?filterSelect('discover-'+k,label,Object.fromEntries([['','ทั้งหมด'],...choices.map(x=>[x,x])]),discoveryFilters[k]||''):'';
  }).join('');
  const resultState=searchState==='loading'?empty('กำลังค้นหา…','รอผลจากแหล่งข้อมูลสักครู่'):searchState==='error'?empty('ค้นหาไม่สำเร็จ','ลองใหม่เมื่อการเชื่อมต่อพร้อม หรือเพิ่มเรื่องด้วยตัวเอง',button('manual','＋ เพิ่มเรื่องเอง')):results.length?(matching.length?'<div class="media-grid">'+matching.map(t=>mediaCard(t,true)).join('')+'</div>':empty('ไม่พบผลที่ตรงกับตัวกรอง','ลองเลือกตัวกรองอื่น')):searchState==='done'?empty('ไม่พบชื่อเรื่อง','ลองค้นด้วยชื่อภาษาอังกฤษหรือเพิ่มด้วยตัวเอง',button('manual','＋ เพิ่มเรื่องเอง')):empty('เริ่มค้นหาจากชื่อเรื่อง','ค้นหาซีรีส์ผ่าน TVmaze หรือค้นอนิเมะและมังงะผ่าน Kitsu');
  return heading('ค้นหาชื่อเรื่อง','ค้นจากฐานข้อมูลภายนอก หรือเพิ่มเรื่องและกำหนดการของคุณเอง',button('manual','＋ เพิ่มเรื่องเอง','','primary'))+
  '<section class="panel"><form id="discoverSearch" class="search-page"><label>ชื่อเรื่อง<input type="search" name="q" value="'+esc(searchQuery)+'" placeholder="เช่น Severance หรือ Frieren" required minlength="2" maxlength="100"></label><label>ประเภท<select name="type">'+option(TYPES,searchType)+'</select></label><button class="primary">ค้นหา</button></form><p class="muted">ค้นภาพยนตร์จากรายการที่บันทึกไว้ วันที่ฉายในไทยและวันออกบทมังงะเพิ่มได้จากประกาศต้นทาง</p>'+(controls?'<div class="toolbar discovery-filters">'+controls+'</div>':'')+'</section><div aria-live="polite">'+resultState+'</div>';
}
function inbox(){
  const alerts=dueAlerts(state,new Date());
  return heading('แจ้งเตือน','แจ้งเตือนใน WatchFlow · '+esc(state.settings.zone),alerts.some(n=>!state.read[n.id])?button('read-all','อ่านทั้งหมด'):'')+
  '<section class="panel">'+(alerts.length?alerts.map(n=>'<article class="notification'+(!state.read[n.id]?' unread':'')+'"><div><strong>'+esc(n.label+' · '+n.t.name)+'</strong><p>'+esc(timeText(n.e))+' · '+cert(n.e)+'</p></div>'+button('alert','เปิด',n.id)+'</article>').join(''):empty('ยังไม่มีการแจ้งเตือน','เปิดการเตือนก่อนวันหรือวันเผยแพร่จากหน้าตั้งค่าหรือรายละเอียดเรื่อง',a('settings','ตั้งค่าการเตือน')))+'</section>';
}
const REMINDERS={off:'ปิด',day:'ก่อนวันเผยแพร่ 1 วัน',release:'วันเผยแพร่',both:'ทั้งสองช่วง'};
function settings(){
  const s=state.settings;
  return heading('ตั้งค่า','โปรไฟล์และข้อมูล WatchFlow', '<a class="button" href="index.html">← กลับเว็บร้าน</a>')+
  '<section class="panel settings"><h2>โปรไฟล์และเวลา</h2><form id="settingsForm"><div class="form-grid"><label>ชื่อที่แสดง<input name="name" maxlength="45" value="'+esc(s.name)+'" placeholder="WatchFlow"></label><label>เขตเวลา<select name="zone">'+option(Object.fromEntries(ZONES.map(x=>[x,x])),s.zone)+'</select></label><label>รหัสประเทศที่ใช้กรอกกำหนดการ<input name="territory" maxlength="20" value="'+esc(s.territory)+'" placeholder="เช่น TH"></label><label>แจ้งเตือนเริ่มต้น<select name="reminder">'+option(REMINDERS,s.reminder)+'</select></label></div><p class="muted">ระบบแสดงการเตือนเมื่อเปิดหน้าเว็บ ตั้งค่าแยกตามเรื่องได้</p><button class="primary">บันทึกการตั้งค่า</button></form></section>'+
  '<section class="panel settings"><h2>ข้อมูลของฉัน</h2><p class="muted">ซิงก์รายการและความคืบหน้าผ่าน Google Drive โดยใช้สิทธิ์จากหน้าบัญชี ดาวน์โหลดไฟล์สำรองได้ทุกเมื่อ</p><div class="actions">'+button('export','ดาวน์โหลดข้อมูล')+button('import','นำเข้าข้อมูล')+button('clear','ล้างข้อมูล','','danger')+(!demo?button('demo','ลองข้อมูลตัวอย่าง','','ghost'):'')+'</div><input type="file" id="importFile" accept="application/json,.json" hidden></section>';
}
const views={dashboard,calendar,watchlist,discover,notifications:inbox,settings};
function updateBadge(){
  const count=dueAlerts(state,new Date()).filter(n=>!state.read[n.id]).length;
  const badge=document.getElementById('navUnread');
  badge.hidden=!count;
  badge.textContent=count>99?'99+':count;
}
function render(){
  cloudChanged=false;
  document.getElementById('cloudStatus').hidden=demo;
  document.getElementById('demoBanner').hidden=!demo;
  document.getElementById('storageBanner').hidden=!storageError;
  document.getElementById('crumb').textContent=PAGES[page];
  document.querySelector('.profile').textContent=Array.from(state.settings.name)[0]||'W';
  document.querySelectorAll('#navigation a').forEach(a=>{if(a.hash==='#'+page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  view.innerHTML=views[page]();
  updateBadge();
}
function route(moveFocus=false){
  const hash=location.hash.slice(1);
  page=Object.hasOwn(views,hash)?hash:'dashboard';
  document.title=PAGES[page]+' · WatchFlow | PRINT OS';
  render();
  if(moveFocus){document.getElementById('main').focus({preventScroll:true});window.scrollTo(0,0);}
}
function openDialog(title,body){
  if(!modal.open)dialogReturn=document.activeElement;
  modal.innerHTML='<header><h2 id="dialogTitle">'+title+'</h2>'+button('close','<span aria-hidden="true">×</span><span class="visually-hidden">ปิด</span>','','ghost')+'</header>'+body;
  if(!modal.open)modal.showModal();
  (modal.querySelector('[autofocus],input:not([type=hidden]),select')||modal.querySelector('button'))?.focus();
}
const field=(name,label,value='',extra='',cls='')=>'<label class="'+cls+'">'+label+'<input name="'+name+'" value="'+esc(value)+'" '+extra+'></label>';
const select=(name,label,map,value,cls='')=>'<label class="'+cls+'">'+label+'<select name="'+name+'">'+option(map,value)+'</select></label>';
const formActions=(label='บันทึก')=>'<p class="error" role="alert"></p><div class="actions"><button class="primary">'+label+'</button>'+button('close','ยกเลิก','','ghost')+'</div>';
const coverDragTypes=['Files','text/html','text/uri-list','text/x-moz-url','text/plain'];
const maxCoverSourceBytes=20*1024*1024;
function droppedCover(transfer){
  const template=document.createElement('template');
  template.innerHTML=transfer.getData('text/html');
  // Use the picture itself rather than the page it links to.
  const urls=[...template.content.querySelectorAll('img[src]')].map(img=>img.getAttribute('src'));
  urls.push(...transfer.getData('text/uri-list').split(/\r?\n/).filter(line=>!line.startsWith('#')),
    transfer.getData('text/x-moz-url').split(/\r?\n/,1)[0],transfer.getData('text/plain'));
  for(const value of urls){
    if(value.length<=Math.ceil(maxCoverSourceBytes/3)*4+100&&/^data:image\/(png|jpe?g|webp|gif|avif|bmp);base64,/i.test(value))return value;
    const url=link(value);
    if(url)return url;
  }
  return '';
}
async function fetchCoverSource(url,signal){
  const response=await fetch(url,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',signal});
  if(!response.ok||!response.body)throw Error('เปิดรูปจากเว็บต้นทางไม่ได้');
  const type=(response.headers.get('content-type')||'').split(';',1)[0].trim().toLowerCase();
  if(type&&!type.startsWith('image/')&&type!=='application/octet-stream')throw Error('ลิงก์นี้ไม่ใช่ไฟล์ภาพ');
  if(Number(response.headers.get('content-length'))>maxCoverSourceBytes)throw Error('ไฟล์ภาพใหญ่เกิน 20 MB');
  const reader=response.body.getReader(),chunks=[];
  let size=0;
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>maxCoverSourceBytes)throw Error('ไฟล์ภาพใหญ่เกิน 20 MB');
      chunks.push(value);
    }
  }finally{
    void reader.cancel().catch(()=>{});
    reader.releaseLock();
  }
  return new Blob(chunks,{type:type.startsWith('image/')?type:'image/png'});
}
function setupCoverPicker(form,initialCover){
  const area=form.querySelector('.cover-drop'),file=form.querySelector('#coverFile');
  const preview=form.querySelector('.cover-preview'),remove=form.querySelector('#coverRemove');
  const archive=form.querySelector('#coverArchive');
  const status=form.querySelector('#coverStatus'),submitButton=form.querySelector('button[type=submit],button.primary');
  let active;
  function show(){
    const image=form.elements.cover.value||link(form.elements.poster.value);
    preview.hidden=!image;
    if(image){preview.referrerPolicy='no-referrer';preview.src=image;}
    else preview.removeAttribute('src');
    remove.hidden=!form.elements.cover.value;
    archive.hidden=!!form.elements.cover.value||!link(form.elements.poster.value);
  }
  form.elements.cover.value=initialCover||'';
  show();
  async function loadImage(source){
    active?.abort();
    const request=active=new AbortController();
    const current=()=>active===request&&form.isConnected;
    const fromWeb=typeof source==='string';
    submitButton.disabled=true;archive.disabled=true;
    status.textContent=fromWeb?'กำลังนำเข้าภาพจากเว็บ…':'กำลังเตรียมภาพปก…';
    const timer=fromWeb?setTimeout(()=>request.abort(),12000):undefined;
    try{
      if(!source)throw Error('ลากตัวรูปโดยตรง หรือคัดลอกรูปแล้ววางในฟอร์มนี้');
      const image=fromWeb?await fetchCoverSource(source,request.signal):source;
      clearTimeout(timer);
      if(!current())return;
      const {blob}=await window.JobImageCodec.compress(image,{edge:480,limit:32*1024});
      const encoded=await new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(reader.result);
        reader.onerror=()=>reject(Error('อ่านไฟล์ภาพไม่สำเร็จ'));
        reader.readAsDataURL(blob);
      });
      if(!current())return;
      const cover=coverImage(encoded);
      if(!cover)throw Error('ไม่รองรับรูปแบบภาพนี้');
      form.elements.cover.value=cover;
      show();
      status.textContent='พร้อมบันทึกสำเนาภาพและซิงก์กับ Google';
    }catch(error){
      if(current())status.textContent=fromWeb&&(error instanceof TypeError||request.signal.aborted)
        ?'เก็บสำเนาจากลิงก์นี้ไม่ได้ ลองคลิกขวา «คัดลอกรูปภาพ» แล้ววางในฟอร์ม'
        :error.message||'เปิดรูปไม่ได้';
    }finally{
      clearTimeout(timer);
      if(current()){active=undefined;submitButton.disabled=false;archive.disabled=false;}
    }
  }
  area.onclick=()=>file.click();
  file.onchange=()=>{if(file.files[0])loadImage(file.files[0]);file.value='';};
  area.ondragover=event=>{
    if(!coverDragTypes.some(type=>event.dataTransfer.types.includes(type)))return;
    event.preventDefault();event.dataTransfer.dropEffect='copy';area.classList.add('over');
  };
  area.ondragleave=()=>area.classList.remove('over');
  area.ondrop=event=>{
    event.preventDefault();area.classList.remove('over');
    const transfer=event.dataTransfer;
    const image=[...transfer.files].find(item=>item.type.startsWith('image/'));
    loadImage(image||droppedCover(transfer));
  };
  form.addEventListener('paste',event=>{
    const image=[...(event.clipboardData?.files||[])].find(item=>item.type.startsWith('image/'))||
      [...(event.clipboardData?.items||[])].find(item=>item.kind==='file'&&item.type.startsWith('image/'))?.getAsFile();
    if(image){event.preventDefault();loadImage(image);}
  });
  function clearCover(){
    active?.abort();active=undefined;
    form.elements.cover.value='';
    submitButton.disabled=false;archive.disabled=false;
    status.textContent='';
    show();
  }
  remove.onclick=clearCover;
  archive.onclick=()=>loadImage(link(form.elements.poster.value));
  form.elements.poster.oninput=clearCover;
}
function titleForm(t){
  const id=t?.id||'';
  openDialog(t?'แก้ไขชื่อเรื่อง':'เพิ่มเรื่องด้วยตัวเอง','<form id="titleForm" data-id="'+esc(id)+'"><div class="form-grid">'+
  field('name','ชื่อเรื่อง',t?.name,'required maxlength="160" autofocus','wide')+select('type','ประเภท',TYPES,t?.type||searchType)+
  select('status','สถานะ',{'':'เก็บไว้โดยยังไม่ติดตาม',...STATUS},t?.status??'planned')+
  field('platform','ช่องทาง',t?.platform,'maxlength="100"')+field('territory','ประเทศ / พื้นที่',t?.territory,'maxlength="20" placeholder="เช่น TH"')+
  field('source','ลิงก์แหล่งข้อมูล',t?.source,'type="url" maxlength="500"','wide')+
  '<div class="wide cover-picker"><label>ภาพหน้าปก</label><div class="cover-picker-row"><img class="cover-preview" alt="ตัวอย่างภาพปก" hidden><button type="button" class="cover-drop">ลากรูปจากเว็บหรือเครื่องมาวาง หรือคลิกเลือกไฟล์</button></div><p class="muted">คัดลอกรูปแล้วกด Ctrl+V หรือ ⌘V ในฟอร์มนี้ได้</p><input type="file" id="coverFile" accept="image/*" hidden><input type="hidden" name="cover"><button type="button" id="coverRemove" hidden>เอารูปที่นำเข้าออก</button><button type="button" id="coverArchive" hidden>เก็บสำเนาจากลิงก์ภาพปก</button><p id="coverStatus" role="status"></p></div>'+
  field('poster','ลิงก์ภาพปก',t?.poster,'type="url" maxlength="4000"','wide')+
  '<label class="wide">เรื่องย่อ<textarea name="description" rows="3" maxlength="8000">'+esc(t?.description)+'</textarea></label></div>'+formActions(t?'บันทึกการแก้ไข':'เพิ่มเรื่อง')+'</form>');
  setupCoverPicker(modal.querySelector('#titleForm'),t?.cover);
}
function titleDetail(t){
  if(!t)return;
  const stored=lookup(t.id),tracking=followed(stored);
  const storedEvents=stored?state.events.filter(e=>e.titleId===t.id):[];
  const now=today();
  const events=storedEvents.filter(e=>!e.repeatZone)
    .concat(eventsInRange(storedEvents.filter(e=>e.repeatZone),day(now,-21),day(now,56),state.settings.zone)).sort(compare);
  const nearest=events.filter(e=>eventDay(e,state.settings.zone)>=today());
  const recent=events.filter(e=>eventDay(e,state.settings.zone)&&eventDay(e,state.settings.zone)<today()).slice(-3).reverse();
  const tba=events.filter(e=>e.certainty==='tba');
  const actions=(!tracking?button('follow','＋ ติดตาม',t.id,'primary'):'')+(stored?button('edit-title','แก้ไขชื่อเรื่อง',t.id)+button('release-form','＋ เพิ่มกำหนดการ',t.id):'');
  const tracker=tracking?'<form id="progressForm" data-id="'+esc(t.id)+'"><div class="form-grid">'+select('status','สถานะ',STATUS,t.status)+select('reminder','แจ้งเตือน',{default:'ใช้ค่าจากหน้าตั้งค่า',...REMINDERS},t.reminder)+(t.type!=='film'?(t.type==='manga'?'':field('season','ซีซัน',t.season,'type="number" min="1" max="9999" required'))+field('progress',t.type==='manga'?'อ่านถึงบทที่':'ดูถึงตอนที่',t.progress,'type="number" min="0" max="999999" required'):'')+'<label class="wide">โน้ต<textarea name="note" rows="2" maxlength="1200">'+esc(t.note)+'</textarea></label></div>'+formActions('บันทึกความคืบหน้า')+'</form><div class="actions">'+button('unfollow','หยุดติดตาม',t.id,'ghost')+'</div>':'';
  openDialog(esc(t.name),'<div class="detail-body">'+poster(t,'detail-poster')+badge(t.type)+'<p class="muted">'+esc(summary(t)||'ข้อมูลชื่อเรื่อง')+'</p><p class="description">'+esc(t.description||'ยังไม่มีเรื่องย่อ')+'</p>'+(t.source?'<a class="link" href="'+esc(t.source)+'" target="_blank" rel="noopener">ดูข้อมูลต้นทาง ↗</a>':'')+'</div><div class="actions detail-actions">'+actions+'</div>'+tracker+(events.length?'<h3>กำหนดการของเรื่อง</h3>'+eventList([...nearest.slice(0,8),...recent,...tba.slice(0,5)]):'<p class="muted">ยังไม่มีกำหนดการที่บันทึกไว้</p>'));
}
function releaseForm(titleId,event){
  if(!state.titles.length){openDialog('เพิ่มกำหนดการ',empty('เพิ่มชื่อเรื่องก่อน','กำหนดการจะเชื่อมกับชื่อเรื่องที่คุณบันทึก',button('manual','＋ เพิ่มเรื่องเอง','','primary')));return;}
  const t=lookup(titleId);
  const zone=event?.repeatZone||state.settings.zone;
  openDialog(event?.repeatZone?'แก้ไขกำหนดการซ้ำ':event?'แก้ไขกำหนดการ':'เพิ่มกำหนดการ','<form id="releaseForm" data-id="'+esc(event?.id||'')+'"><div class="form-grid">'+
  select('titleId','ชื่อเรื่อง',Object.fromEntries(state.titles.map(t=>[t.id,t.name])),titleId,'wide')+
  field('name','รายละเอียดตอน / กำหนดการ',event?.name,'required maxlength="180" placeholder="เช่น ซีซัน 2 ตอนที่ 5"','wide')+
  select('kind','ประเภทกำหนดการ',RELEASE,event?.kind||(t?.type==='manga'?'chapter':t?.type==='film'?'cinema':'original'))+
  select('certainty','ความแน่นอน',CERT,event?.certainty||'estimated')+
  select('repeat','การเกิดซ้ำ',{once:'ครั้งเดียว',daily:'ทุกวัน',weekly:'ทุกสัปดาห์'},event?.repeatZone?event.repeatFrequency:'once','wide')+
  field('date','วันที่เริ่ม',event?eventDay(event,zone):date,'type="date" min="1900-01-01" max="2199-12-31"')+
  field('time','เวลา ('+esc(zone)+')',event?displayTime(event,zone):'','type="time"')+
  field('season','ซีซัน',event?.season||t?.season||1,'type="number" min="1" max="9999" required')+
  field('number','หมายเลขตอน / บท',event?.number||'','type="number" min="0" max="999999"')+
  field('platform','ช่องทาง',event?.platform||t?.platform,'maxlength="100"')+
  field('territory','ประเทศ / พื้นที่',event?.territory||t?.territory||state.settings.territory,'maxlength="20"')+
  field('source','ลิงก์ประกาศต้นทาง',event?.source,'type="url" maxlength="500"','wide')+'</div><p class="muted" id="repeatHint"></p>'+formActions()+'</form>');
  const form=modal.querySelector('#releaseForm');
  const toggle=()=>{
    const active=form.elements.certainty.value!=='tba';
    form.elements.date.disabled=!active;form.elements.date.required=active;
    form.elements.time.disabled=!active;form.elements.repeat.disabled=!active;
    const frequency=form.elements.repeat.value;
    const start=form.elements.date.value;
    modal.querySelector('#repeatHint').textContent=active&&frequency!=='once'
      ? (frequency==='daily'?'จะเกิดซ้ำทุกวันตามเวลาที่ตั้งไว้ ถ้าระบุหมายเลขตอนเริ่มต้น ระบบจะนับเพิ่มวันละหนึ่งตอน':(validDate(start)?'จะเกิดซ้ำทุก'+fmtDay(start,{weekday:'long'}):'ซ้ำตามวันในสัปดาห์ของวันที่เริ่ม')+' ถ้าระบุหมายเลขตอนเริ่มต้น ระบบจะนับเพิ่มสัปดาห์ละหนึ่งตอน')
      : 'เลือก “ยังไม่ประกาศ” เมื่อยังไม่มีวันเผยแพร่';
  };
  form.elements.certainty.onchange=toggle;
  form.elements.repeat.onchange=toggle;
  form.elements.date.onchange=toggle;
  toggle();
}
function eventDetail(e){
  if(!e)return;
  const t=lookup(e.titleId);
  if(!t)return;
  openDialog(esc(t.name),'<div class="detail-body">'+poster(t,'detail-poster')+badge(t.type)+' '+cert(e)+'<h3>'+esc(e.name)+'</h3><p>'+esc(timeText(e))+'</p><p class="muted">'+esc([occurrenceNumber(e,t),repeatLabel(e),RELEASE[e.kind],e.platform,e.territory,e.automatic?'TVmaze':e.source?'อ้างอิงลิงก์ต้นทาง':'บันทึกด้วยตัวเอง'].filter(Boolean).join(' · '))+'</p>'+(e.source?'<a class="link" href="'+esc(e.source)+'" target="_blank" rel="noopener">ดูข้อมูลต้นทาง ↗</a>':'')+'</div><div class="actions">'+
  (followed(t)&&!isWatched(t,e)&&(t.type==='film'?!e.repeatZone:e.number>0)?button('watched',t.type==='manga'?'✓ อ่านถึงบทนี้':'✓ ดูแล้ว',occurrenceRef(e),'primary'):'')+
  button('title','เปิดชื่อเรื่อง',t.id)+(!e.automatic?button('edit-event',e.repeatZone?'แก้ไขทั้งชุด':'แก้ไข',e.id)+button('delete-event',e.repeatZone?'ลบทั้งชุด':'ลบกำหนดการ',e.id,'danger'):'')+'</div>');
}
async function json(url,signal){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(url,{signal:signal?AbortSignal.any([signal,controller.signal]):controller.signal,credentials:'omit'});
    if(!response.ok)throw Error('โหลดข้อมูลไม่สำเร็จ');
    return await response.json();
  }finally{clearTimeout(timeout);}
}
function textOnly(html){return new DOMParser().parseFromString(html||'','text/html').body.textContent||'';}
async function search(q,type){
  searchController?.abort();
  const controller=new AbortController();
  searchController=controller;searchQuery=q;searchType=type;searchState='loading';results=[];discoveryFilters={};
  if(page!=='discover')location.hash='discover';else render();
  try{
    const term=encodeURIComponent(q);
    let items;
    if(type==='series'){
      const rows=await json('https://api.tvmaze.com/search/shows?q='+term,controller.signal);
      items=rows.slice(0,18).map(({show:s})=>cleanTitle({id:'tvmaze-'+s.id,name:s.name,type,provider:'tvmaze',poster:s.image?.medium,source:s.url,description:textOnly(s.summary),genres:s.genres?.join(', '),year:s.premiered?.slice(0,4),releaseStatus:s.status,platform:s.webChannel?.name||s.network?.name,territory:s.webChannel?.country?.code||s.network?.country?.code}));
    }else if(type==='anime'||type==='manga'){
      const params=new URLSearchParams({'filter[text]':q,'page[limit]':'15',include:'categories'});
      const rows=await json('https://kitsu.app/api/edge/'+type+'?'+params,controller.signal);
      const categories=new Map((rows.included||[]).filter(item=>item.type==='categories').map(item=>[item.id,item.attributes?.title]));
      items=rows.data.filter(row=>row.attributes&&!row.attributes.nsfw&&row.attributes.ageRating!=='R18').map(row=>{
        const s=row.attributes;
        const genres=(row.relationships?.categories?.data||[]).map(item=>categories.get(item.id)).filter(Boolean);
        return cleanTitle({id:'kitsu-'+type+'-'+row.id,name:s.titles?.en||s.canonicalTitle,type,provider:'kitsu',
          poster:s.posterImage?.small,source:'https://kitsu.app/'+type+'/'+encodeURIComponent(s.slug||row.id),
          description:s.synopsis,releaseStatus:s.status,genres:genres.join(', '),year:s.startDate?.slice(0,4)});
      });
    }else{
      items=state.titles.filter(t=>t.type===type&&t.name.toLocaleLowerCase().includes(q.toLocaleLowerCase()));
    }
    if(searchController!==controller)return;
    results=[...new Map(items.filter(t=>t.name).map(t=>[t.id,t])).values()];searchState='done';
  }catch{
    if(searchController!==controller)return;
    searchState='error';
  }
  if(page==='discover')render();
}
export function tvEvents(rows,t,start){
  return rows.filter(e=>Number.isSafeInteger(e.id)).map(e=>cleanEvent({
    id:'tvmaze-episode-'+e.id,titleId:t.id,name:[e.number?'ซีซัน '+(e.season||1)+' · ตอนที่ '+e.number:'ตอนพิเศษ',e.name].filter(Boolean).join(' · '),
    date:e.airdate,at:e.airstamp,season:e.season,number:e.number,kind:'original',
    certainty:e.airstamp&&Number.isFinite(Date.parse(e.airstamp))?'confirmed':validDate(e.airdate)?'estimated':'tba',
    platform:t.platform,territory:t.territory,source:e.url||t.source,automatic:true
  })).filter(e=>(e.date||e.at)&&(e.date||e.at.slice(0,10))>=start);
}
async function syncOne(id){
  const t=lookup(id), demoAtStart=demo;
  if(!t||t.provider!=='tvmaze'||!/^tvmaze-\d+$/.test(t.id))return false;
  const rows=await json('https://api.tvmaze.com/shows/'+t.id.slice(7)+'/episodes');
  if(!Array.isArray(rows))throw Error('รูปแบบกำหนดการไม่ถูกต้อง');
  const current=lookup(id);
  if(!current||demo!==demoAtStart||!followed(current))return false;
  const events=tvEvents(rows,current,day(today(),-31));
  state.events=state.events.filter(e=>!e.automatic||e.titleId!==id).concat(events);
  current.synced=new Date().toISOString();save();
  return true;
}
async function syncAll(){
  if(syncing)return;
  const titles=state.titles.filter(t=>followed(t)&&t.provider==='tvmaze');
  if(!titles.length){toast('ยังไม่มีซีรีส์ที่ติดตามจาก TVmaze');return;}
  const startDemo=demo;
  syncing=true;render();let ok=0,failed=0;
  for(const t of titles){
    if(demo!==startDemo)break;
    try{if(await syncOne(t.id))ok++;}
    catch{failed++;}
  }
  syncing=false;render();toast(failed?'อัปเดต '+ok+' เรื่อง · โหลดไม่ได้ '+failed+' เรื่อง':'อัปเดตกำหนดการ '+ok+' เรื่องแล้ว');
}
function followTitle(t){
  if(!t||followed(lookup(t.id)))return;
  let saved=lookup(t.id);
  if(!saved){saved=cleanTitle(t);state.titles.push(saved);}
  saved.status='planned';saved.updated=new Date().toISOString();save();render();
  const isOpen=modal.open;
  if(isOpen)titleDetail(saved);
  toast('เพิ่มในรายการของฉันแล้ว');
  if(saved.provider==='tvmaze')syncOne(saved.id).then(changed=>{if(changed){render();toast('อัปเดตกำหนดการจาก TVmaze แล้ว');}}).catch(()=>toast('ติดตามแล้ว แต่ยังโหลดกำหนดการจาก TVmaze ไม่ได้'));
}
function exportData(){
  const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='watchflow-'+today()+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function confirmDialog(title,body,action,id,label){
  openDialog(title,'<p>'+body+'</p><div class="actions">'+button('close','ยกเลิก')+button(action,label,id,'danger')+'</div>');
}
function moveDate(offset){
  if(calendarMode==='month'){
    const d=new Date(date);d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+offset);date=iso(d);
  }else date=day(date,offset*(calendarMode==='week'?7:30));
}
function handleAction(target){
  const {action,id}=target.dataset;
  const t=()=>titleFor(id);
  const e=()=>{
    const [key,date]=(id||'').split('~');
    const base=state.events.find(event=>event.id===key);
    return base&&date?recurringOccurrence(base,date):base;
  };
  switch(action){
    case 'manual': titleForm();break;
    case 'title': titleDetail(t());break;
    case 'edit-title': if(t())titleForm(t());break;
    case 'follow': followTitle(t());break;
    case 'unfollow': if(t()){t().status='';save();render();titleDetail(t());toast('หยุดติดตามแล้ว');}break;
    case 'event': eventDetail(e());break;
    case 'edit-event': if(e())releaseForm(e().titleId,e());break;
    case 'release-form': releaseForm(id);break;
    case 'delete-event': if(e())confirmDialog('ลบกำหนดการ',e().repeatZone?'กำหนดการทั้งหมดในชุดนี้จะถูกนำออกจากปฏิทิน':'กำหนดการนี้จะถูกนำออกจากปฏิทิน','confirm-delete',id,'ลบกำหนดการ');break;
    case 'confirm-delete': state.events=state.events.filter(e=>e.id!==id);save();modal.close();render();toast('ลบกำหนดการแล้ว');break;
    case 'watched': {
      const event=e(), title=event&&lookup(event.titleId);
      if(!event||!followed(title)||isWatched(title,event))break;
      if(title.type==='film')title.status='done';
      else {title.season=event.season;title.progress=event.number;title.status='active';}
      title.updated=new Date().toISOString();save();render();eventDetail(event);toast('บันทึกความคืบหน้าแล้ว');break;
    }
    case 'mode': if(['month','week','agenda'].includes(id))calendarMode=id;render();break;
    case 'day': if(validDate(id))date=id;render();break;
    case 'today': date=today();render();break;
    case 'prev': moveDate(-1);render();break;
    case 'next': moveDate(1);render();break;
    case 'alert': {
      const alert=dueAlerts(state,new Date()).find(n=>n.id===id);
      if(alert){state.read[id]=new Date().toISOString();save();render();eventDetail(alert.e);}
      break;
    }
    case 'read-all': dueAlerts(state,new Date()).forEach(n=>{state.read[n.id]=new Date().toISOString();});save();render();break;
    case 'demo': if(syncing)break;searchController?.abort();searchController=null;results=[];searchState='';demo=true;state=demoData();date=today();filters={type:'',certainty:'',platform:'',territory:'',all:false};if(page!=='dashboard')location.hash='dashboard';else render();break;
    case 'exit-demo': searchController?.abort();searchController=null;results=[];searchState='';demo=false;state=load();date=today();filters={type:'',certainty:'',platform:'',territory:'',all:false};render();queueCloud(0);break;
    case 'close': modal.close();break;
    case 'sync': syncAll();break;
    case 'export': exportData();break;
    case 'import': document.getElementById('importFile')?.click();break;
    case 'clear': confirmDialog('ล้างข้อมูล WatchFlow?','รายการ กำหนดการ และความคืบหน้าจะถูกล้าง และการล้างจะซิงก์ไปยังอุปกรณ์ที่เชื่อมไว้','confirm-clear','','ล้างข้อมูล');break;
    case 'confirm-clear': state=blank();date=today();save();modal.close();render();toast('ล้างข้อมูลแล้ว');break;
  }
}
async function loadImport(file){
  if(!file)return;
  if(file.size>12*1024*1024){toast('ไฟล์สำรองใหญ่เกิน 12 MB');return;}
  try{
    const data=restore(JSON.parse(await file.text()));
    openDialog('นำเข้าข้อมูล','<p>ไฟล์มี '+data.titles.length+' เรื่อง และ '+data.events.length+' กำหนดการ การนำเข้าจะแทนข้อมูล WatchFlow ที่แสดงอยู่ และการเปลี่ยนแปลงจะซิงก์ไปยังอุปกรณ์ที่เชื่อมไว้</p><div class="actions">'+button('close','ยกเลิก')+'<button type="button" class="primary" id="confirmImport">นำเข้าข้อมูล</button></div>');
    modal.querySelector('#confirmImport').onclick=()=>{state=data;date=today();save();modal.close();render();toast('นำเข้าข้อมูลแล้ว');};
  }catch(error){toast('นำเข้าไม่สำเร็จ · '+error.message);}
}
function submit(event){
  const form=event.target;
  if(!['globalSearch','discoverSearch','listSearch','settingsForm','titleForm','progressForm','releaseForm'].includes(form.id))return;
  event.preventDefault();
  const data=Object.fromEntries(new FormData(form));
  const err=form.querySelector('.error');
  if(err)err.textContent='';
  if(form.id==='globalSearch'||form.id==='discoverSearch'){
    const q=str(data.q,100);
    if(q.length<2){toast('พิมพ์ชื่อเรื่องอย่างน้อย 2 ตัวอักษร');return;}
    search(q,data.type||searchType);return;
  }
  if(form.id==='listSearch'){listFilter.q=str(data.q,150);render();return;}
  if(form.id==='settingsForm'){
    state.settings=restore({...blank(),settings:data}).settings;
    date=today();save();render();toast('บันทึกการตั้งค่าแล้ว');return;
  }
  const editing=lookup(form.dataset.id);
  if(form.id==='titleForm'){
    if(form.querySelector('.primary').disabled)return;
    const name=str(data.name,160);
    if(!name){err.textContent='กรุณากรอกชื่อเรื่อง';return;}
    if((data.poster&&!link(data.poster))||(data.source&&!link(data.source))){err.textContent='กรุณาใช้ลิงก์ http หรือ https';return;}
    if(state.titles.some(t=>t.id!==editing?.id&&t.type===data.type&&t.name.toLocaleLowerCase()===name.toLocaleLowerCase())){err.textContent='มีชื่อเรื่องนี้ในรายการแล้ว';return;}
    const t=cleanTitle({...editing,...data,name,id:editing?.id||uid(),updated:new Date().toISOString()});
    if(editing)Object.assign(editing,t);else state.titles.push(t);
    save();render();titleDetail(t);toast(editing?'แก้ไขชื่อเรื่องแล้ว':'เพิ่มชื่อเรื่องแล้ว');return;
  }
  if(form.id==='progressForm'){
    if(!editing){err.textContent='ไม่พบชื่อเรื่อง';return;}
    Object.assign(editing,cleanTitle({...editing,...data,updated:new Date().toISOString()}));
    save();render();titleDetail(editing);toast('บันทึกความคืบหน้าแล้ว');return;
  }
  const t=lookup(data.titleId),name=str(data.name,180);
  if(!t||!name){err.textContent='กรุณาเลือกชื่อเรื่องและระบุรายละเอียด';return;}
  if(data.source&&!link(data.source)){err.textContent='กรุณาใช้ลิงก์ http หรือ https';return;}
  if(data.certainty!=='tba'&&!validDate(data.date)){err.textContent='กรุณาระบุวันที่เผยแพร่';return;}
  const prior=state.events.find(e=>e.id===form.dataset.id);
  const zone=prior?.repeatZone||state.settings.zone;
  const at=data.time?localTimestamp(data.date,data.time,zone):'';
  if(data.time&&!at){err.textContent='เวลานี้ใช้ไม่ได้ในเขตเวลาที่เลือก';return;}
  const repeatZone=['daily','weekly'].includes(data.repeat)&&data.certainty!=='tba'?zone:'';
  const release=cleanEvent({...data,name,id:prior?.id||uid(),date:data.certainty==='tba'?'':data.date,at,repeatZone,repeatFrequency:data.repeat});
  if(state.events.some(e=>e.id!==release.id&&e.titleId===release.titleId&&e.name===release.name&&e.kind===release.kind&&e.date===release.date&&e.at===release.at)){err.textContent='มีกำหนดการเดียวกันแล้ว';return;}
  if(prior)state.events=state.events.map(e=>e.id===release.id?release:e);else state.events.push(release);
  if(page==='calendar'&&eventDay(release,state.settings.zone))date=eventDay(release,state.settings.zone);
  save();render();eventDetail(release);toast('บันทึกกำหนดการแล้ว');
}
function boot(){
  state=load();date=today();view=document.getElementById('view');modal=document.getElementById('dialog');
  document.querySelectorAll('[data-icon]').forEach(el=>el.insertAdjacentHTML('afterbegin',icon(el.dataset.icon)));
  document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();document.getElementById('main').focus();});
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-action]');
    if(!target)return;
    handleAction(target);
    if(!target.isConnected&&!modal.open&&target.dataset.action!=='alert'){
      [...document.querySelectorAll('[data-action]')].find(el=>el.dataset.action===target.dataset.action&&el.dataset.id===target.dataset.id)?.focus({preventScroll:true});
    }
  });
  document.addEventListener('submit',submit);
  document.addEventListener('change',event=>{
    const el=event.target,k=el.dataset.filter;
    if(k?.startsWith('discover-')){discoveryFilters[k.slice(9)]=el.value;render();}
    else if(k?.startsWith('list-')){listFilter[k.slice(5)]=el.value;render();}
    else if(k){filters[k]=el.type==='checkbox'?el.checked:el.value;render();}
    else if(el.id==='agendaDate'&&validDate(el.value)){date=el.value;render();}
    else if(el.id==='importFile'){loadImport(el.files[0]);el.value='';}
    else return;
    if(k)[...document.querySelectorAll('[data-filter]')].find(field=>field.dataset.filter===k)?.focus({preventScroll:true});
  });
  modal.addEventListener('close',()=>{
    if(cloudChanged&&!modal.open)render();
    if(dialogReturn?.isConnected)dialogReturn.focus();else document.getElementById('main').focus({preventScroll:true});
  });
  document.getElementById('cloudRefresh').addEventListener('click',()=>refreshCloud());
  window.addEventListener('online',()=>queueCloud(0));
  window.addEventListener('focus',()=>queueCloud(150));
  window.addEventListener('pageshow',()=>queueCloud(150));
  window.addEventListener('hashchange',()=>route(true));
  window.addEventListener('storage',event=>{
    if(!demo&&event.key===KEY){state=load();if(!modal.open)render();else{cloudChanged=true;updateBadge();}}
    if(event.key==='printOS:notebooks:device:v1')queueCloud(0);
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateBadge();});
  setInterval(()=>{if(!document.hidden){updateBadge();if(page==='notifications'&&!modal.open&&!view.contains(document.activeElement))render();}},60000);
  setInterval(()=>{if(!document.hidden)refreshCloud();},45000);
  route();
  queueCloud(0);
}
if(typeof document!=='undefined')boot();
