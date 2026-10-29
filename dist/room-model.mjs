export const ROOM_IDS = ['A', 'B', 'C', 'D'];
export function songLabel(room) {
  return room?.currentSong?.title?.trim() || 'Escogiendo';
}
export function randomName(random = Math.random) {
  const first = ['Luna', 'Zorro', 'Panda', 'Colibrí', 'Koala', 'Tigre', 'Gato', 'Sol'];
  const last = ['Cósmico', 'Violeta', 'Musical', 'Dorado', 'Azul', 'Neón', 'Estelar', 'Coral'];
  return `${first[Math.floor(random()*first.length)]} ${last[Math.floor(random()*last.length)]} ${Math.floor(random()*90)+10}`;
}
export function roomMembers(presence, roomId, now = Date.now()) {
  return Object.values(presence).filter(p => p.roomId === roomId && Number.isFinite(p.seenAt) && now-p.seenAt < 35000);
}
