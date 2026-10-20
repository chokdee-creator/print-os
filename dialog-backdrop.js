/* Treat a click wholly on a dialog backdrop like Escape, including picker cleanup. */
(function(){
  let pressed=null;
  function outside(event){
    const dialog=event.target;
    if(dialog?.tagName!=='DIALOG'||!dialog.open)return null;
    const rect=dialog.getBoundingClientRect();
    return event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom?dialog:null;
  }
  document.addEventListener('pointerdown',event=>{pressed=event.button===0?outside(event):null;},true);
  document.addEventListener('pointercancel',()=>{pressed=null;},true);
  document.addEventListener('click',event=>{
    const dialog=outside(event),started=pressed;pressed=null;
    if(!dialog||dialog!==started)return;
    if(dialog.dispatchEvent(new Event('cancel',{cancelable:true})))dialog.close();
  },true);
})();
