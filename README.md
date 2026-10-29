# Canta

Karaoke social en HTML/CSS/JavaScript, publicado en GitHub Pages.

- Cuatro salas con nombres aleatorios y presencia en Supabase Realtime.
- Búsqueda de YouTube: solo títulos que contengan la palabra karaoke.
- Video sincronizado con reloj del servidor y estado persistente en Postgres.
- Voz y cámara WebRTC, apagados inicialmente y detenidos al salir.
- Perfil editable con nombre y foto, persistente en el dispositivo y visible para las personas conectadas.
- Sala D dedicada a chat con video, sin canciones.
- Salas permanentes con nombre propio creadas por usuarios; las salas A–D permanecen fijas y las demás se ordenan por ocupación.
- La clave de YouTube es pública por diseño y está restringida al dominio y API.
- Al responder Google quotaExceeded/dailyLimitExceeded, se detienen las búsquedas hasta el siguiente día de cuota (hora del Pacífico).

## Configuración
Ejecutar `supabase/setup.sql`, `supabase/queue.sql`, las migraciones de presencia, `supabase/custom-rooms.sql` y finalmente `supabase/chat-room-d.sql`; habilitar Anonymous Sign-ins y completar las claves públicas de `dist/config.js`. Nunca usar claves secret/service_role en el frontend. El dominio permitido de la clave YouTube debe ser `https://nicocamarao.github.io/*`.

El perfil y la sesión anónima se conservan en `localStorage` hasta que la persona borre los datos del sitio. No se usan cookies con vencimiento.

## Conexión de voz
Se utiliza WebRTC entre pares con STUN. Algunas redes necesitan TURN; configurar `iceServers` con credenciales temporales emitidas por un backend para cubrir esos casos. No se promete audio musical perfectamente sincronizado: cada receptor tiene latencia de red y reproducción distinta. Usar auriculares.

## Uso
Entrar a una sala, elegir canción como anfitrión y compartir el enlace. El audio recibido permanece activo; cada participante controla su micrófono y cámara. Si el navegador bloquea el audio, se solicita un toque inicial para habilitarlo. Cada participante agrega canciones a una cola persistente. Al llegar su turno tiene 15 segundos para pulsar Comenzar; si no lo hace, se salta el turno. El servidor fija un inicio común 5 segundos después del botón. La sala es abierta: comenzar una canción no silencia a los espectadores ni reduce automáticamente el volumen. El cantante arranca desde 00:00; los espectadores esperan el inicio real y usan un desplazamiento objetivo de 500 ms. La precisión efectiva depende del reproductor y la red. Parar canción corta el turno y pasa al siguiente. Las sesiones envían una señal cada 2 segundos; después de 8 segundos sin señal se elimina al participante y su cola y se libera su turno al siguiente barrido (hasta 2 segundos adicionales). El chat es efímero, en tiempo real, y no se guarda al cerrar la sesión.

Aplicar también `supabase/playback-presence.sql` después de `queue.sql`. Pruebas: `node tests/playback-clock.mjs` y `node tests/playback-presence.mjs` (requiere sala B vacía).

Aplicar `supabase/enqueue-lease.sql` después de la migración de presencia para rechazar inserciones de sesiones vencidas sin confirmaciones falsas.
