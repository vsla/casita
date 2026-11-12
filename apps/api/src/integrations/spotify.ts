// Nuvem · Spotify (API oficial). Mostra o que toca em qualquer aparelho da conta (celular, PC, TV)
// e controla: play/pausa, pular, volume e "tocar na TV" (passa a reprodução para outro aparelho).
// O token fica só no servidor (integration_configs.settings.refreshToken); o navegador nunca vê.
import { randomBytes } from 'node:crypto';
import type { SpotifyDevice, SpotifyQueueItem, SpotifyStatus } from '@home-hub/shared';
import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { getIntegration, saveIntegration } from './configStore.js';

const ACCOUNTS = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private';

type Settings = {
  refreshToken?: string;
  account?: string;
  tvDevice?: string | null;
  defaultContext?: { uri: string; name: string } | null;
  shortcuts?: { uri: string; name: string }[];
};

export const spotifyConfigured = () => !!(config.spotify.clientId && config.spotify.clientSecret);

// ---------- Login (OAuth) ----------

// state do OAuth → casa. Uso único, vale 10 min.
const pendingLogins = new Map<string, { householdId: number; at: number }>();
const LOGIN_TTL_MS = 10 * 60_000;

export function spotifyLoginUrl(householdId: number) {
  if (!spotifyConfigured()) throw new HttpError(400, 'Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env do servidor');
  for (const [k, v] of pendingLogins) if (Date.now() - v.at > LOGIN_TTL_MS) pendingLogins.delete(k);
  const state = randomBytes(16).toString('hex');
  pendingLogins.set(state, { householdId, at: Date.now() });
  const q = new URLSearchParams({
    client_id: config.spotify.clientId!,
    response_type: 'code',
    redirect_uri: config.spotify.redirectUri,
    scope: SCOPES,
    state,
  });
  return `${ACCOUNTS}/authorize?${q}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const basic = Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64');
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 400) throw new SpotifyLoginExpired();
  if (!res.ok) throw new HttpError(502, `Spotify recusou o login (HTTP ${res.status})`);
  return (await res.json()) as TokenResponse;
}

class SpotifyLoginExpired extends HttpError {
  constructor() {
    super(401, 'O login do Spotify expirou. Conecte de novo em Ajustes → Integrações.');
  }
}

export async function finishSpotifyLogin(code: string, state: string) {
  const pending = pendingLogins.get(state);
  pendingLogins.delete(state);
  if (!pending || Date.now() - pending.at > LOGIN_TTL_MS) throw new HttpError(400, 'Link de login expirado. Tente de novo pelos Ajustes.');
  const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: config.spotify.redirectUri });
  tokens.set(pending.householdId, { access: t.access_token, until: Date.now() + (t.expires_in - 60) * 1000 });
  const profile = (await spotifyApi(pending.householdId, 'GET', '/me', undefined, t.access_token)) as { display_name?: string; id: string };
  const current = await settingsOf(pending.householdId);
  await saveIntegration(pending.householdId, 'spotify', {
    enabled: true,
    settings: stored({ ...current, refreshToken: t.refresh_token, account: profile.display_name ?? profile.id }),
    lastError: null,
  });
  statusCache.delete(pending.householdId);
}

export async function disconnectSpotify(householdId: number) {
  tokens.delete(householdId);
  statusCache.delete(householdId);
  const { tvDevice, defaultContext, shortcuts } = await settingsOf(householdId);
  await saveIntegration(householdId, 'spotify', { enabled: false, settings: stored({ tvDevice, defaultContext, shortcuts }), lastError: null });
}

// No banco as configurações são planas (texto); aqui viram o objeto acima
type Stored = Record<string, string | number | boolean>;
async function settingsOf(householdId: number): Promise<Settings> {
  const s = ((await getIntegration(householdId, 'spotify'))?.settings ?? {}) as Stored;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  return {
    refreshToken: str(s.refreshToken),
    account: str(s.account),
    tvDevice: str(s.tvDevice) ?? null,
    defaultContext: str(s.contextUri) ? { uri: String(s.contextUri), name: String(s.contextName ?? '') } : null,
    shortcuts: parseShortcuts(s.shortcuts),
  };
}
function stored(s: Settings): Stored {
  const out: Stored = {};
  if (s.refreshToken) out.refreshToken = s.refreshToken;
  if (s.account) out.account = s.account;
  if (s.tvDevice) out.tvDevice = s.tvDevice;
  if (s.defaultContext) Object.assign(out, { contextUri: s.defaultContext.uri, contextName: s.defaultContext.name });
  if (s.shortcuts?.length) out.shortcuts = JSON.stringify(s.shortcuts);
  return out;
}
function parseShortcuts(v: unknown): { uri: string; name: string }[] {
  try {
    const list = typeof v === 'string' ? (JSON.parse(v) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is { uri: string; name: string } => typeof x?.uri === 'string' && typeof x?.name === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveSpotifyPreferences(householdId: number, prefs: Pick<Settings, 'tvDevice' | 'defaultContext' | 'shortcuts'>) {
  await saveIntegration(householdId, 'spotify', { settings: stored({ ...(await settingsOf(householdId)), ...prefs }) });
  statusCache.delete(householdId);
}

export async function spotifyAccount(householdId: number) {
  const s = await settingsOf(householdId);
  return { connected: !!s.refreshToken, account: s.account ?? null, tvDevice: s.tvDevice ?? null, defaultContext: s.defaultContext ?? null, shortcuts: s.shortcuts ?? [] };
}

// ---------- Chamadas à API ----------

const tokens = new Map<number, { access: string; until: number }>();

async function accessToken(householdId: number): Promise<string> {
  const cached = tokens.get(householdId);
  if (cached && cached.until > Date.now()) return cached.access;
  const settings = await settingsOf(householdId);
  if (!settings.refreshToken) throw new HttpError(400, 'Spotify não conectado');
  try {
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: settings.refreshToken });
    tokens.set(householdId, { access: t.access_token, until: Date.now() + (t.expires_in - 60) * 1000 });
    // O Spotify às vezes troca o refresh token: guarda o novo
    if (t.refresh_token && t.refresh_token !== settings.refreshToken) {
      await saveIntegration(householdId, 'spotify', { settings: stored({ ...settings, refreshToken: t.refresh_token }) });
    }
    return t.access_token;
  } catch (e) {
    if (e instanceof SpotifyLoginExpired) await saveIntegration(householdId, 'spotify', { lastError: e.message });
    throw e;
  }
}

const REASONS: Record<string, string> = {
  NO_ACTIVE_DEVICE: 'Nenhum aparelho com o Spotify aberto agora',
  PREMIUM_REQUIRED: 'Controlar a reprodução exige Spotify Premium',
};

async function spotifyApi(householdId: number, method: string, path: string, body?: unknown, token?: string): Promise<unknown> {
  const auth = token ?? (await accessToken(householdId));
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${auth}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 401 && !token) {
    // token revogado antes da hora: renova uma vez
    tokens.delete(householdId);
    return spotifyApi(householdId, method, path, body, await accessToken(householdId));
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: { message?: string; reason?: string } } | null;
    const reason = err?.error?.reason;
    if (res.status === 429) throw new HttpError(503, 'Spotify pediu para esperar um pouco. Tente de novo em instantes.');
    throw new HttpError(res.status === 404 || res.status === 403 ? 409 : 502, (reason && REASONS[reason]) || `Spotify: ${err?.error?.message ?? `HTTP ${res.status}`}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---------- Status ----------

type ApiDevice = { id: string | null; name: string; type: string; is_active: boolean; volume_percent: number | null; is_restricted: boolean };
type ApiPlayer = {
  is_playing: boolean;
  progress_ms: number | null;
  device: ApiDevice;
  item: { name: string; duration_ms: number; artists?: { name: string }[]; album?: { images: { url: string; width: number }[] }; show?: { name: string; images: { url: string; width: number }[] } } | null;
} | null;

const device = (d: ApiDevice): SpotifyDevice => ({ id: d.id ?? '', name: d.name, type: d.type, active: d.is_active, volume: d.volume_percent });
// imagem média (~300px): nítida no card sem pesar
const pickImage = (imgs?: { url: string; width: number }[]) =>
  imgs?.length ? [...imgs].sort((a, b) => Math.abs(a.width - 300) - Math.abs(b.width - 300))[0]!.url : null;

// Painel e celulares consultam juntos: segura a resposta por alguns segundos
const CACHE_MS = 3000;
const statusCache = new Map<number, { at: number; status: SpotifyStatus }>();

export async function getSpotifyStatus(householdId: number): Promise<SpotifyStatus> {
  if (!spotifyConfigured()) return { state: 'not_configured' };
  const settings = await settingsOf(householdId);
  if (!settings.refreshToken) return { state: 'disconnected' };
  const cached = statusCache.get(householdId);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.status;
  let status: SpotifyStatus;
  try {
    const [player, list] = (await Promise.all([
      spotifyApi(householdId, 'GET', '/me/player?additional_types=episode'),
      spotifyApi(householdId, 'GET', '/me/player/devices'),
    ])) as [ApiPlayer, { devices: ApiDevice[] }];
    const item = player?.item;
    status = {
      state: 'connected',
      playing: !!player?.is_playing,
      device: player?.device ? device(player.device) : null,
      track: item
        ? {
            name: item.name,
            artists: item.artists?.map((a) => a.name).join(', ') ?? item.show?.name ?? '',
            image: pickImage(item.album?.images ?? item.show?.images),
            durationMs: item.duration_ms,
            progressMs: player?.progress_ms ?? 0,
          }
        : null,
      devices: list.devices.filter((d) => d.id && !d.is_restricted).map(device),
      tvDevice: settings.tvDevice ?? null,
      defaultContext: settings.defaultContext ?? null,
      shortcuts: settings.shortcuts ?? [],
      sleepAt: sleepTimers.get(householdId)?.at.toISOString() ?? null,
    };
  } catch (e) {
    status = { state: 'unavailable', detail: e instanceof Error ? e.message : 'Spotify sem resposta' };
  }
  statusCache.set(householdId, { at: Date.now(), status });
  return status;
}

// ---------- Comandos ----------

export async function spotifyCommand(
  householdId: number,
  cmd: { action: 'play'; deviceId?: string; contextUri?: string } | { action: 'pause' | 'next' | 'previous' } | { action: 'volume'; percent: number },
) {
  statusCache.delete(householdId);
  switch (cmd.action) {
    case 'play': {
      const q = cmd.deviceId ? `?device_id=${encodeURIComponent(cmd.deviceId)}` : '';
      // Em outro aparelho sem playlist escolhida: transfere o que já estava tocando
      if (cmd.deviceId && !cmd.contextUri) return spotifyApi(householdId, 'PUT', '/me/player', { device_ids: [cmd.deviceId], play: true });
      return spotifyApi(householdId, 'PUT', `/me/player/play${q}`, cmd.contextUri ? { context_uri: cmd.contextUri } : undefined);
    }
    case 'pause':
      return spotifyApi(householdId, 'PUT', '/me/player/pause');
    case 'next':
      return spotifyApi(householdId, 'POST', '/me/player/next');
    case 'previous':
      return spotifyApi(householdId, 'POST', '/me/player/previous');
    case 'volume':
      return spotifyApi(householdId, 'PUT', `/me/player/volume?volume_percent=${Math.round(cmd.percent)}`);
  }
}

export async function spotifyPlaylists(householdId: number) {
  const r = (await spotifyApi(householdId, 'GET', '/me/playlists?limit=50')) as { items: ({ uri: string; name: string } | null)[] };
  return r.items.filter((p): p is { uri: string; name: string } => !!p).map((p) => ({ uri: p.uri, name: p.name }));
}

type ApiTrack = { name: string; artists?: { name: string }[]; album?: { images: { url: string; width: number }[] }; show?: { name: string; images: { url: string; width: number }[] } };

/** Próximas da fila (o Spotify não deixa pular direto para uma delas, só ver) */
export async function spotifyQueue(householdId: number): Promise<SpotifyQueueItem[]> {
  const r = (await spotifyApi(householdId, 'GET', '/me/player/queue')) as { queue?: ApiTrack[] } | null;
  return (r?.queue ?? []).slice(0, 10).map((t) => ({
    name: t.name,
    artists: t.artists?.map((a) => a.name).join(', ') ?? t.show?.name ?? '',
    image: pickImage(t.album?.images ?? t.show?.images),
  }));
}

// ---------- Timer para pausar ----------
// Fica na memória do servidor: some se a API reiniciar (o card deixa de mostrar o timer).
const sleepTimers = new Map<number, { at: Date; timer: NodeJS.Timeout }>();

export function setSpotifySleep(householdId: number, minutes: number | null, onFire: () => void) {
  clearTimeout(sleepTimers.get(householdId)?.timer);
  sleepTimers.delete(householdId);
  statusCache.delete(householdId);
  if (!minutes) return null;
  const at = new Date(Date.now() + minutes * 60_000);
  const timer = setTimeout(async () => {
    sleepTimers.delete(householdId);
    statusCache.delete(householdId);
    // Se já estiver pausado, o Spotify responde erro: tudo bem, o objetivo era parar
    await spotifyApi(householdId, 'PUT', '/me/player/pause').catch(() => {});
    onFire();
  }, minutes * 60_000);
  timer.unref();
  sleepTimers.set(householdId, { at, timer });
  return at.toISOString();
}
