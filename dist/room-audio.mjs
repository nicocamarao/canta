// Incoming voice uses its own output, independent of camera visibility.
export class RoomAudio {
 constructor(createContext=()=>new (window.AudioContext||window.webkitAudioContext)()){this.createContext=createContext;this.context=null;this.sources=new Map();}
 ensure(){return this.context||(this.context=this.createContext());}
 get blocked(){return !this.context||this.context.state!=='running';}
 unlock(){return this.ensure().resume();}
 add(peer,stream){
  const tracks=stream.getAudioTracks().filter(t=>t.readyState!=='ended');
  if(!tracks.length)return;
  const key=tracks.map(t=>t.id).join(',');
  if(this.sources.get(peer)?.key===key)return;
  this.remove(peer);
  const context=this.ensure(),source=context.createMediaStreamSource(new MediaStream(tracks));
  source.connect(context.destination);this.sources.set(peer,{source,key});
 }
 remove(peer){this.sources.get(peer)?.source.disconnect();this.sources.delete(peer);}
 clear(){for(const peer of this.sources.keys())this.remove(peer);}
}
