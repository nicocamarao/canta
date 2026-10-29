import assert from 'node:assert/strict';
import {VoiceRoom} from '../dist/rtc.js';

const track={stop(){}};
let calls=0;
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:async constraints=>{
 calls++;
 assert.deepEqual(constraints,{video:{width:640,height:360},audio:false});
 return {getTracks:()=>[track]};
}}}});

const room=new VoiceRoom({id:'mobile',send(){},iceServers:[],onStream(){},onStatus(){}});
room.peers.set('stale-peer',{video:{sender:{replaceTrack:async()=>{throw new Error('stale sender');}}}});
assert.equal(await room.toggle('video'),true);
assert.equal(room.local.video,track);
assert.ok(room.localStreams.video,'the complete MediaStream must remain referenced on mobile');
assert.equal(calls,1);
console.log('PASS: mobile camera uses the original 640x360 request and ignores stale peer senders');
