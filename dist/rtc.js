async function usableVideoTrack(track){
 if(!track||track.readyState==='ended')return false;
 if(!track.muted)return true;
 if(typeof track.addEventListener!=='function')return false;
 await new Promise(resolve=>{const done=()=>resolve();track.addEventListener('unmute',done,{once:true});track.addEventListener('ended',done,{once:true});setTimeout(done,1800);});
 return track.readyState==='live'&&!track.muted;
}
async function openWorkingCamera(){
 const candidates=[{width:640,height:360},true],failures=[];
 for(let index=0;index<candidates.length;index++){
  const video=candidates[index];
  try{
   const stream=await navigator.mediaDevices.getUserMedia({video,audio:false}),track=stream.getVideoTracks?.()[0]||stream.getTracks()[0];
   if(await usableVideoTrack(track))return stream;
   for(const item of stream.getTracks())item.stop();
   failures.push('pista sin imagen');
  }catch(error){if(['NotAllowedError','SecurityError'].includes(error?.name))throw error;failures.push(error?.name||'Error');}
  if(index===0)try{for(const device of await navigator.mediaDevices.enumerateDevices())if(device.kind==='videoinput'&&device.deviceId)candidates.push({deviceId:{exact:device.deviceId}});}catch{}
 }
 throw new Error('Ninguna cámara entregó imagen: '+failures.join(', '));
}
export class VoiceRoom {
 constructor({id,send,iceServers,onStream,onStatus}) {Object.assign(this,{id,send,iceServers,onStream,onStatus});this.peers=new Map();this.local={audio:null,video:null};this.localStreams={audio:null,video:null};}
 async connect(id) {
  if(this.peers.has(id)||id===this.id)return;
  const pc=new RTCPeerConnection({iceServers:this.iceServers});
  const entry={pc,candidates:[],stream:new MediaStream(),audio:null,video:null,signals:Promise.resolve()};
  this.peers.set(id,entry);this.onStream(id,entry.stream);
  if(this.id<id){for(const kind of ['audio','video']){entry[kind]=pc.addTransceiver(kind,{direction:'sendrecv'});if(this.local[kind])await entry[kind].sender.replaceTrack(this.local[kind]);}}
  pc.onicecandidate=e=>{if(e.candidate)this.send(id,{candidate:e.candidate.toJSON()});};
  pc.ontrack=e=>{entry.stream.addTrack(e.track);this.onStream(id,entry.stream);};
  pc.onconnectionstatechange=()=>this.onStatus(id,pc.connectionState);
  if(this.id<id){await pc.setLocalDescription(await pc.createOffer());this.send(id,{description:pc.localDescription.toJSON()});}
 }
 async receive(id,data) {
  await this.connect(id);const e=this.peers.get(id);if(!e)return;
  const next=e.signals.then(()=>this.applySignal(id,e,data));e.signals=next.catch(()=>{});return next;
 }
 async applySignal(id,e,data) {
  if(data.description){await e.pc.setRemoteDescription(data.description);for(const c of e.candidates)await e.pc.addIceCandidate(c);e.candidates=[];if(data.description.type==='offer'){for(const kind of ['audio','video']){e[kind]=e.pc.getTransceivers().find(t=>t.receiver.track.kind===kind);e[kind].direction='sendrecv';await e[kind].sender.replaceTrack(this.local[kind]);}await e.pc.setLocalDescription(await e.pc.createAnswer());this.send(id,{description:e.pc.localDescription.toJSON()});}}
  if(data.candidate){if(e.pc.remoteDescription)await e.pc.addIceCandidate(data.candidate);else e.candidates.push(data.candidate);}
 }
 async toggle(kind) {
  if(this.local[kind]){const old=this.local[kind];this.local[kind]=null;this.localStreams[kind]=null;for(const e of this.peers.values())if(e[kind])await e[kind].sender.replaceTrack(null);old.stop();return false;}
  const stream=kind==='audio'?await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false}):await openWorkingCamera();
  this.localStreams[kind]=stream;this.local[kind]=stream.getTracks()[0];for(const e of this.peers.values())if(e[kind])await e[kind].sender.replaceTrack(this.local[kind]);return true;
 }
 remove(id){const e=this.peers.get(id);if(e){e.pc.close();this.peers.delete(id);this.onStream(id,null);}}
 close(){for(const id of this.peers.keys())this.remove(id);for(const t of Object.values(this.local))t?.stop();this.local={audio:null,video:null};this.localStreams={audio:null,video:null};}
}
