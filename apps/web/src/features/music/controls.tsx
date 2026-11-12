import type { SpotifyDevice, SpotifyStatus } from '@home-hub/shared';
import { Check, Laptop, ListMusic, Music2, Pause, Play, SkipBack, SkipForward, Smartphone, Speaker, Tv, Volume1, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useApiMutation } from '../../lib/queries';

export type Connected = Extract<SpotifyStatus, { state: 'connected' }>;
type Command =
  | { action: 'play'; deviceId?: string; contextUri?: string }
  | { action: 'pause' | 'next' | 'previous' }
  | { action: 'volume'; percent: number };

const DEVICE_ICON: Record<string, typeof Tv> = { TV: Tv, Smartphone, Computer: Laptop, Speaker, CastVideo: Tv, CastAudio: Speaker };
export const DeviceIcon = ({ type, className }: { type: string; className?: string }) => {
  const Icon = DEVICE_ICON[type] ?? Speaker;
  return <Icon className={className} />;
};

/** Ações do player, iguais no card e na tela completa */
export function useSpotifyActions(status: Connected) {
  const { playing, track, device, devices, tvDevice, defaultContext } = status;
  const send = useApiMutation((body: Command) => api('/spotify/command', { body }), { invalidate: [['spotify']] });
  const tv = tvDevice ? devices.find((d) => d.name === tvDevice) : undefined;

  // Já tem música (tocando ou pausada): leva para o aparelho. Senão, começa a playlist padrão.
  const playOn = (d: SpotifyDevice) => send.mutate({ action: 'play', deviceId: d.id, contextUri: track ? undefined : defaultContext?.uri });
  const playOnTv = () => (tv ? playOn(tv) : toast.error('A TV não aparece no Spotify agora. Abra o app Spotify na TV e tente de novo.'));
  const togglePlay = () => {
    if (playing) return send.mutate({ action: 'pause' });
    // Sem aparelho ativo, o Spotify não sabe onde tocar: usa a TV (ou o primeiro aparelho disponível)
    const target = device ?? tv ?? devices[0];
    if (!target) return toast.error('Nenhum aparelho com o Spotify aberto agora');
    send.mutate({ action: 'play', deviceId: device ? undefined : target.id, contextUri: track ? undefined : defaultContext?.uri });
  };
  // Atalho de playlist: toca onde já está tocando; sem aparelho ativo, na TV
  const playContext = (uri: string) => {
    const target = device ?? tv ?? devices[0];
    if (!target) return toast.error('Nenhum aparelho com o Spotify aberto agora');
    send.mutate({ action: 'play', deviceId: target.id, contextUri: uri });
  };
  return { send, tv, playOn, playOnTv, togglePlay, playContext, onTv: !!tvDevice && device?.name === tvDevice };
}

export function NowPlaying({ status, large, onDeviceClick }: { status: Connected; large?: boolean; onDeviceClick?: () => void }) {
  const { track, device, defaultContext } = status;
  const cover = large ? 'size-40 rounded-2xl sm:size-56' : 'size-14 rounded-xl';
  return (
    <div className={cn('flex min-w-0 items-center', large ? 'flex-col gap-4 text-center sm:flex-row sm:text-left' : 'gap-3')}>
      {track?.image ? (
        <img src={track.image} alt="" className={cn('shrink-0 object-cover shadow-sm', cover)} />
      ) : (
        <span className={cn('grid shrink-0 place-items-center bg-paper-2 text-ink-soft', cover)}>
          <Music2 className={large ? 'size-12' : 'size-6'} />
        </span>
      )}
      <div className="min-w-0">
        <p className={cn('truncate font-semibold', large && 'font-display text-2xl')}>{track?.name ?? 'Nada tocando'}</p>
        <p className={cn('truncate text-ink-soft', large ? 'text-lg' : 'text-sm')}>
          {track?.artists ?? (defaultContext ? `Playlist: ${defaultContext.name}` : 'Dê play para começar')}
        </p>
        {device && (
          <button
            type="button"
            onClick={onDeviceClick}
            disabled={!onDeviceClick}
            className={cn('mt-0.5 flex max-w-full items-center gap-1 truncate text-muted', large ? 'text-sm' : 'text-xs', onDeviceClick && 'press underline-offset-2 hover:underline')}
          >
            <DeviceIcon type={device.type} className="size-3.5 shrink-0" /> {device.name}
          </button>
        )}
      </div>
    </div>
  );
}

export function Progress({ status }: { status: Connected }) {
  const { track, playing } = status;
  const progress = useProgress(track?.progressMs ?? 0, track?.durationMs ?? 0, playing);
  if (!track) return null;
  return (
    <div className="h-1 overflow-hidden rounded-full bg-paper-2">
      <div className="h-full rounded-full bg-sage transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%` }} />
    </div>
  );
}

export function Transport({ status, actions, large }: { status: Connected; actions: ReturnType<typeof useSpotifyActions>; large?: boolean }) {
  const { playing, device } = status;
  const { send, togglePlay } = actions;
  return (
    <div className={cn('flex items-center', large ? 'gap-3' : 'gap-1')}>
      <Button variant="ghost" size={large ? 'icon' : 'icon-sm'} aria-label="Anterior" disabled={!device} onClick={() => send.mutate({ action: 'previous' })}>
        <SkipBack />
      </Button>
      <Button size="icon" className={cn('rounded-full', large && 'size-14 [&_svg]:size-7')} aria-label={playing ? 'Pausar' : 'Tocar'} loading={send.isPending} onClick={togglePlay}>
        {!send.isPending && (playing ? <Pause /> : <Play />)}
      </Button>
      <Button variant="ghost" size={large ? 'icon' : 'icon-sm'} aria-label="Próxima" disabled={!device} onClick={() => send.mutate({ action: 'next' })}>
        <SkipForward />
      </Button>
    </div>
  );
}

/** Volume do aparelho que está tocando. Manda só quando a pessoa para de arrastar. */
export function VolumeSlider({ status, actions }: { status: Connected; actions: ReturnType<typeof useSpotifyActions> }) {
  const remote = status.device?.volume ?? null;
  const [value, setValue] = useState(remote ?? 0);
  const dragging = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!dragging.current && remote != null) setValue(remote);
  }, [remote]);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (remote == null) return null; // aparelho sem controle de volume
  const Icon = value === 0 ? VolumeX : value < 50 ? Volume1 : Volume2;
  const change = (v: number) => {
    dragging.current = true;
    setValue(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      dragging.current = false;
      actions.send.mutate({ action: 'volume', percent: v });
    }, 350);
  };
  return (
    <label className="flex items-center gap-2 text-ink-soft">
      <Icon className="size-4 shrink-0" />
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        aria-label="Volume"
        onChange={(e) => change(Number(e.target.value))}
        className="h-6 w-full cursor-pointer accent-[var(--color-sage)]"
      />
    </label>
  );
}

export function DeviceList({ status, actions, onPicked }: { status: Connected; actions: ReturnType<typeof useSpotifyActions>; onPicked?: () => void }) {
  if (!status.devices.length) return <p className="text-sm text-muted">Nenhum aparelho com o Spotify aberto agora.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {status.devices.map((d) => (
        <li key={d.id}>
          <button
            type="button"
            onClick={() => {
              if (!d.active) actions.playOn(d);
              onPicked?.();
            }}
            className={cn('press flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', d.active ? 'bg-sage-soft text-sage-deep' : 'bg-paper-2 hover:bg-sage-wash')}
          >
            <DeviceIcon type={d.type} className="size-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {d.name}
              {d.name === status.tvDevice && <span className="ml-1.5 text-xs font-normal text-muted">(TV)</span>}
            </span>
            {d.active && <Check className="size-5 shrink-0" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function DevicePicker({ status, actions, open, onOpenChange }: { status: Connected; actions: ReturnType<typeof useSpotifyActions>; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Tocar em…" description="A música passa para o aparelho escolhido.">
      <DeviceList status={status} actions={actions} onPicked={() => onOpenChange(false)} />
    </Dialog>
  );
}

export function Shortcuts({ status, actions, className }: { status: Connected; actions: ReturnType<typeof useSpotifyActions>; className?: string }) {
  if (!status.shortcuts.length) return null;
  return (
    <div className={cn('flex gap-1.5 overflow-x-auto [scrollbar-width:none]', className)}>
      {status.shortcuts.map((s) => (
        <button
          key={s.uri}
          type="button"
          onClick={() => actions.playContext(s.uri)}
          className="press flex shrink-0 items-center gap-1 rounded-full bg-sage-wash px-3 py-1.5 text-xs font-semibold text-sage-deep hover:bg-sage-soft"
        >
          <ListMusic className="size-3.5" /> {s.name}
        </button>
      ))}
    </div>
  );
}

/** Avança a barra entre as consultas (a API só atualiza a cada poucos segundos) */
function useProgress(progressMs: number, durationMs: number, playing: boolean) {
  const [base, setBase] = useState({ ms: progressMs, at: Date.now() });
  const [, tick] = useState(0);
  useEffect(() => setBase({ ms: progressMs, at: Date.now() }), [progressMs]);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [playing]);
  if (!durationMs) return 0;
  const ms = base.ms + (playing ? Date.now() - base.at : 0);
  return Math.min(1, ms / durationMs);
}
