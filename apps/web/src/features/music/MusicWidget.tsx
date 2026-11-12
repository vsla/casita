import { Loader2, Moon, Music2, Speaker, Tv } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { Card, LiveDot, StatusPill } from '../../components/ui/misc';
import { cn } from '../../lib/cn';
import { useSpotify } from '../../lib/queries';
import { DevicePicker, NowPlaying, Progress, Shortcuts, Transport, useSpotifyActions, VolumeSlider, type Connected } from './controls';

/**
 * Música da casa pelo Spotify: mostra o que toca em qualquer aparelho da conta (celular, PC, TV)
 * e controla play/pausa/pular, volume, onde tocar e atalhos de playlists. A tela /musica tem o resto.
 */
export function MusicWidget() {
  const { data } = useSpotify();
  const connected = data?.state === 'connected';
  return (
    <Card
      icon={<Music2 />}
      title="Música"
      to="/musica"
      action={
        connected && (
          <span className="flex items-center gap-2">
            {data.sleepAt && <Moon className="size-4 text-ink-soft" aria-label="Timer para pausar ligado" />}
            <LiveDot on={data.playing} label={data.playing ? 'Tocando' : 'Pausado'} />
          </span>
        )
      }
      bodyClassName="flex flex-col"
    >
      {!data ? (
        <Loader2 className="m-auto size-6 animate-spin text-ink-soft" />
      ) : data.state === 'connected' ? (
        <Player status={data} />
      ) : (
        <div className="flex flex-col items-start gap-2">
          <StatusPill>{data.state === 'unavailable' ? 'Spotify sem resposta' : 'Spotify não conectado'}</StatusPill>
          <p className="text-sm text-muted">
            {data.state === 'unavailable' ? data.detail : <>Conecte a conta em <Link to="/ajustes" className="font-semibold text-sage-deep underline">Ajustes → Integrações</Link>.</>}
          </p>
        </div>
      )}
    </Card>
  );
}

function Player({ status }: { status: Connected }) {
  const actions = useSpotifyActions(status);
  const [picker, setPicker] = useState(false);
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between gap-2 overflow-hidden">
      <NowPlaying status={status} onDeviceClick={() => setPicker(true)} />
      <Progress status={status} />
      <div className="flex items-center gap-1">
        <Transport status={status} actions={actions} />
        <span className="ml-auto flex items-center gap-1">
          {status.tvDevice && !actions.onTv && (
            <Button variant="secondary" size="sm" className={cn(!actions.tv && 'opacity-60')} onClick={actions.playOnTv}>
              <Tv /> Na TV
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" aria-label="Escolher aparelho" onClick={() => setPicker(true)}>
            <Speaker />
          </Button>
        </span>
      </div>
      <VolumeSlider status={status} actions={actions} />
      <Shortcuts status={status} actions={actions} />
      <DevicePicker status={status} actions={actions} open={picker} onOpenChange={setPicker} />
    </div>
  );
}
