import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Moon, Sun, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { capitalize } from '../../lib/dates';
import { useHousehold, useWeather } from '../../lib/queries';
import { HouseHeart } from './illustrations';
import { LivingLandscape } from './LivingLandscape';
import { QuickAdd } from './QuickAdd';

function weatherIcon(code: number, isDay: boolean) {
  if (code <= 1) return isDay ? Sun : Moon;
  if (code === 2) return CloudSun;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if (code >= 95) return CloudLightning;
  if (code >= 61) return CloudRain;
  return Cloud;
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function greeting(h: number) {
  if (h < 5) return 'Boa noite';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function Header({ online }: { online: boolean }) {
  const { data: house } = useHousehold();
  const { data: weather } = useWeather();
  const now = useNow();
  const WIcon = weather ? weatherIcon(weather.code, weather.isDay) : null;
  const timeZone = house?.timezone;
  const date = capitalize(now.toLocaleDateString('pt-BR', { timeZone, weekday: 'long', day: 'numeric', month: 'long' }));
  const time = now.toLocaleTimeString('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const [hours = 0, minutes = 0] = time.split(':').map(Number);

  return (
    <header className="relative flex items-center gap-3 px-1 pt-1 pb-3 md:gap-4 md:px-3">
      {
        <LivingLandscape weather={weather} hour={hours + minutes / 60} className="pointer-events-none absolute inset-x-[20%] bottom-0 h-full w-[60%] opacity-90 max-xl:hidden" aria-hidden />
      }
      <HouseHeart className="relative size-11 shrink-0 text-sage-deep md:size-14 xl:size-16" />
      <div className="relative min-w-0 flex-1">
        <h1 className="truncate font-display text-2xl font-semibold tracking-tight md:text-3xl xl:text-[2.6rem] xl:leading-tight">
          {house?.name ?? 'Casita'}
        </h1>
        <p className="truncate text-sm text-ink-soft md:text-base">
          <span className="xl:hidden">{greeting(hours)}! </span>
          <span className="max-xl:hidden">{house?.subtitle}</span>
          <span className="xl:hidden">{date}</span>
        </p>
      </div>
      {!online && (
        <span className="relative flex items-center gap-1.5 rounded-full bg-clay-soft px-3 py-1.5 text-xs font-semibold text-[#9a5a2e]" role="status">
          <WifiOff className="size-3.5" /> <span className="max-sm:hidden">Reconectando…</span>
        </span>
      )}
      {weather && WIcon && (
        <>
          <div className="relative flex items-center gap-2.5 max-md:hidden" title={weather.city}>
            <WIcon className="size-10 text-[#e0a45e] xl:size-11" strokeWidth={1.4} />
            <div>
              <div className="text-2xl font-light xl:text-3xl">{weather.temperature}°C</div>
              <div className="text-xs text-ink-soft">{weather.description}</div>
            </div>
          </div>
          <div className="relative h-12 w-px bg-line max-md:hidden" />
        </>
      )}
      <div className="relative text-right">
        <div className="text-2xl font-semibold tabular-nums md:text-3xl xl:text-[2.6rem] xl:leading-tight">
          {time}
        </div>
        <div className="text-sm text-ink-soft max-xl:hidden">{date}</div>
        {weather && <div className="text-xs text-ink-soft md:hidden">{weather.temperature}°C</div>}
      </div>
      <QuickAdd />
    </header>
  );
}
