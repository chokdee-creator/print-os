/* Optional local bill layout editor. It never changes saved shop jobs. */
var BillLayout=(function(){
  const WIDTH=794;
  function constrain(rect){
    const width=Math.min(WIDTH,Math.max(100,Number(rect.width)||100));
    return {x:Math.min(WIDTH-width,Math.max(0,Number(rect.x)||0)),y:Math.max(0,Number(rect.y)||0),width,height:Math.max(28,Number(rect.height)||28)};
  }
  function readProfile(value){
    try{const data=JSON.parse(value);if(data.version!==1||!data.boxes||typeof data.boxes!=='object')return null;
      const boxes={};for(const [key,rect] of Object.entries(data.boxes)){
        if(!rect||!['x','y','width','height'].every(name=>Number.isFinite(rect[name])&&Math.abs(rect[name])<20000))return null;
        boxes[key]=constrain(rect);
      }return {version:1,boxes};
    }catch{return null;}
  }
  function height(bill){
    return Math.ceil(Math.max(120,...Array.from(bill.querySelectorAll('[data-layout-box]')).filter(node=>!node.hasAttribute('data-bill-empty')).map(node=>parseFloat(node.style.top)+Math.max(parseFloat(node.style.height)||0,node.scrollHeight)))+24);
  }
  function prepareExport(bill){
    if(!bill.classList.contains('bill-layout-canvas'))return;
    bill.style.transform='none';bill.style.left='0';bill.style.top='0';bill.style.margin='0';
    bill.style.width=WIDTH+'px';bill.style.height=height(bill)+'px';
    bill.classList.remove('bill-layout-editing');
  }
  function mount(frame,tools,status){
    let bar=tools.querySelector('[data-layout-tools]');
    if(!bar){bar=document.createElement('span');bar.dataset.layoutTools='';bar.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
      bar.innerHTML='<button type="button" data-layout-toggle>จัดบิลเอง</button><button type="button" data-layout-save>บันทึกแบบจัดวาง</button><button type="button" data-layout-auto>จัดอัตโนมัติ</button><button type="button" data-layout-reset>คืนค่าเดิม</button>';
      bar.querySelectorAll('button').forEach(button=>button.style.cssText='background:#f3d78c;color:#142342;border:1px solid #ddb350;border-radius:6px;padding:9px 12px;font-weight:bold;cursor:pointer');tools.insertBefore(bar,status);
    }
    const toggle=bar.querySelector('[data-layout-toggle]'),save=bar.querySelector('[data-layout-save]'),auto=bar.querySelector('[data-layout-auto]'),reset=bar.querySelector('[data-layout-reset]');
    let sessions=[],editing=false,key='';save.disabled=true;
    function changed(){frame.contentDocument.dispatchEvent(new frame.contentWindow.Event('bill-layout-change'));}
    function fit(session){
      const width=Math.max(240,frame.contentDocument.documentElement.clientWidth-16),scale=Math.min(1,width/WIDTH),h=height(session.bill);
      session.scale=scale;session.bill.style.height=h+'px';session.bill.style.transform='scale('+scale+')';
      session.bill.style.left=Math.max(0,(width-WIDTH*scale)/2)+'px';session.stage.style.height=Math.ceil(h*scale)+'px';
    }
    function applyBox(node,rect){
      const box=constrain(rect);node.style.left=box.x+'px';node.style.top=box.y+'px';node.style.width=box.width+'px';node.style.height=box.height+'px';
      // Text remains complete when a narrower box creates more lines.
      if(node.scrollHeight>box.height)node.style.height=node.scrollHeight+'px';
    }
    function addHandles(session,node,label){
      const doc=frame.contentDocument,move=doc.createElement('button'),resize=doc.createElement('button');
      move.type=resize.type='button';move.className='bill-layout-move';resize.className='bill-layout-resize';
      for(const handle of [move,resize]){handle.setAttribute('data-html2canvas-ignore','true');handle.classList.add('bill-layout-handle');}
      move.textContent='↕ '+label;move.setAttribute('aria-label','ย้าย '+label);resize.textContent='↘';resize.setAttribute('aria-label','ปรับขนาด '+label);
      node.append(move,resize);
      function start(event,isResize){
        if(!editing)return;event.preventDefault();event.stopPropagation();const handle=event.currentTarget;
        const origin={x:parseFloat(node.style.left),y:parseFloat(node.style.top),width:parseFloat(node.style.width),height:parseFloat(node.style.height)},sx=event.clientX,sy=event.clientY;
        handle.setPointerCapture(event.pointerId);node.classList.add('bill-layout-active');
        function update(e){const dx=(e.clientX-sx)/session.scale,dy=(e.clientY-sy)/session.scale;
          const next=isResize?{...origin,width:origin.width+dx,height:origin.height+dy}:{...origin,x:origin.x+dx,y:origin.y+dy};
          if(isResize&&node.classList.contains('header-art'))next.height=next.width*origin.height/origin.width;
          applyBox(node,next);fit(session);
        }
        function end(){handle.removeEventListener('pointermove',update);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);node.classList.remove('bill-layout-active');changed();}
        handle.addEventListener('pointermove',update);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
      }
      move.addEventListener('pointerdown',event=>start(event,false));resize.addEventListener('pointerdown',event=>start(event,true));
      // Arrow keys are useful for precise adjustments and touch alternatives.
      for(const [handle,isResize] of [[move,false],[resize,true]])handle.addEventListener('keydown',event=>{
        const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!delta)return;
        event.preventDefault();const step=event.shiftKey?10:2,rect={x:parseFloat(node.style.left),y:parseFloat(node.style.top),width:parseFloat(node.style.width),height:parseFloat(node.style.height)};
        if(isResize){rect.width+=delta[0]*step;rect.height+=delta[1]*step;}else{rect.x+=delta[0]*step;rect.y+=delta[1]*step;}
        applyBox(node,rect);fit(session);changed();
      });
    }
    function enable(){
      const doc=frame.contentDocument,profile=readProfile(localStorage.getItem(key));
      sessions=Array.from(doc.querySelectorAll('.document')).map(bill=>{
        const originalStyle=bill.getAttribute('style'),originalWidth=bill.style.width;
        bill.style.width=WIDTH+'px';bill.classList.add('bill-layout-preparing');
        const list=[['header','.header-art','หัวบิล'],['company','.company','ข้อมูลร้าน'],['title','.document-title','ข้อมูลเอกสาร'],['customer','.customer-grid','ข้อมูลลูกค้า'],['items','.items','รายการสินค้า'],['payment','.payment-details','ช่องทางชำระเงิน'],['totals','.totals','ยอดที่ต้องชำระ'],['terms','.terms','เงื่อนไข'],['note','.note','ข้อความท้ายบิล']];
        const bounds=bill.getBoundingClientRect();
        const boxes=list.map(([id,selector,label])=>{let node=bill.querySelector(selector);if(id==='customer')node=node?.closest('.panel');if(!node)return null;
          const rect=node.getBoundingClientRect();return {id,label,node,style:node.getAttribute('style'),rect:{x:rect.left-bounds.left,y:rect.top-bounds.top,width:rect.width||300,height:rect.height||40}};
        }).filter(Boolean);
        const stage=doc.createElement('div');stage.className='bill-layout-stage';bill.before(stage);stage.append(bill);
        const session={bill,stage,boxes,originalStyle,originalWidth,scale:1};
        bill.classList.remove('bill-layout-preparing');bill.classList.add('bill-layout-canvas');bill.style.margin='0';bill.style.padding='0';bill.style.minHeight='0';bill.style.position='absolute';bill.style.top='0';
        boxes.forEach(box=>{box.node.dataset.layoutBox=box.id;applyBox(box.node,profile?.boxes[box.id]||box.rect);addHandles(session,box.node,box.label);});
        fit(session);return session;
      });
      save.disabled=false;changed();
    }
    function automatic(){
      sessions.forEach(session=>{
        session.boxes.forEach(box=>{box.node.querySelectorAll('.bill-layout-handle').forEach(handle=>handle.remove());delete box.node.dataset.layoutBox;if(box.style===null)box.node.removeAttribute('style');else box.node.setAttribute('style',box.style);});
        session.bill.classList.remove('bill-layout-canvas','bill-layout-editing');if(session.originalStyle===null)session.bill.removeAttribute('style');else session.bill.setAttribute('style',session.originalStyle);
        session.stage.before(session.bill);session.stage.remove();
      });sessions=[];editing=false;toggle.textContent='จัดบิลเอง';toggle.setAttribute('aria-pressed','false');save.disabled=true;changed();
    }
    toggle.onclick=()=>{
      try{if(!sessions.length)enable();editing=!editing;sessions.forEach(session=>session.bill.classList.toggle('bill-layout-editing',editing));toggle.textContent=editing?'เสร็จสิ้นการจัด':'แก้ไขการจัดบิล';toggle.setAttribute('aria-pressed',String(editing));
        status.textContent=editing?'ลากป้ายชื่อเพื่อย้ายกล่อง ลากมุม ↘ เพื่อปรับขนาด · ใช้ปุ่มลูกศรเลื่อนทีละน้อยได้':'จัดบิลแล้ว คัดลอกหรือดาวน์โหลดรูปได้ตามตำแหน่งนี้';
      }catch(error){status.textContent='เปิดตัวจัดบิลไม่สำเร็จ: '+error.message;}
    };
    save.onclick=()=>{if(!sessions.length)return;try{const boxes={};sessions[0].boxes.forEach(box=>boxes[box.id]=constrain({x:parseFloat(box.node.style.left),y:parseFloat(box.node.style.top),width:parseFloat(box.node.style.width),height:parseFloat(box.node.style.height)}));localStorage.setItem(key,JSON.stringify({version:1,boxes}));status.textContent='บันทึกแบบจัดวางของร้านนี้บนเครื่องแล้ว เปิดจัดบิลเองครั้งต่อไปจะใช้แบบนี้';}catch(error){status.textContent='บันทึกแบบไม่ได้: '+error.message;}};
    auto.onclick=()=>{automatic();status.textContent='กลับเป็นการจัดอัตโนมัติตามหน้าจอแล้ว';};
    reset.onclick=()=>{automatic();localStorage.removeItem(key);status.textContent='คืนแบบจัดวางเดิมของร้านนี้แล้ว';};
    frame.addEventListener('load',()=>{
      sessions=[];editing=false;save.disabled=true;toggle.textContent='จัดบิลเอง';toggle.setAttribute('aria-pressed','false');key='printBillLayout:v1:'+(frame.contentDocument.title.includes('โชคดี')?'chokdee':'printImage');
      frame.contentWindow.addEventListener('resize',()=>sessions.forEach(fit));
      frame.contentDocument.addEventListener('input',()=>sessions.forEach(session=>{session.boxes.forEach(box=>{if(box.node.scrollHeight>parseFloat(box.node.style.height))box.node.style.height=box.node.scrollHeight+'px';});fit(session);}));
    },{once:true});
  }
  return {mount,prepareExport,constrain,readProfile};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=BillLayout;
