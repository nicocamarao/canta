import assert from 'node:assert/strict';
import {VoiceRoom} from '../dist/rtc.js';

const track={stop(){}};
const stream={getTracks:()=>[track]};
let calls=0;
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:async constraints=>{
 calls++;
 assert.deepEqual(constraints,{video:{width:640,height:360},audio:false});
 return stream;
}}}});

const room=new VoiceRoom({id:'mobile',send(){},iceServers:[],onStream(){},onStatus(){}});
assert.equal(await room.toggle('video'),true);
assert.equal(room.local.video,track);
assert.equal(room.localStreams.video,stream);
assert.equal(calls,1);
console.log('PASS: restored camera keeps the original mobile MediaStream for preview');
