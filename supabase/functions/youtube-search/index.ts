import { createClient } from 'jsr:@supabase/supabase-js@2';

const origins = new Set(['https://nicocamarao.github.io', 'http://127.0.0.1:8091', 'http://localhost:8091']);
const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const key = Deno.env.get('YOUTUBE_API_KEY');

function cors(request: Request) {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': origins.has(origin) ? origin : 'https://nicocamarao.github.io',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
function reply(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(request), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
async function hash(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((part) => part.toString(16).padStart(2, '0')).join('');
}
async function cacheGet(cacheKey: string) {
  const { data } = await service.from('youtube_api_cache').select('payload').eq('cache_key', cacheKey).gt('expires_at', new Date().toISOString()).maybeSingle();
  return data?.payload;
}
async function cacheSet(cacheKey: string, payload: unknown, hours: number) {
  await service.from('youtube_api_cache').upsert({
    cache_key: cacheKey,
    payload,
    expires_at: new Date(Date.now() + hours * 3600000).toISOString(),
  });
}
async function reserve(actor: string, requestKind: 'search' | 'detail', cost: 100 | 1) {
  const { data, error } = await service.rpc('reserve_youtube_quota', {
    actor,
    request_kind: requestKind,
    cost,
  });
  if (error) throw error;
  return data === true;
}

async function search(request: Request, userId: string, rawQuery: string) {
  const query = rawQuery.trim().replace(/\s+/g, ' ').slice(0, 80);
  if (query.length < 2) return reply(request, { error: 'Escribí al menos dos caracteres.' }, 400);
  const cacheKey = 'search:' + await hash(query.toLocaleLowerCase('es'));
  const hit = await cacheGet(cacheKey);
  if (hit) return reply(request, hit);
  if (!await reserve(userId, 'search', 100)) {
    return reply(request, { error: 'Se alcanzó el límite preventivo de búsquedas por hoy.' }, 429);
  }
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    maxResults: '25',
    q: query + ' karaoke',
    key: key!,
  });
  const upstream = await fetch('https://www.googleapis.com/youtube/v3/search?' + params, {
    headers: { Referer: 'https://nicocamarao.github.io/canta/' },
  });
  const json = await upstream.json();
  if (!upstream.ok) {
    const quota = json.error?.errors?.some((item: { reason?: string }) => ['quotaExceeded', 'dailyLimitExceeded'].includes(item.reason || ''));
    return reply(request, { error: quota ? 'YouTube agotó la cuota diaria.' : 'YouTube no pudo completar la búsqueda.' }, quota ? 429 : 502);
  }
  const payload = {
    items: (json.items || [])
      .filter((item: { snippet?: { title?: string } }) => /\bkaraoke\b/i.test(item.snippet?.title || ''))
      .map((item: { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails?: { medium?: { url?: string } } } }) => ({
        id: { videoId: item.id.videoId },
        snippet: {
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnails: { medium: { url: item.snippet.thumbnails?.medium?.url || '' } },
        },
      })),
  };
  await cacheSet(cacheKey, payload, 24);
  return reply(request, payload);
}

async function detail(request: Request, userId: string, videoId: string) {
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return reply(request, { error: 'Video inválido.' }, 400);
  const cacheKey = 'detail:' + videoId;
  const hit = await cacheGet(cacheKey);
  if (hit) return reply(request, hit);
  if (!await reserve(userId, 'detail', 1)) {
    return reply(request, { error: 'Se alcanzó el límite preventivo de consultas por hoy.' }, 429);
  }
  const upstream = await fetch('https://www.googleapis.com/youtube/v3/videos?' + new URLSearchParams({
    part: 'contentDetails',
    id: videoId,
    key: key!,
  }), { headers: { Referer: 'https://nicocamarao.github.io/canta/' } });
  const json = await upstream.json();
  if (!upstream.ok) return reply(request, { error: 'No se pudo consultar la duración.' }, 502);
  const match = json.items?.[0]?.contentDetails?.duration?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return reply(request, { error: 'El video no tiene una duración disponible.' }, 422);
  const payload = { seconds: (+match[1] || 0) * 3600 + (+match[2] || 0) * 60 + (+match[3] || 0) };
  await cacheSet(cacheKey, payload, 168);
  return reply(request, payload);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(request) });
  if (request.method !== 'POST') return reply(request, { error: 'Método no permitido.' }, 405);
  if (!key) return reply(request, { error: 'La búsqueda todavía no está configurada.' }, 503);
  const authorization = request.headers.get('authorization');
  if (!authorization) return reply(request, { error: 'Sesión requerida.' }, 401);
  const auth = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return reply(request, { error: 'Sesión inválida.' }, 401);
  let input: { action?: string; query?: string; videoId?: string };
  try {
    input = await request.json();
  } catch {
    return reply(request, { error: 'Solicitud inválida.' }, 400);
  }
  try {
    if (input.action === 'search') return await search(request, user.id, String(input.query || ''));
    if (input.action === 'detail') return await detail(request, user.id, String(input.videoId || ''));
    return reply(request, { error: 'Acción inválida.' }, 400);
  } catch (error) {
    console.error(error);
    return reply(request, { error: 'No se pudo completar la consulta.' }, 500);
  }
});
