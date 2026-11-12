// Local · Câmera Yoosee via gateway na rede da casa.
//
// A API não processa vídeo: ela consulta um gateway local que lê o RTSP da câmera
// e repassa ao navegador as URLs de vídeo/quadro. Assim, quando a API for para a VPS,
// o vídeo continua na rede local. Dois tipos de gateway (docs/camera-gateway.md):
//   - go2rtc (padrão): usa a API própria dele (/api/streams, /api/frame.jpeg, /api/stream.m3u8)
//   - generic: qualquer serviço que implemente /health no formato do contrato
import type { CameraStatus } from '@home-hub/shared';
import { config } from '../config.js';

type GatewayHealth = {
  ok: boolean;
  camera?: { online: boolean; name?: string };
  hls?: string | null;
  snapshot?: string | null;
};

// O quadro do go2rtc acorda a conexão RTSP; cache curto evita abrir a câmera a cada consulta
const CACHE_MS = 30_000;
// Falha fica pouco no cache: quando o gateway volta, o card se recupera rápido
const FAIL_CACHE_MS = 5_000;
let cache: { at: number; status: CameraStatus } | null = null;
// Uma falha isolada (câmera demorou num quadro) não tira o vídeo da tela: só depois de duas seguidas
let lastGood: CameraStatus | null = null;
let failures = 0;

async function go2rtcStatus(base: string, publicBase: string): Promise<CameraStatus> {
  const stream = encodeURIComponent(config.camera.stream);
  const streams = await fetch(`${base}/api/streams`, { signal: AbortSignal.timeout(3000) });
  if (!streams.ok) return { state: 'unavailable', detail: `go2rtc respondeu HTTP ${streams.status}` };
  const list = (await streams.json()) as Record<string, unknown>;
  if (!(config.camera.stream in list)) return { state: 'unavailable', detail: `Stream "${config.camera.stream}" não existe no go2rtc` };
  // Quadros vêm do stream original (<stream>_raw) quando existe: o convertido começa cinza
  // até o primeiro keyframe. Um quadro real prova que a câmera respondeu (não só o gateway).
  const still = `${config.camera.stream}_raw` in list ? encodeURIComponent(`${config.camera.stream}_raw`) : stream;
  const frame = await fetch(`${base}/api/frame.jpeg?src=${still}`, { signal: AbortSignal.timeout(10_000) });
  if (!frame.ok || !frame.headers.get('content-type')?.startsWith('image/')) {
    return { state: 'unavailable', detail: 'O gateway não conseguiu abrir a câmera (confira IP, senha RTSP e se está na mesma rede)' };
  }
  await frame.arrayBuffer();
  return {
    state: 'connected',
    name: config.camera.name,
    mp4Url: `${publicBase}${config.camera.publicUrl ? '/api' : ''}/stream.mp4?src=${stream}`,
    hlsUrl: `${publicBase}${config.camera.publicUrl ? '/api' : ''}/stream.m3u8?src=${stream}`,
    snapshotUrl: `${publicBase}${config.camera.publicUrl ? '/api' : ''}/frame.jpeg?src=${still}`,
  };
}

async function genericStatus(base: string, publicBase: string): Promise<CameraStatus> {
  const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) return { state: 'unavailable', detail: `Gateway respondeu HTTP ${res.status}` };
  const health = (await res.json()) as GatewayHealth;
  if (!health.ok || !health.camera?.online) return { state: 'unavailable', detail: 'Gateway sem sinal da câmera' };
  const abs = (p?: string | null) => (p ? (config.camera.publicUrl ? new URL(p, publicBase).toString() : `${publicBase}${p}`) : null);
  return { state: 'connected', name: health.camera.name ?? config.camera.name, hlsUrl: abs(health.hls), snapshotUrl: abs(health.snapshot) };
}

export async function getCameraStatus(): Promise<CameraStatus> {
  const base = config.camera.gatewayUrl;
  if (!base) return { state: 'not_configured' };
  if (cache && Date.now() - cache.at < (cache.status.state === 'connected' ? CACHE_MS : FAIL_CACHE_MS)) return cache.status;
  // Padrão: o vídeo passa pela API (/api/camera/proxy, exige login) e o go2rtc fica
  // acessível só no próprio PC. Com a API na VPS, CAMERA_PUBLIC_URL aponta o navegador
  // direto para o gateway na rede local, sem subir vídeo para a nuvem.
  const publicBase = config.camera.publicUrl ?? '/api/camera/proxy';
  let status: CameraStatus;
  try {
    status = config.camera.kind === 'generic' ? await genericStatus(base, publicBase) : await go2rtcStatus(base, publicBase);
  } catch {
    status = { state: 'unavailable', detail: 'Gateway da câmera inacessível' };
  }
  if (status.state === 'connected') {
    lastGood = status;
    failures = 0;
  } else if (status.state === 'unavailable' && lastGood && ++failures < 2) {
    status = lastGood;
  }
  cache = { at: Date.now(), status };
  return status;
}
