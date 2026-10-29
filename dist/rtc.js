const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function openCamera(){
 const attempts=[{width:640,height:360},true],failures=[];
 try{for(const device of await navigator.mediaDevices.enumerateDevices())if(device.kind==='videoinput'&&device.deviceId)attempts.push({deviceId:{exact:device.deviceId}});}catch{}
 for(const video of attempts)try{
  const stream=await navigator.mediaDevices.getUserMedia({video,audio:false});
  await delay(250);
  const track=stream.getVideoTracks?.()[0]||stream.getTracks()[0];
  if(track?.readyState==='live')return stream;
  for(const item of stream.getTracks())item.stop();
  failures.push('pista terminada');
 }catch(error){if(['NotAllowedError','SecurityError'].includes(error?.name))throw error;failures.push((error?.name||'Error')+': '+(error?.message||''));}
 throw new Error('Ninguna cámara entregó una pista activa. '+failures.join(' · '));
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
  if(this.local[kind]&&this.local[kind].readyState!=='ended'){const old=this.local[kind];this.local[kind]=null;this.localStreams[kind]=null;await Promise.allSettled([...this.peers.values()].filter(e=>e[kind]).map(e=>e[kind].sender.replaceTrack(null)));old.stop();return false;}
  this.local[kind]=null;this.localStreams[kind]=null;
  let stream;
  if(kind==='audio')stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
  else stream=await openCamera();
  this.localStreams[kind]=stream;this.local[kind]=stream.getTracks()[0];if(!this.local[kind]||this.local[kind].readyState==='ended')throw new Error('No se recibió una pista de '+kind);this.local[kind].enabled=true;await Promise.allSettled([...this.peers.values()].filter(e=>e[kind]).map(e=>e[kind].sender.replaceTrack(this.local[kind])));return true;
 }
 remove(id){const e=this.peers.get(id);if(e){e.pc.close();this.peers.delete(id);this.onStream(id,null);}}
 close(){for(const id of this.peers.keys())this.remove(id);const tracks=new Set(Object.values(this.local));for(const stream of Object.values(this.localStreams))for(const track of stream?.getTracks?.()||[])tracks.add(track);for(const track of tracks)track?.stop();this.local={audio:null,video:null};this.localStreams={audio:null,video:null};}
}
