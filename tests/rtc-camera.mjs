import assert from 'node:assert/strict';
import {VoiceRoom} from '../dist/rtc.js';

const badTrack={readyState:'live',muted:true,stop(){}},track={readyState:'live',muted:false,stop(){}};
const badStream={getVideoTracks:()=>[badTrack],getTracks:()=>[badTrack]},stream={getVideoTracks:()=>[track],getTracks:()=>[track]};
let calls=0;
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{enumerateDevices:async()=>{assert.equal(calls,1);return [];},getUserMedia:async constraints=>{
 calls++;
 if(calls===1)assert.deepEqual(constraints,{video:{width:640,height:360},audio:false});
 else assert.deepEqual(constraints,{video:true,audio:false});
 return calls===1?badStream:stream;
}}}});

const room=new VoiceRoom({id:'mobile',send(){},iceServers:[],onStream(){},onStatus(){}});
assert.equal(await room.toggle('video'),true);
assert.equal(room.local.video,track);
assert.equal(room.localStreams.video,stream);
assert.equal(calls,2);
console.log('PASS: camera keeps the old flow and replaces a live track that delivers no image');
