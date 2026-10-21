/* Local document typography; inline sizes survive image and PDF export. */
var BillTypography=(function(){
  const excluded='button,select,option,script,style,.screen-only,[data-html2canvas-ignore],.bill-layout-handle';
  function size(value,delta){return Math.max(6,Math.min(64,Math.round((value+delta)*10)/10));}
  function mount(frame,tools,status){
    let bar=tools.querySelector('[data-font-tools]');
    if(!bar){
      bar=document.createElement('span');bar.dataset.fontTools='';
      bar.innerHTML='<span class="bill-font-label">ขนาดข้อความ</span><select aria-label="ขอบเขตปรับขนาดข้อความ"><option value="all">ทั้งเอกสาร</option><option value="selected">เฉพาะที่เลือก</option></select><button type="button" data-font-down aria-label="ลดขนาดข้อความ 1 พิกเซล" title="ลด 1 px">▾</button><button type="button" data-font-up aria-label="เพิ่มขนาดข้อความ 1 พิกเซล" title="เพิ่ม 1 px">▴</button><output aria-live="polite">เดิม</output><button type="button" data-font-reset title="คืนขนาดข้อความเดิม">คืนขนาด</button>';
      tools.insertBefore(bar,status);
    }
    const scope=bar.querySelector('select'),readout=bar.querySelector('output');
    let doc=null,target=null,range=null,chosen=[],original=new Map(),offset=0;
    scope.value='all';readout.textContent='เดิม';
    const valid=node=>node&&doc.contains(node)&&node.closest('.sheet.document')&&!node.closest(excluded);
    function remember(event){
      const node=event.target.nodeType===1?event.target:event.target.parentElement;
      if(!valid(node))return;
      target=node;chosen=[];
      const selection=doc.getSelection();
      range=selection&&selection.rangeCount&&!selection.isCollapsed?selection.getRangeAt(0).cloneRange():null;
      if(range&&!node.matches('input,textarea'))scope.value='selected';
    }
    function wrap(text,start=0,end=text.length){
      if(start>0)text=text.splitText(start);
      if(end-start<text.length)text.splitText(end-start);
      const span=doc.createElement('span');span.dataset.billFontRun='';text.before(span);span.append(text);return span;
    }
    function textNodes(root){
      const walker=doc.createTreeWalker(root,4),nodes=[];let node;
      while((node=walker.nextNode()))if(node.textContent.trim()&&!node.parentElement.closest(excluded+',input,textarea'))nodes.push(node);
      return nodes;
    }
    function allTargets(){
      const result=[];
      doc.querySelectorAll('.sheet.document').forEach(bill=>{
        textNodes(bill).forEach(text=>result.push(text.parentElement.hasAttribute('data-bill-font-run')?text.parentElement:wrap(text)));
        bill.querySelectorAll('input,textarea').forEach(field=>{if(!field.closest(excluded))result.push(field);});
      });return [...new Set(result)];
    }
    function selectedTargets(){
      if(chosen.length&&chosen.every(valid))return chosen;
      if(!valid(target))return [];
      if(target.matches('input,textarea'))return [target];
      if(range&&!range.collapsed){
        // Snapshot offsets before splitting: a selection may cross several cells.
        const parts=[];
        doc.querySelectorAll('.sheet.document').forEach(bill=>textNodes(bill).forEach(text=>{
          if(!range.intersectsNode(text))return;
          const start=range.startContainer===text?range.startOffset:0,end=range.endContainer===text?range.endOffset:text.length;
          if(end>start)parts.push({text,start,end});
        }));
        chosen=parts.reverse().map(part=>wrap(part.text,part.start,part.end));
        doc.getSelection().removeAllRanges();range=null;return chosen;
      }
      // A click on a heading/cell selects its own text, leaving nested metadata alone.
      chosen=Array.from(target.childNodes).filter(node=>node.nodeType===3&&node.textContent.trim()).map(text=>wrap(text));
      return chosen;
    }
    function changed(){
      doc.querySelectorAll('textarea').forEach(field=>{field.style.height='0';field.style.height=field.scrollHeight+'px';});
      doc.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));
      doc.dispatchEvent(new frame.contentWindow.Event('bill-layout-change'));
    }
    function adjust(delta){
      if(!doc)return;
      const targets=scope.value==='all'?allTargets():selectedTargets();
      if(!targets.length){status.textContent='คลิกช่องข้อความ หรือใช้เมาส์ลากเลือกข้อความในเอกสารก่อน แล้วกดลูกศร';return;}
      // Read every current size before changing ancestors or descendants.
      const sizes=targets.map(node=>({node,value:size(parseFloat(frame.contentWindow.getComputedStyle(node).fontSize),delta)}));
      sizes.forEach(({node,value})=>{
        if(!original.has(node))original.set(node,{value:node.style.getPropertyValue('font-size'),priority:node.style.getPropertyPriority('font-size')});
        node.style.setProperty('font-size',value+'px','important');
      });
      if(scope.value==='all'){offset+=delta;readout.textContent=(offset>0?'+':'')+offset+' px';}
      else{const values=[...new Set(sizes.map(item=>item.value))];readout.textContent=values.length===1?values[0]+' px':'หลายขนาด';}
      changed();
      status.textContent=scope.value==='all'?'ปรับข้อความทั้งเอกสารแล้ว · ใช้ขนาดนี้เมื่อคัดลอกและพิมพ์':'ปรับเฉพาะข้อความที่เลือกแล้ว · ช่องกรอกปรับทั้งช่อง';
    }
    bar.querySelectorAll('button').forEach(button=>button.onpointerdown=event=>event.preventDefault());
    bar.querySelector('[data-font-up]').onclick=()=>adjust(1);
    bar.querySelector('[data-font-down]').onclick=()=>adjust(-1);
    bar.querySelector('[data-font-reset]').onclick=()=>{
      if(!doc)return;
      original.forEach((old,node)=>{if(old.value)node.style.setProperty('font-size',old.value,old.priority);else node.style.removeProperty('font-size');});original.clear();
      doc.querySelectorAll('[data-bill-font-run]').forEach(span=>span.replaceWith(...span.childNodes));
      chosen=[];target=null;range=null;offset=0;readout.textContent='เดิม';changed();status.textContent='คืนขนาดข้อความเดิมแล้ว';
    };
    frame.addEventListener('load',()=>{
      doc=frame.contentDocument;
      ['mouseup','keyup','focusin'].forEach(name=>doc.addEventListener(name,remember));
    },{once:true});
  }
  return {mount,size};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=BillTypography;
