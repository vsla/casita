import { resolve } from 'node:path';

const env = process.env;
const root = resolve(import.meta.dirname, '../../..');

if (!env.DATABASE_URL) throw new Error('DATABASE_URL não definido (copie .env.example para .env)');

export const config = {
  port: Number(env.PORT ?? 3100),
  host: env.HOST ?? '0.0.0.0',
  production: env.NODE_ENV === 'production',
  databaseUrl: env.DATABASE_URL,
  // Origens extras permitidas (frontend servido de outro domínio). Vazio = mesma origem.
  corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  // Cookie Secure exige HTTPS; na rede local sem HTTPS, deixe COOKIE_SECURE=false
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production',
  uploadDir: resolve(root, env.UPLOAD_DIR ?? 'data/uploads'),
  webDist: resolve(root, 'apps/web/dist'),
  maxUploadMb: Number(env.MAX_UPLOAD_MB ?? 15),
  camera: {
    // Gateway local da câmera (ver docs/camera-gateway.md). Vazio = não configurado.
    gatewayUrl: env.CAMERA_GATEWAY_URL?.replace(/\/$/, '') || null,
    // URL do gateway vista pelo navegador (iPhone na rede usa o IP do PC, não "localhost")
    publicUrl: env.CAMERA_PUBLIC_URL?.replace(/\/$/, '') || null,
    kind: (env.CAMERA_GATEWAY_KIND ?? 'go2rtc') as 'go2rtc' | 'generic',
    stream: env.CAMERA_STREAM || 'camera',
    name: env.CAMERA_NAME || 'Câmera',
  },
  spotify: {
    // App criado em developer.spotify.com (ver docs/spotify.md). Só no servidor.
    clientId: env.SPOTIFY_CLIENT_ID || null,
    clientSecret: env.SPOTIFY_CLIENT_SECRET || null,
    // Precisa estar cadastrado no app do Spotify. Em http só vale 127.0.0.1 (não "localhost"),
    // então o login é feito no próprio PC onde a API roda.
    redirectUri: env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${env.PORT ?? 3100}/api/integrations/spotify/callback`,
  },
  laundry: {
    model: env.MIDEA_MODEL || null,
  },
  icloud: {
    // Senha de app gerada em appleid.apple.com — nunca vai para o frontend
    username: env.ICLOUD_USERNAME || null,
    appPassword: env.ICLOUD_APP_PASSWORD || null,
    // Opcional: nomes dos calendários a sincronizar, separados por vírgula. Vazio = escolher em Ajustes.
    calendars: (env.ICLOUD_CALENDARS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  },
};
