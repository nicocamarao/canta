import assert from 'node:assert/strict';
import {VoiceRoom} from '../dist/rtc.js';

const track={stop(){}};
let calls=0;
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:async constraints=>{
 calls++;
 assert.equal(constraints.video,true);
 return {getTracks:()=>[track]};
}}}});

const room=new VoiceRoom({id:'mobile',send(){},iceServers:[],onStream(){},onStatus(){}});
room.peers.set('stale-peer',{video:{sender:{replaceTrack:async()=>{throw new Error('stale sender');}}}});
assert.equal(await room.toggle('video'),true);
assert.equal(room.local.video,track);
assert.ok(room.localStreams.video,'the complete MediaStream must remain referenced on mobile');
assert.equal(calls,1);
console.log('PASS: mobile camera uses one unrestricted request, keeps its stream, and ignores stale peer senders');
