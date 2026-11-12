// Nuvem · Open-Meteo: gratuito e sem chave. Opcional — sem internet, o card some.
import type { Weather } from '@home-hub/shared';

const CACHE_MS = 15 * 60_000;
const cache = new Map<string, { at: number; data: Weather }>();
let lastError: string | null = null;

const DESCRIPTIONS: Record<number, string> = {
  0: 'Céu limpo',
  1: 'Predominantemente limpo',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Neblina',
  48: 'Neblina',
  51: 'Garoa fraca',
  53: 'Garoa',
  55: 'Garoa forte',
  61: 'Chuva fraca',
  63: 'Chuva',
  65: 'Chuva forte',
  80: 'Pancadas de chuva',
  81: 'Pancadas de chuva',
  82: 'Temporal',
  95: 'Trovoadas',
  96: 'Trovoadas com granizo',
  99: 'Trovoadas com granizo',
};

export const weatherLastError = () => lastError;

export async function getWeather(lat: number, lon: number, timezone: string, city: string): Promise<Weather | null> {
  const key = `${lat},${lon}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=${encodeURIComponent(timezone)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { current: { temperature_2m: number; weather_code: number; is_day: number } };
    const data: Weather = {
      temperature: Math.round(json.current.temperature_2m),
      code: json.current.weather_code,
      description: DESCRIPTIONS[json.current.weather_code] ?? 'Tempo variável',
      isDay: json.current.is_day === 1,
      city,
    };
    cache.set(key, { at: Date.now(), data });
    lastError = null;
    return data;
  } catch (e) {
    lastError = (e as Error).message;
    // Mostra o último valor conhecido por até 3 h; depois, nada (não inventamos clima)
    return hit && Date.now() - hit.at < 3 * 3_600_000 ? hit.data : null;
  }
}
