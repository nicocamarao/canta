# Pendientes de Canta

## Sincronización automática con la voz

Investigar si la reproducción puede ajustarse mientras canta la persona. No alcanza con detectar que hay voz: habría que comparar el audio del micrófono con una referencia temporal de la canción y distinguir voz, eco y ruido.

Opciones para un prototipo:

- estimar latencia con una prueba de sonido antes de cantar;
- detectar frases o fonemas con reconocimiento de voz y compararlos con letras cronometradas;
- alinear características del audio con una pista de referencia mediante un servicio backend.

Es un desarrollo difícil de validar automáticamente: necesita pruebas reales con distintos teléfonos, auriculares, redes y canciones. El navegador tampoco permite capturar directamente el audio reproducido por el iframe de YouTube.

## Letras sin mostrar el video

YouTube no entrega las letras ni sus tiempos a través de su API. Además, su reproductor embebido no debe ocultarse ni utilizarse como un reproductor de solo audio. Para mostrar letras propias marcadas al ritmo se necesita una fuente autorizada de letras sincronizadas (por ejemplo, LRC) y sus licencias.

Hasta contar con esa fuente, conservar el video karaoke visible: allí vienen incorporadas las letras y se mantiene el uso permitido del reproductor.
