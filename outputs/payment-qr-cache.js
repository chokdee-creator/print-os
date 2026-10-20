/* QR images use IndexedDB so a 5 MB image does not fill localStorage. */
var PaymentQrCache=(function(){
  function database(){return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){resolve(null);return;}
    const request=indexedDB.open('print-payment-qr-cache',1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('accounts'))request.result.createObjectStore('accounts');};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('QR cache busy'));
  });}
  async function read(key){const db=await database();if(!db)return null;return new Promise((resolve,reject)=>{const tx=db.transaction('accounts','readonly'),request=tx.objectStore('accounts').get(key);let result=null;request.onsuccess=()=>{result=request.result||null;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||request.error);};});}
  async function write(key,value){const db=await database();if(!db)return false;return new Promise((resolve,reject)=>{const tx=db.transaction('accounts','readwrite');tx.objectStore('accounts').put(value,key);tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error);};});}
  return {read,write};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=PaymentQrCache;
