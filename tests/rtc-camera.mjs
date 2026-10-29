import assert from 'node:assert/strict';
import {VoiceRoom} from '../dist/rtc.js';

const endedTrack={readyState:'ended',stop(){}},track={readyState:'live',stop(){}};
let calls=0;
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{enumerateDevices:async()=>[],getUserMedia:async constraints=>{
 calls++;
 if(calls===1)assert.deepEqual(constraints,{video:{width:640,height:360},audio:false});
 else assert.deepEqual(constraints,{video:true,audio:false});
 const selected=calls===1?endedTrack:track;
 return {getVideoTracks:()=>[selected],getTracks:()=>[selected]};
}}}});

const room=new VoiceRoom({id:'mobile',send(){},iceServers:[],onStream(){},onStatus(){}});
room.peers.set('stale-peer',{video:{sender:{replaceTrack:async()=>{throw new Error('stale sender');}}}});
assert.equal(await room.toggle('video'),true);
assert.equal(room.local.video,track);
assert.ok(room.localStreams.video,'the complete MediaStream must remain referenced on mobile');
assert.equal(calls,2);
console.log('PASS: mobile camera rejects ended tracks, falls back, and ignores stale peer senders');
