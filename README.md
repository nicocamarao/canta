# Canta

Karaoke social en HTML/CSS/JavaScript, publicado en GitHub Pages.

- Cuatro salas con nombres aleatorios y presencia en Supabase Realtime.
- Búsqueda de YouTube: solo títulos que contengan la palabra karaoke.
- Video sincronizado con reloj del servidor y estado persistente en Postgres.
- Voz y cámara WebRTC, apagados inicialmente y detenidos al salir.
- La clave de YouTube es pública por diseño y está restringida al dominio y API.
- Al responder Google quotaExceeded/dailyLimitExceeded, se detienen las búsquedas hasta el siguiente día de cuota (hora del Pacífico).

## Configuración
Ejecutar `supabase/setup.sql` y después `supabase/queue.sql`, habilitar Anonymous Sign-ins y completar las claves públicas de `dist/config.js`. Nunca usar claves secret/service_role en el frontend. El dominio permitido de la clave YouTube debe ser `https://nicocamarao.github.io/*`.

## Conexión de voz
Se utiliza WebRTC entre pares con STUN. Algunas redes necesitan TURN; configurar `iceServers` con credenciales temporales emitidas por un backend para cubrir esos casos. No se promete audio musical perfectamente sincronizado: cada receptor tiene latencia de red y reproducción distinta. Usar auriculares.

## Uso
Entrar a una sala, elegir canción como anfitrión y compartir el enlace. El invitado pulsa Activar sonido y activa su micrófono o cámara si lo desea. Cada participante agrega canciones a una cola persistente. Al llegar su turno tiene 15 segundos para pulsar Comenzar; si no lo hace, se salta el turno. El servidor fija un inicio común 3 segundos después del botón. Los demás micrófonos se silencian al iniciar y se pueden volver a activar con aviso de eco y volumen reducido. La sincronización del video es automática. El chat es efímero, en tiempo real, y no se guarda al cerrar la sesión.
