import type { IntegrationStatus } from '@home-hub/shared';
import { config } from '../config.js';
import { icloudConfigured } from './calendar.js';
import { getCameraStatus } from './camera.js';
import { getIntegration } from './configStore.js';
import { spotifyConfigured } from './spotify.js';
import { weatherLastError } from './weather.js';

const when = (d: Date, timeZone: string) =>
  d.toLocaleString('pt-BR', { timeZone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// Midea (lavanderia) e Alexa: apenas futuras. Sem código de dispositivo, sem status inventado.
export async function integrationStatuses(household: { id: number; weatherEnabled: boolean; latitude: number | null; timezone: string }): Promise<IntegrationStatus[]> {
  const [camera, cal, photos, spotify] = await Promise.all([
    getCameraStatus(),
    getIntegration(household.id, 'icloud_calendar'),
    getIntegration(household.id, 'icloud_photos'),
    getIntegration(household.id, 'spotify'),
  ]);
  const weatherErr = weatherLastError();
  const albumUrl = String(photos?.settings.albumUrl ?? '');

  return [
    {
      kind: 'weather',
      name: 'Clima (Open-Meteo)',
      scope: 'cloud',
      state: !household.weatherEnabled ? 'disabled' : household.latitude == null ? 'not_configured' : weatherErr ? 'unavailable' : 'connected',
      detail: weatherErr ? `Sem resposta: ${weatherErr}` : 'Gratuito, sem chave. Opcional.',
    },
    {
      kind: 'icloud_calendar',
      name: 'Calendário iCloud',
      scope: 'cloud',
      state: !icloudConfigured() ? 'not_configured' : cal?.lastError ? 'unavailable' : cal?.lastSyncAt ? 'connected' : 'not_configured',
      detail: !icloudConfigured()
        ? 'Defina ICLOUD_USERNAME e ICLOUD_APP_PASSWORD no .env do servidor.'
        : cal?.lastError
          ? cal.lastError
          : cal?.lastSyncAt
            ? `Somente leitura · sincronizado em ${when(cal.lastSyncAt, household.timezone)}`
            : 'Credenciais ok. Escolha os calendários abaixo.',
      lastSyncAt: cal?.lastSyncAt?.toISOString() ?? null,
      configurable: icloudConfigured(),
    },
    {
      kind: 'camera',
      name: config.camera.name,
      scope: 'local',
      state: camera.state,
      detail:
        camera.state === 'not_configured'
          ? 'Defina CAMERA_GATEWAY_URL (go2rtc) após ativar a Conexão NVR no app Yoosee.'
          : camera.state === 'unavailable'
            ? camera.detail
            : 'Transmissão local via gateway.',
    },
    {
      kind: 'icloud_photos',
      name: 'Fotos do iCloud (álbum compartilhado)',
      scope: 'cloud',
      state: !albumUrl || !photos?.enabled ? 'not_configured' : photos.lastError ? 'unavailable' : photos.lastSyncAt ? 'connected' : 'not_configured',
      detail: !albumUrl
        ? 'Cole o link de um álbum compartilhado com "Site Público" ativado.'
        : photos?.lastError
          ? photos.lastError
          : photos?.lastSyncAt
            ? `${photos.settings.count ?? 0} fotos de “${photos.settings.albumName ?? 'álbum'}” · ${when(photos.lastSyncAt, household.timezone)}`
            : 'Aguardando a primeira sincronização.',
      lastSyncAt: photos?.lastSyncAt?.toISOString() ?? null,
    },
    {
      kind: 'spotify',
      name: 'Spotify',
      scope: 'cloud',
      state: !spotifyConfigured() ? 'not_configured' : !spotify?.settings.refreshToken ? 'not_configured' : spotify.lastError ? 'unavailable' : 'connected',
      detail: !spotifyConfigured()
        ? 'Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env (ver docs/spotify.md).'
        : !spotify?.settings.refreshToken
          ? 'Conecte a conta abrindo os Ajustes no PC da casa.'
          : (spotify.lastError ?? `Conta: ${spotify.settings.account ?? '—'} · controle exige Premium`),
      configurable: spotifyConfigured(),
    },
    {
      kind: 'midea',
      name: config.laundry.model ? `Lavanderia Midea ${config.laundry.model}` : 'Lavanderia Midea',
      scope: 'local',
      state: 'planned',
      detail: 'Integração futura.',
    },
    { kind: 'alexa', name: 'Alexa', scope: 'cloud', state: 'planned', detail: 'Integração futura.' },
  ];
}
