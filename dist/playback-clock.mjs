export const SPECTATOR_DELAY_MS=350;
export function playbackTarget(room,serverNow,isSinger){
 if(room.phase!=='playing'||!room.started_at)return 0;
 return Math.max(0,(serverNow-Date.parse(room.started_at)-(isSinger?0:SPECTATOR_DELAY_MS))/1000);
}
export function shouldStart(room,serverNow,isSinger){
 if(room.phase!=='playing')return false;
 return isSinger?serverNow>=Date.parse(room.updated_at):!!room.started_at&&serverNow>=Date.parse(room.started_at)+SPECTATOR_DELAY_MS;
}
