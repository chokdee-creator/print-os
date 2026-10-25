/* Receipt images live in IndexedDB; notebook metadata stays small in localStorage. */
var AccountSlips=(function(){
  const open=()=>new Promise((resolve,reject)=>{const request=indexedDB.open('printOS-account-slips',1);request.onupgradeneeded=()=>request.result.createObjectStore('images',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('เปิดพื้นที่เก็บสลิปไม่ได้ กรุณาอนุญาตการเก็บข้อมูลในเบราว์เซอร์'));});
  async function transact(mode,action){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('images',mode),request=action(tx.objectStore('images'));tx.oncomplete=()=>{db.close();resolve(request.result);};tx.onerror=tx.onabort=()=>{db.close();reject(new Error('บันทึกสลิปไม่ได้ พื้นที่อุปกรณ์อาจเต็ม'));};});}
  async function prepare(file){if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('เลือกสลิปเป็นรูป JPG, PNG หรือ WebP');const result=await JobImageCodec.compress(file);return {id:crypto.randomUUID(),name:file.name,type:result.blob.type,size:result.blob.size,blob:result.blob};}
  const read=id=>transact('readonly',store=>store.get(id));
  const put=slip=>transact('readwrite',store=>store.put(slip));
  async function dataUrl(id){let item=await read(id);if(!item&&typeof AccountsCloud!=='undefined'&&AccountsCloud.isReady())item=await AccountsCloud.slip({id});if(!item)throw new Error('ไม่พบไฟล์สลิปในอุปกรณ์นี้ กรุณาแนบสลิปใหม่ก่อนสำรอง');return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('อ่านสลิปไม่สำเร็จ'));reader.readAsDataURL(item.blob);});}
  const remove=id=>transact('readwrite',store=>store.delete(id));return {prepare,read,put,dataUrl,remove};
})();
