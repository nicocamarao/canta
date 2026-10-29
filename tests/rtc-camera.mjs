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
assert.equal(await room.toggle('video'),true);
assert.equal(room.local.video,track);
assert.equal(calls,1);
console.log('PASS: restored camera uses the exact previously working request');
