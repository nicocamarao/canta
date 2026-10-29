import assert from 'node:assert/strict';
import {config} from '../dist/config.js';
const root=config.supabaseUrl;
const signin=async()=>{const r=await fetch(root+'/auth/v1/signup',{method:'POST',headers:{apikey:config.supabaseKey,'Content-Type':'application/json'},body:'{}'});const d=await r.json();assert.ok(d.access_token,'anonymous sign in');return d.access_token;};
const a=await signin(),b=await signin();
async function call(token,path,body){const r=await fetch(root+'/rest/v1/'+path,{method:body?'POST':'GET',headers:{apikey:config.supabaseKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const text=await r.text();return {ok:r.ok,status:r.status,data:text?JSON.parse(text):null};}
const room='C', ca=crypto.randomUUID(),cb=crypto.randomUUID();
let r=await call(a,'rooms?id=eq.C');assert.equal(r.data[0].phase,'choosing','use empty test room only');
assert.equal((await call(a,'rpc/enqueue_song',{room,video:'E1NX4mWf0Os',song_title:'TEST karaoke uno',singer:'Prueba A',client:ca,seconds:2})).ok,true);
let first=(await call(a,'rooms?id=eq.C')).data[0];assert.equal(first.phase,'ready');assert.ok(Math.abs(Date.parse(first.ready_until)-Date.now()-15000)<3000);
assert.equal((await call(b,'rpc/begin_song',{room,client:cb})).ok,false,'another singer cannot start');
assert.equal((await call(b,'rpc/enqueue_song',{room,video:'E1NX4mWf0Os',song_title:'TEST karaoke dos',singer:'Prueba B',client:cb,seconds:2})).ok,true);
assert.equal((await call(a,'rpc/begin_song',{room,client:ca})).ok,true);
let playing=(await call(a,'rooms?id=eq.C')).data[0];assert.equal(playing.phase,'playing');assert.ok(Date.parse(playing.updated_at)>Date.now(),'shared start is in future');
await call(b,'rpc/finish_song',{room,client:cb});assert.equal((await call(a,'rooms?id=eq.C')).data[0].phase,'playing','other user cannot finish');
await call(a,'rpc/finish_song',{room,client:ca});let next=(await call(b,'rooms?id=eq.C')).data[0];assert.equal(next.singer_name,'Prueba B');assert.equal(next.phase,'ready');
console.log('PASS: queue, ownership, common start, next singer. Waiting for the 15-second deadline.');
await new Promise(r=>setTimeout(r,16000));await call(a,'rpc/advance_room',{room});assert.equal((await call(a,'rooms?id=eq.C')).data[0].phase,'choosing');assert.equal((await call(a,'song_queue?room_id=eq.C')).data.length,0);
console.log('PASS: automatic timeout and empty queue cleanup.');
