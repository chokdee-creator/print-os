import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {restore} from '../watchflow.mjs';
import {mergeWatchflow,syncWatchflow} from '../watchflow-sync.mjs';

const empty=restore({version:1,titles:[],events:[]});
const title=(id,progress=0)=>({id,name:id,status:'active',progress});
const data=(...titles)=>restore({...empty,titles});
const clone=x=>structuredClone(x);

test('first connection keeps the Google list and migrates existing offline progress',()=>{
  const merged=mergeWatchflow(null,data(title('local',8)),data(title('remote',3)),empty);
  assert.deepEqual(merged.titles.map(t=>[t.id,t.progress]),[['remote',3],['local',8]]);
  assert.deepEqual(mergeWatchflow(null,empty,merged,empty),merged);
});

test('sync combines independent edits, keeps a bookmark together, and honors known deletions',()=>{
  const base=data(title('a',2),title('b',7),title('delete'));
  const mine=clone(base);mine.titles[0].season=2;mine.titles[0].progress=1;mine.titles.pop();
  const theirs=clone(base);theirs.titles[0].note='new note';theirs.titles[0].progress=6;theirs.titles[1].progress=8;
  const merged=mergeWatchflow(base,mine,theirs,empty);
  assert.deepEqual(merged.titles.map(t=>[t.id,t.season,t.progress,t.note]),[['a',2,1,'new note'],['b',1,8,'']]);
});

test('revision conflicts are retried and a late local edit remains queued',async()=>{
  const previous=data(title('existing',2));let live=data(title('existing',4));
  let local={state:data(title('existing',2),title('phone',1)),base:previous};
  let writes=0,applied;
  const changed=await syncWatchflow({empty,normalize:restore,snapshot:()=>clone(local),
    client:{
      watchflowGet:async()=>({watchflow:{revision:'old',data:previous}}),
      watchflowSave:async(revision,state)=>{
        writes++;
        if(revision==='old')return {conflict:true,watchflow:{revision:'fresh',data:live}};
        live=state;
        local.state=data(title('existing',2),title('phone',5));
        return {watchflow:{revision:'next',data:live}};
      }
    },apply:(state,base)=>{applied={state,base};}
  });
  assert.equal(writes,2);assert.equal(changed,true);
  assert.deepEqual(applied.state.titles.map(t=>t.progress),[4,5]);
  assert.deepEqual(applied.base.titles.map(t=>t.progress),[4,1]);
});

test('authenticated bridge reads the same private document and rejects stale writes',()=>{
  let stored;
  const env=vm.createContext({
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:body=>({body,setMimeType(){return this;}})},
    Utilities:{getUuid:()=> 'revision-1'},
    orReadDelivery_:key=>{assert.equal(key,'watchflow:owner:v1');return stored;},
    orWriteDelivery_:(key,value)=>{assert.equal(key,'watchflow:owner:v1');stored=value;}
  });
  for(const file of ['accounts-devices.gs','watchflow-service.gs'])vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),env);
  vm.runInContext("ledgerDeviceAuth_=token=>{if(!['paired-desktop','paired-phone'].includes(token))throw Error('DEVICE_REQUIRED');return {id:token};}",env);
  const call=(command,deviceToken,extra)=>JSON.parse(env.ledgerDeviceBridge_({action:'ledgerDevice',command,deviceToken,...extra}).body);
  assert.equal(call('watchflowGet','unknown').needsPair,true);
  assert.equal(call('watchflowSave','unknown',{revision:'',watchflow:data(title('a',5))}).needsPair,true);
  assert.equal(stored,undefined);
  const saved=call('watchflowSave','paired-desktop',{revision:'',watchflow:data(title('a',5))});
  assert.equal(saved.ok,true);
  assert.equal(call('watchflowGet','paired-phone').watchflow.data.titles[0].progress,5);
  assert.equal(call('watchflowSave','paired-phone',{revision:'',watchflow:empty}).conflict,true);
  assert.equal(call('watchflowSave','paired-phone',{revision:'revision-1',watchflow:{...empty,titles:[{...data(title('a')).titles[0],poster:'javascript:bad'}]}}).ok,false);
  assert.equal(call('watchflowGet','paired-phone').watchflow.data.titles[0].progress,5);
  const scheduled=restore({...data(title('a',5)),events:[{id:'weekly',titleId:'a',name:'Every Tuesday',date:'2026-11-10',certainty:'confirmed',repeatZone:'Asia/Bangkok'}]});
  assert.equal(call('watchflowSave','paired-desktop',{revision:'revision-1',watchflow:scheduled}).watchflow.data.events[0].repeatZone,'Asia/Bangkok');
  const oldTab=clone(scheduled);delete oldTab.events[0].repeatZone;
  assert.equal(call('watchflowSave','paired-phone',{revision:'revision-1',watchflow:oldTab}).watchflow.data.events[0].repeatZone,'Asia/Bangkok');
  scheduled.events[0].repeatZone='';
  assert.equal(call('watchflowSave','paired-phone',{revision:'revision-1',watchflow:scheduled}).watchflow.data.events[0].repeatZone,'');
});
