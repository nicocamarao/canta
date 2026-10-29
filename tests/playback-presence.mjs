import assert from 'node:assert/strict';
import {config} from '../dist/config.js';
async function signin(){const r=await fetch(config.supabaseUrl+'/auth/v1/signup',{method:'POST',headers:{apikey:config.supabaseKey,'Content-Type':'application/json'},body:'{}'});const d=await r.json();assert.ok(d.access_token);return d.access_token;}
async function call(token,path,body){const r=await fetch(config.supabaseUrl+'/rest/v1/'+path,{method:body?'POST':'GET',headers:{apikey:config.supabaseKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const text=await r.text();return{ok:r.ok,data:text?JSON.parse(text):null};}
const a=await signin(),b=await signin(),room='B',ca=crypto.randomUUID(),cb=crypto.randomUUID();
const rpc=(token,fn,body={})=>call(token,'rpc/'+fn,body);
const state=async()=>(await call(a,'rooms?id=eq.'+room)).data[0];
const pulse=(token,client)=>rpc(token,'room_pulse',{room,client,singer:'Prueba temporal',mic_on:false,cam_on:false});
const enqueue=(token,client)=>rpc(token,'enqueue_song',{room,client,singer:'Prueba temporal',video:'7T5dAkSZJo0',song_title:'TEST karaoke',seconds:30});
assert.equal((await state()).phase,'choosing','test only in idle B');
assert.equal((await rpc(a,'live_members')).data.some(p=>p.roomId===room),false,'test only in empty B');
let timer;
try{
 const sweep=await rpc(a,'room_sweep');assert.equal(sweep.ok,true,JSON.stringify(sweep.data));
 assert.equal((await enqueue(a,ca)).ok,false,'expired client must not receive false success');
 await pulse(a,ca);await pulse(b,cb);
 timer=setInterval(()=>Promise.all([pulse(a,ca),pulse(b,cb)]),1500);
 assert.equal((await enqueue(a,ca)).ok,true);await enqueue(b,cb);
 assert.equal((await rpc(b,'begin_song',{room,client:cb})).ok,false);
 await rpc(a,'begin_song',{room,client:ca});let s=await state();assert.ok(Date.parse(s.updated_at)-Date.now()>3500);assert.equal(s.started_at,null);
 await rpc(b,'confirm_song_started',{room,client:cb,at_position:0});assert.equal((await state()).started_at,null);
 await new Promise(r=>setTimeout(r,5300));await rpc(a,'confirm_song_started',{room,client:ca,at_position:.1});assert.ok((await state()).started_at);
 await rpc(b,'finish_song',{room,client:cb});assert.equal((await state()).singer_client,ca);
 await rpc(a,'finish_song',{room,client:ca});assert.equal((await state()).singer_client,cb);assert.equal((await state()).phase,'ready');
 await enqueue(b,cb);await rpc(b,'leave_room',{room,client:cb});assert.equal((await state()).phase,'choosing');assert.equal((await call(a,'song_queue?room_id=eq.B')).data.length,0);
 clearInterval(timer);timer=null;
 await pulse(a,ca);await enqueue(a,ca);await rpc(a,'begin_song',{room,client:ca});await enqueue(a,ca);
 console.log('PASS: 5s countdown, start ownership, stop advances, leave removes queue. Testing lost heartbeat…');
 await new Promise(r=>setTimeout(r,8500));await rpc(b,'advance_room',{room});
 assert.equal((await state()).phase,'choosing');assert.equal((await call(a,'song_queue?room_id=eq.B')).data.length,0);assert.equal((await rpc(a,'live_members')).data.some(p=>p.id===ca),false);
 console.log('PASS: expired singer disappears, playback stops, pending songs removed after 8s');
}finally{clearInterval(timer);await rpc(a,'leave_room',{room,client:ca});await rpc(b,'leave_room',{room,client:cb});}
