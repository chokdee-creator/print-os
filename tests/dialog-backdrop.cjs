const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const listeners={};vm.runInNewContext(fs.readFileSync('dialog-backdrop.js','utf8'),{Event,document:{addEventListener:(name,fn)=>listeners[name]=fn}});
let closed=0,cancelled=0,pickerResolved=false;
const dialog={tagName:'DIALOG',open:true,getBoundingClientRect:()=>({left:100,right:500,top:100,bottom:500}),dispatchEvent:event=>{assert.equal(event.type,'cancel');assert.equal(event.cancelable,true);cancelled++;return true;},close(){closed++;this.open=false;}};
function event(target,x=10,y=10,button=0){return{target,clientX:x,clientY:y,button};}
listeners.pointerdown(event(dialog,200,200));listeners.click(event(dialog));assert.equal(closed,0,'drag from inside must not dismiss');
listeners.pointerdown(event(dialog,200,200));listeners.click(event(dialog,200,200));assert.equal(closed,0,'padding within dialog remains interactive');
listeners.pointerdown(event(dialog));listeners.pointercancel();listeners.click(event(dialog));assert.equal(closed,0);
listeners.pointerdown(event(dialog,10,10,2));listeners.click(event(dialog));assert.equal(closed,0);
listeners.pointerdown(event(dialog));listeners.click(event(dialog));assert.equal(closed,1);assert.equal(cancelled,1);
dialog.open=true;dialog.dispatchEvent=event=>{event.preventDefault();pickerResolved=true;dialog.close();return false;};
listeners.pointerdown(event(dialog));listeners.click(event(dialog));assert.equal(pickerResolved,true);assert.equal(closed,2,'picker cancellation handles cleanup without a second close');
for(const file of ['print-image-account.html','chokdee-print.html','payment-accounts.html'])assert.equal((fs.readFileSync(file,'utf8').match(/src="dialog-backdrop.js/g)||[]).length,1);
console.log('PASS: outside clicks dismiss dialogs on both stores and account page; inside clicks, drags, cancelled/right clicks stay open; picker cancel cleanup is respected.');
