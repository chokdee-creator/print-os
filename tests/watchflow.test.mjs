import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dueAlerts,eventDay,localTimestamp,restore,tvEvents} from '../watchflow.mjs';

test('Bangkok timed releases cross midnight without shifting all-day entries',()=>{
  const at=localTimestamp('2026-11-11','02:30','Asia/Bangkok');
  assert.equal(at,'2026-11-10T19:30:00.000Z');
  assert.equal(eventDay({at},'Asia/Bangkok'),'2026-11-11');
  assert.equal(eventDay({at},'UTC'),'2026-11-10');
  assert.equal(eventDay({date:'2026-11-11'},'UTC'),'2026-11-11');
  assert.equal(localTimestamp('2026-03-08','02:30','America/New_York'),'');
});

test('restore and reminders honor opt-in, uncertain dates and rescheduled timestamps',()=>{
  const titles=[{id:'series-a',name:'Example',type:'series',status:'active',season:2,progress:4}];
  const release={id:'event-a',titleId:'series-a',name:'Episode 5',at:'2026-11-10T19:30:00.000Z',certainty:'confirmed'};
  const tba={...release,id:'event-b',certainty:'tba'};
  const data=restore({version:1,titles,events:[release,tba,release],settings:{zone:'Asia/Bangkok'}});
  assert.equal(data.titles[0].progress,4);
  assert.equal(data.events.length,2);
  assert.equal(data.events[1].at,'');
  const before=new Date('2026-11-10T10:00:00Z');
  assert.deepEqual(dueAlerts(data,before),[]);
  data.settings.reminder='both';
  assert.equal(dueAlerts(data,before)[0].id,'event-a|2026-11-10T19:30:00.000Z|day');
  assert.equal(dueAlerts(data,new Date('2026-11-10T19:29:00Z')).length,0);
  const after=new Date('2026-11-11T01:00:00Z');
  assert.equal(dueAlerts(data,after)[0].id,'event-a|2026-11-10T19:30:00.000Z|release');
  data.events[0].at='2026-11-10T20:00:00.000Z';
  assert.equal(dueAlerts(data,after)[0].id,'event-a|2026-11-10T20:00:00.000Z|release');
});

test('TVmaze never fabricates an event without a date or treats a date-only episode as timed',()=>{
  const rows=[
    {id:101,name:'Undated'},
    {id:102,airdate:'2026-11-18',season:1,number:5},
    {id:103,airdate:'2026-11-18',airstamp:'2026-11-18T22:00:00+00:00',season:1,number:6}
  ];
  const events=tvEvents(rows,{id:'tvmaze-5',platform:'Example channel'},'2026-11-10');
  assert.deepEqual(events.map(e=>e.certainty),['estimated','confirmed']);
  assert.equal(events[0].at,'');
  assert.equal(events[1].kind,'original');
  assert.equal(eventDay(events[1],'Asia/Bangkok'),'2026-11-19');
});
