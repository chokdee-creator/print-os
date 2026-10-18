/* Cloudflare Worker: verify LINE raw-body signature, relay only owner's report commands.
 * Keep all credentials in Worker secrets, never in this file or in the website.
 */
const encoder = new TextEncoder();
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign','verify']);
}
function base64(bytes) {return btoa(String.fromCharCode(...new Uint8Array(bytes)));}
async function verify(raw, signature, secret) {
  if(typeof signature!=='string' || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  return crypto.subtle.verify('HMAC',await hmacKey(secret),Uint8Array.from(atob(signature),c=>c.charCodeAt(0)),encoder.encode(raw));
}
async function constantEqual(a,b) {
  const key=await hmacKey('print-image-admin-comparison');
  const sig=await crypto.subtle.sign('HMAC',key,encoder.encode(a));
  return crypto.subtle.verify('HMAC',key,sig,encoder.encode(b));
}
async function relay(env, data) {
  const body=JSON.stringify({...data,at:Date.now(),actor:env.OWNER_LINE_USER_ID});
  const signature=base64(await crypto.subtle.sign('HMAC',await hmacKey(env.BRIDGE_SECRET),encoder.encode(body)));
  const response=await fetch(env.APPS_SCRIPT_URL,{method:'POST',redirect:'follow',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'outstandingBridge',body,signature})});
  if(!response.ok) throw new Error('Report backend unavailable');
  const result=await response.json();
  if(!result || typeof result.ok!=='boolean') throw new Error('Report backend version is not installed');
  return result;
}
export default {
  async fetch(request, env) {
    const url=new URL(request.url), origin=request.headers.get('Origin');
    const cors=origin===env.ALLOWED_ORIGIN?{'Access-Control-Allow-Origin':origin,'Vary':'Origin',
      'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'POST, OPTIONS'}:{};
    const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'}});
    if(!env.LINE_CHANNEL_SECRET || !env.BRIDGE_SECRET || !env.ADMIN_KEY || !env.OWNER_LINE_USER_ID || !env.APPS_SCRIPT_URL || !env.ALLOWED_ORIGIN) return json({ok:false,error:'Service not configured'},503);
    if(request.method==='GET' && url.pathname==='/health') return json({ok:true});
    if(url.pathname==='/admin' && request.method==='OPTIONS') return origin===env.ALLOWED_ORIGIN?new Response(null,{status:204,headers:cors}):json({ok:false},403);
    if(request.method!=='POST') return json({ok:false},405);
    if(Number(request.headers.get('Content-Length')||0)>40000) return json({ok:false},413);
    try {
      if(url.pathname==='/admin') {
        if(origin!==env.ALLOWED_ORIGIN) return json({ok:false,error:'Origin not allowed'},403);
        const authorization=request.headers.get('Authorization') || '';
        if(!authorization.startsWith('Bearer ') || !(await constantEqual(env.ADMIN_KEY,authorization.slice(7)))) return json({ok:false,error:'กุญแจจัดการไม่ถูกต้อง'},401);
        const raw=await request.text();if(raw.length>20000)return json({ok:false},413);
        const data=JSON.parse(raw);
        if(!['list','save','remove','previewSend'].includes(data.action)) return json({ok:false,error:'Unknown action'},400);
        const result=await relay(env,{action:data.action,id:crypto.randomUUID(),config:data.config,...(data.action==='remove'?{idToRemove:data.id}: {})});
        return json(result,result.ok?200:400);
      }
      if(url.pathname!=='/line/webhook') return json({ok:false},404);
      const raw=await request.text();if(raw.length>40000) return json({ok:false},413);
      if(!(await verify(raw,request.headers.get('x-line-signature'),env.LINE_CHANNEL_SECRET))) return json({ok:false},401);
      const payload=JSON.parse(raw);
      if(!Array.isArray(payload.events)) return json({ok:false},400);
      for(const event of payload.events) {
        if(event.type!=='message' || event.message?.type!=='text' || event.source?.type!=='user' || event.source.userId!==env.OWNER_LINE_USER_ID) continue;
        const text=event.message.text.trim();
        if(!/^(สรุปยอดค้าง(?:\s|$)|รายการยอดค้าง$|หยุดยอดค้าง\s)/.test(text)) continue;
        if(!Number.isFinite(event.timestamp) || event.timestamp>Date.now()+60000 || Date.now()-event.timestamp>86400000) continue;
        if(!/^[A-Za-z0-9_-]{1,100}$/.test(event.webhookEventId || '')) return json({ok:false},400);
        const result=await relay(env,{action:'line',id:event.webhookEventId,text});
        if(!result.ok) return json({ok:false,error:'Report command failed'},503);
      }
      return json({ok:true});
    } catch(e) {return json({ok:false,error:'บริการรายงานไม่สำเร็จ กรุณาตรวจบันทึกการทำงาน'},503);}
  }
};
export {verify};
