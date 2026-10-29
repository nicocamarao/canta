export class VoiceRoom {
 constructor({id,send,iceServers,onStream,onStatus}) {Object.assign(this,{id,send,iceServers,onStream,onStatus});this.peers=new Map();this.local={audio:null,video:null};}
 async connect(id) {
  if(this.peers.has(id)||id===this.id)return;
  const pc=new RTCPeerConnection({iceServers:this.iceServers});
  const entry={pc,candidates:[],stream:new MediaStream(),audio:pc.addTransceiver('audio',{direction:'sendrecv'}),video:pc.addTransceiver('video',{direction:'sendrecv'})};
  this.peers.set(id,entry);this.onStream(id,entry.stream);
  for(const kind of ['audio','video'])if(this.local[kind])await entry[kind].sender.replaceTrack(this.local[kind]);
  pc.onicecandidate=e=>{if(e.candidate)this.send(id,{candidate:e.candidate.toJSON()});};
  pc.ontrack=e=>{entry.stream.addTrack(e.track);this.onStream(id,entry.stream);};
  pc.onconnectionstatechange=()=>this.onStatus(id,pc.connectionState);
  if(this.id<id){await pc.setLocalDescription(await pc.createOffer());this.send(id,{description:pc.localDescription.toJSON()});}
 }
 async receive(id,data) {
  await this.connect(id);const e=this.peers.get(id);if(!e)return;
  if(data.description){await e.pc.setRemoteDescription(data.description);for(const c of e.candidates)await e.pc.addIceCandidate(c);e.candidates=[];if(data.description.type==='offer'){await e.pc.setLocalDescription(await e.pc.createAnswer());this.send(id,{description:e.pc.localDescription.toJSON()});}}
  if(data.candidate){if(e.pc.remoteDescription)await e.pc.addIceCandidate(data.candidate);else e.candidates.push(data.candidate);}
 }
 async toggle(kind) {
  if(this.local[kind]){const old=this.local[kind];this.local[kind]=null;for(const e of this.peers.values())await e[kind].sender.replaceTrack(null);old.stop();return false;}
  const stream=await navigator.mediaDevices.getUserMedia(kind==='audio'?{audio:{echoCancellation:true,noiseSuppression:true},video:false}:{video:{width:640,height:360},audio:false});
  this.local[kind]=stream.getTracks()[0];for(const e of this.peers.values())await e[kind].sender.replaceTrack(this.local[kind]);return true;
 }
 remove(id){const e=this.peers.get(id);if(e){e.pc.close();this.peers.delete(id);this.onStream(id,null);}}
 close(){for(const id of this.peers.keys())this.remove(id);for(const t of Object.values(this.local))t?.stop();this.local={audio:null,video:null};}
}
