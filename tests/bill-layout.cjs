const assert=require('node:assert/strict'),L=require('../bill-layout.js');
assert.deepEqual(L.constrain({x:-25,y:-10,width:200,height:5}),{x:0,y:0,width:200,height:28});
assert.deepEqual(L.constrain({x:750,y:600,width:300,height:90}),{x:494,y:600,width:300,height:90});
assert.equal(L.readProfile('{bad'),null);
assert.equal(L.readProfile(JSON.stringify({version:2,boxes:{}})),null);
assert.equal(L.readProfile(JSON.stringify({version:1,boxes:{items:{x:'oops',y:0,width:200,height:100}}})),null);
const original={version:1,boxes:{items:{x:30,y:200,width:700,height:240}}};
assert.deepEqual(L.readProfile(JSON.stringify(original)),original);
let removed=false;
const bill={classList:{contains:()=>true,remove:()=>{removed=true;}},style:{},querySelectorAll:()=>[
  {style:{top:'200px',height:'100px'},scrollHeight:140,hasAttribute:()=>false},
  {style:{top:'2000px',height:'100px'},scrollHeight:100,hasAttribute:()=>true}
]};
L.prepareExport(bill);assert.equal(bill.style.height,'364px');assert.equal(bill.style.width,'794px');assert.equal(bill.style.transform,'none');assert.equal(removed,true);
console.log('PASS: dragging remains on canvas, profiles validate and preserve positions, and export removes preview scaling while keeping complete visible content.');
