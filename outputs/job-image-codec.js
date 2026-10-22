/* Browser-only raster compression. The original file is never uploaded. */
var JobImageCodec=(function(){
  const LIMIT=700*1024,EDGE=2560;
  async function compress(file){
    if(!file||!file.type.startsWith('image/')||file.type==='image/svg+xml')throw new Error('กรุณาเลือกรูป JPEG, PNG, WebP หรือรูปที่เบราว์เซอร์เปิดได้');
    let bitmap;
    try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}
    catch(error){throw new Error('เปิดรูปนี้ไม่ได้ กรุณาแปลงเป็น JPEG หรือ PNG ก่อน (บางเครื่องไม่รองรับ HEIC)');}
    try{
      const ratio=Math.min(1,EDGE/Math.max(bitmap.width,bitmap.height));
      let width=Math.max(1,Math.round(bitmap.width*ratio)),height=Math.max(1,Math.round(bitmap.height*ratio));
      const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(width,height):Object.assign(document.createElement('canvas'),{width,height});
      for(let round=0;round<12;round++){
        canvas.width=width;canvas.height=height;
        const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,width,height);
        for(const quality of [.88,.76,.64,.52,.40]){
          const blob=canvas.convertToBlob?await canvas.convertToBlob({type:'image/webp',quality}):await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
          if(blob&&blob.size<=LIMIT)return {blob,width,height,originalBytes:file.size};
        }
        width=Math.max(1,Math.floor(width*.75));height=Math.max(1,Math.floor(height*.75));
      }
      throw new Error('บีบอัดรูปไม่สำเร็จ กรุณาเลือกรูปใหม่');
    }finally{bitmap.close();}
  }
  return {compress,LIMIT};
})();
if(typeof WorkerGlobalScope!=='undefined'&&self instanceof WorkerGlobalScope)self.onmessage=async event=>{
  try{self.postMessage({ok:true,result:await JobImageCodec.compress(event.data)});}catch(error){self.postMessage({ok:false,error:error.message});}
};
if(typeof module!=='undefined'&&module.exports)module.exports=JobImageCodec;
