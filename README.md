# Canta

Karaoke social en HTML/CSS/JavaScript, publicado en GitHub Pages.

- Cuatro salas con nombres aleatorios y presencia en Supabase Realtime.
- Búsqueda de YouTube: solo títulos que contengan la palabra karaoke.
- Video sincronizado con reloj del servidor y estado persistente en Postgres.
- Voz y cámara WebRTC, apagados inicialmente y detenidos al salir.
- Perfil editable con nombre y foto, persistente en el dispositivo y visible para las personas conectadas.
- Sala D dedicada a chat con video, sin canciones.
- Salas permanentes con nombre propio creadas por usuarios; las salas A–D permanecen fijas y las demás se ordenan por ocupación.
- YouTube se consulta mediante una Supabase Edge Function; la clave no llega al navegador.
- Las búsquedas se cachean y se cortan preventivamente al alcanzar 8.000 unidades diarias estimadas.

## Configuración
Ejecutar `supabase/setup.sql`, `supabase/queue.sql`, `supabase/playback-presence.sql`, `supabase/enqueue-lease.sql`, `supabase/custom-rooms.sql`, `supabase/chat-room-d.sql` y `supabase/youtube-proxy.sql`. Habilitar Anonymous Sign-ins, guardar `YOUTUBE_API_KEY` como secreto y desplegar `youtube-search`. Nunca usar claves secret/service_role en el frontend.

El perfil y la sesión anónima se conservan en `localStorage` hasta que la persona borre los datos del sitio. No se usan cookies con vencimiento.

## Conexión de voz
Se utiliza WebRTC entre pares con STUN. Algunas redes necesitan TURN; configurar `iceServers` con credenciales temporales emitidas por un backend para cubrir esos casos. No se promete audio musical perfectamente sincronizado: cada receptor tiene latencia de red y reproducción distinta. Usar auriculares.

## Uso
Entrar a una sala, elegir canción como anfitrión y compartir el enlace. El audio recibido permanece activo; cada participante controla su micrófono y cámara. Si el navegador bloquea el audio, se solicita un toque inicial para habilitarlo. Cada participante agrega canciones a una cola persistente. Al llegar su turno tiene 15 segundos para pulsar Comenzar; si no lo hace, se salta el turno. El servidor fija un inicio común 5 segundos después del botón. La sala es abierta: comenzar una canción no silencia a los espectadores ni reduce automáticamente el volumen. El cantante arranca desde 00:00; los espectadores esperan el inicio real y usan un desplazamiento objetivo de 300 ms. La precisión efectiva depende del reproductor y la red. Terminar canción corta el turno y pasa al siguiente. Recargar conserva la sesión, la URL de sala y el turno; después de 15 segundos sin señal se elimina al participante, su cola y su turno. El chat es efímero, en tiempo real, y no se guarda al cerrar la sesión.

Aplicar también `supabase/playback-presence.sql` después de `queue.sql`. Pruebas: `node tests/playback-clock.mjs` y `node tests/playback-presence.mjs` (requiere sala B vacía).

Aplicar `supabase/enqueue-lease.sql` después de la migración de presencia para rechazar inserciones de sesiones vencidas sin confirmaciones falsas.
