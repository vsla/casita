import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { spotifyPlaySchema, spotifySettingsSchema, spotifySleepSchema } from '@home-hub/shared';
import { z } from 'zod';
import { listIcloudCalendars, icloudConfigured, syncIcloudCalendar } from '../integrations/calendar.js';
import { getCameraStatus } from '../integrations/camera.js';
import { getIntegration, saveIntegration } from '../integrations/configStore.js';
import { albumRef, syncIcloudPhotos } from '../integrations/icloudPhotos.js';
import {
  disconnectSpotify,
  finishSpotifyLogin,
  getSpotifyStatus,
  saveSpotifyPreferences,
  spotifyAccount,
  spotifyCommand,
  spotifyLoginUrl,
  setSpotifySleep,
  spotifyPlaylists,
  spotifyQueue,
} from '../integrations/spotify.js';
import { integrationStatuses } from '../integrations/index.js';
import { getWeather } from '../integrations/weather.js';
import { me, requireRole } from '../lib/auth.js';
import { HttpError } from '../lib/errors.js';
import { broadcast } from '../lib/realtime.js';
import { getHousehold } from './household.js';

export async function integrationRoutes(app: FastifyInstance) {
  app.get('/api/integrations', async (request) => integrationStatuses(await getHousehold(me(request).householdId)));

  // null = clima desligado, sem localização ou sem internet; o card some
  app.get('/api/weather', async (request) => {
    const h = await getHousehold(me(request).householdId);
    if (!h.weatherEnabled || h.latitude == null || h.longitude == null) return null;
    return getWeather(h.latitude, h.longitude, h.timezone, h.city);
  });

  app.get('/api/camera', async () => getCameraStatus());

  // Repassa o vídeo do gateway local para quem está logado. Só caminhos de mídia;
  // a API de configuração do go2rtc (que contém a URL RTSP com senha) nunca é exposta.
  const MEDIA = /^(stream\.m3u8|stream\.mp4|hls\/[\w.-]+|frame\.jpeg|snapshot\.jpg|stream\/[\w.-]+)$/;
  app.get('/api/camera/proxy/*', async (request, reply) => {
    const base = config.camera.gatewayUrl;
    const path = (request.params as { '*': string })['*'];
    if (!base || !MEDIA.test(path)) throw new HttpError(404, 'Recurso da câmera não encontrado');
    const qs = request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : '';
    const upstream = `${base}${config.camera.kind === 'go2rtc' ? '/api' : ''}/${path}${qs}`;
    // O limite vale só até o gateway responder: o vídeo é contínuo e não pode ser cortado.
    // Quando o navegador fecha a conexão, encerra também a do gateway.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 15_000);
    reply.raw.once('close', () => abort.abort());
    const res = await fetch(upstream, { signal: abort.signal }).catch(() => null);
    clearTimeout(timer);
    if (!res?.ok || !res.body) throw new HttpError(502, 'Câmera indisponível');
    reply.header('Content-Type', res.headers.get('content-type') ?? 'application/octet-stream').header('Cache-Control', 'no-store');
    return reply.send(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream));
  });

  // ---------- Fotos do iCloud ----------
  app.get('/api/integrations/icloud-photos', async (request) => {
    requireRole(request, 'admin');
    const cfg = await getIntegration(me(request).householdId, 'icloud_photos');
    return { enabled: cfg?.enabled ?? false, albumUrl: String(cfg?.settings.albumUrl ?? '') };
  });

  app.put('/api/integrations/icloud-photos', async (request) => {
    const m = requireRole(request, 'admin');
    const body = z.object({ albumUrl: z.string().trim().max(300), enabled: z.boolean() }).parse(request.body);
    if (body.albumUrl && !albumRef(body.albumUrl))
      throw new HttpError(400, 'Link inválido. Use o link público do álbum (photos.icloud.com/shared/album/…)');
    const cfg = await getIntegration(m.householdId, 'icloud_photos');
    await saveIntegration(m.householdId, 'icloud_photos', {
      enabled: body.enabled && !!body.albumUrl,
      settings: { ...(cfg?.settings ?? {}), albumUrl: body.albumUrl },
      lastError: null,
    });
    return { ok: true };
  });

  app.post('/api/integrations/icloud-photos/sync', async (request) => {
    const m = requireRole(request, 'admin', 'member');
    const r = await syncIcloudPhotos(m.householdId).catch((e: Error) => {
      throw new HttpError(502, e.message);
    });
    if (r.skipped) throw new HttpError(400, 'Configure e ative o álbum antes de sincronizar');
    broadcast(m.householdId, 'photos');
    return r;
  });

  // ---------- Calendário iCloud ----------
  app.get('/api/integrations/icloud-calendar/calendars', async (request) => {
    const m = requireRole(request, 'admin');
    if (!icloudConfigured()) throw new HttpError(400, 'Defina ICLOUD_USERNAME e ICLOUD_APP_PASSWORD no .env do servidor');
    const cfg = await getIntegration(m.householdId, 'icloud_calendar');
    const chosen = String(cfg?.settings.calendarUrls ?? '').split('\n');
    const cals = await listIcloudCalendars().catch((e: Error) => {
      throw new HttpError(502, e.message);
    });
    return cals.map((c) => ({ ...c, selected: chosen.includes(c.url) }));
  });

  app.put('/api/integrations/icloud-calendar', async (request) => {
    const m = requireRole(request, 'admin');
    const { calendarUrls } = z.object({ calendarUrls: z.array(z.string().url()).max(20) }).parse(request.body);
    await saveIntegration(m.householdId, 'icloud_calendar', { enabled: calendarUrls.length > 0, settings: { calendarUrls: calendarUrls.join('\n') }, lastError: null });
    return { ok: true };
  });

  app.post('/api/integrations/icloud-calendar/sync', async (request) => {
    const m = requireRole(request, 'admin', 'member');
    const r = await syncIcloudCalendar(m.householdId).catch((e: Error) => {
      throw new HttpError(502, e.message);
    });
    if (r.skipped) throw new HttpError(400, 'Escolha ao menos um calendário antes de sincronizar');
    broadcast(m.householdId, 'calendar');
    return r;
  });

  // ---------- Spotify ----------
  // Qualquer morador (e o painel) vê e controla a música; conectar a conta é só do admin.
  app.get('/api/spotify', async (request) => getSpotifyStatus(me(request).householdId));

  const command = z.discriminatedUnion('action', [
    spotifyPlaySchema.extend({ action: z.literal('play') }),
    z.object({ action: z.enum(['pause', 'next', 'previous']) }),
    z.object({ action: z.literal('volume'), percent: z.number().min(0).max(100) }),
  ]);
  app.post('/api/spotify/command', async (request) => {
    const m = me(request);
    await spotifyCommand(m.householdId, command.parse(request.body));
    broadcast(m.householdId, 'spotify');
    return { ok: true };
  });

  app.get('/api/spotify/queue', async (request) => spotifyQueue(me(request).householdId));
  app.put('/api/spotify/sleep', async (request) => {
    const m = me(request);
    const { minutes } = spotifySleepSchema.parse(request.body);
    const at = setSpotifySleep(m.householdId, minutes, () => broadcast(m.householdId, 'spotify'));
    broadcast(m.householdId, 'spotify');
    return { sleepAt: at };
  });

  app.get('/api/integrations/spotify', async (request) => spotifyAccount(requireRole(request, 'admin').householdId));
  app.get('/api/integrations/spotify/playlists', async (request) => spotifyPlaylists(requireRole(request, 'admin').householdId));
  app.put('/api/integrations/spotify', async (request) => {
    const m = requireRole(request, 'admin');
    await saveSpotifyPreferences(m.householdId, spotifySettingsSchema.parse(request.body));
    broadcast(m.householdId, 'spotify');
    return { ok: true };
  });
  app.delete('/api/integrations/spotify', async (request) => {
    const m = requireRole(request, 'admin');
    await disconnectSpotify(m.householdId);
    broadcast(m.householdId, 'spotify');
    return { ok: true };
  });
  app.post('/api/integrations/spotify/login', async (request) => ({ url: spotifyLoginUrl(requireRole(request, 'admin').householdId) }));

  // Volta do Spotify depois do login. Chega sem sessão (o endereço é 127.0.0.1): quem prova a
  // casa é o "state" de uso único criado acima. Responde uma página simples para fechar.
  app.get('/api/integrations/spotify/callback', async (request, reply) => {
    const q = z.object({ code: z.string().optional(), state: z.string().default(''), error: z.string().optional() }).parse(request.query);
    let msg = 'Spotify conectado! Pode fechar esta aba e voltar ao painel.';
    try {
      if (q.error || !q.code) throw new HttpError(400, 'Login cancelado no Spotify.');
      await finishSpotifyLogin(q.code, q.state);
    } catch (e) {
      msg = e instanceof Error ? e.message : 'Não foi possível conectar.';
    }
    const esc = msg.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
    return reply
      .type('text/html; charset=utf-8')
      .send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Spotify</title><body style="font:18px system-ui;display:grid;place-items:center;height:90vh;background:#f5efe6;color:#3a352e"><p>${esc}</p></body>`);
  });
}
