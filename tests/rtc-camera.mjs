import assert from 'node:assert/strict';
import {VoiceRoom} from '../dist/rtc.js';

const track={stop(){}};
let calls=0;
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:async constraints=>{
 calls++;
 if(calls===1){const error=new Error('unsupported camera constraints');error.name='OverconstrainedError';throw error;}
 assert.equal(constraints.video,true);
 return {getTracks:()=>[track]};
}}}});

const room=new VoiceRoom({id:'mobile',send(){},iceServers:[],onStream(){},onStatus(){}});
assert.equal(await room.toggle('video'),true);
assert.equal(room.local.video,track);
assert.equal(calls,2);
console.log('PASS: mobile camera retries with unrestricted video');
