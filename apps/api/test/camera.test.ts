import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// go2rtc simulado: /api/streams, quadro JPEG e playlist HLS
let gateway: Server;
let app: FastifyInstance;
let call: Awaited<ReturnType<typeof import('./helpers.js').login>>['call'];
let headers: Record<string, string>;
let cameraOnline = true;

beforeAll(async () => {
  gateway = createServer((req, res) => {
    const url = new URL(req.url!, 'http://x');
    if (url.pathname === '/api/streams') return res.end(JSON.stringify({ camera: { producers: [{ url: 'rtsp://admin:SEGREDO@cam/onvif1' }] } }));
    if (url.pathname === '/api/frame.jpeg') {
      if (!cameraOnline) return res.end(); // go2rtc devolve 200 vazio quando a câmera não responde
      res.setHeader('Content-Type', 'image/jpeg');
      return res.end(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    }
    if (url.pathname === '/api/stream.m3u8') {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.end('#EXTM3U\nhls/playlist.m3u8?id=abc\n');
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((r) => gateway.listen(0, '127.0.0.1', r));
  process.env.CAMERA_GATEWAY_URL = `http://127.0.0.1:${(gateway.address() as AddressInfo).port}`;
  const { makeApp, login } = await import('./helpers.js');
  app = await makeApp();
  ({ call, headers } = await login(app));
});

afterAll(async () => {
  await app.close();
  gateway.close();
  (await import('../src/db/index.js')).sql.end();
});

describe('câmera via go2rtc', () => {
  it('só fica "ao vivo" com um quadro real e entrega URLs pela API', async () => {
    const { body } = await call('GET', '/api/camera');
    expect(body).toEqual({
      state: 'connected',
      name: 'Câmera',
      mp4Url: '/api/camera/proxy/stream.mp4?src=camera',
      hlsUrl: '/api/camera/proxy/stream.m3u8?src=camera',
      snapshotUrl: '/api/camera/proxy/frame.jpeg?src=camera',
    });
  });

  it('proxy repassa mídia para quem está logado', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/camera/proxy/stream.m3u8?src=camera', headers });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('hls/playlist.m3u8');
    const img = await app.inject({ method: 'GET', url: '/api/camera/proxy/frame.jpeg?src=camera', headers });
    expect(img.headers['content-type']).toBe('image/jpeg');
  });

  it('proxy exige login e nunca expõe a config do go2rtc (URL RTSP com senha)', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/camera/proxy/frame.jpeg?src=camera' })).statusCode).toBe(401);
    const leak = await app.inject({ method: 'GET', url: '/api/camera/proxy/streams', headers });
    expect(leak.statusCode).toBe(404);
    expect(leak.body).not.toContain('SEGREDO');
  });

  it('câmera sem resposta vira "indisponível" só na segunda falha seguida', async () => {
    cameraOnline = false;
    const { getCameraStatus } = await import('../src/integrations/camera.js');
    // força expirar o cache
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 60_000;
      expect((await getCameraStatus()).state).toBe('connected');
      Date.now = () => realNow() + 120_000;
      expect((await getCameraStatus()).state).toBe('unavailable');
    } finally {
      Date.now = realNow;
    }
  });
});
