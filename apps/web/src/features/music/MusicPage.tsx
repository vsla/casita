import type { SpotifyQueueItem } from '@home-hub/shared';
import { useQuery } from '@tanstack/react-query';
import { ListMusic, Moon, Music2, Speaker } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { LiveDot, PageHeader } from '../../components/ui/misc';
import { ListSkeleton } from '../../components/ui/states';
import { api } from '../../lib/api';
import { useApiMutation, useSpotify } from '../../lib/queries';
import { DeviceList, NowPlaying, Progress, Shortcuts, Transport, useSpotifyActions, VolumeSlider, type Connected } from './controls';

export function MusicPage() {
  const { data } = useSpotify();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Música"
        subtitle={data?.state === 'connected' ? <LiveDot on={data.playing} label={data.playing ? 'Tocando' : 'Pausado'} /> : 'Spotify'}
      />
      {!data ? (
        <ListSkeleton rows={3} />
      ) : data.state !== 'connected' ? (
        <section className="card p-5 text-ink-soft">
          {data.state === 'unavailable' ? data.detail : <>Spotify não conectado. Conecte em <Link to="/ajustes" className="font-semibold text-sage-deep underline">Ajustes → Integrações</Link>.</>}
        </section>
      ) : (
        <Player status={data} />
      )}
    </div>
  );
}

function Panel({ icon, title, children, className }: { icon: ReactNode; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className ?? ''}`}>
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg [&>svg]:size-5 [&>svg]:text-ink-soft">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Player({ status }: { status: Connected }) {
  const actions = useSpotifyActions(status);
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="card flex flex-col gap-5 p-6">
        <NowPlaying status={status} large />
        <Progress status={status} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Transport status={status} actions={actions} large />
          <div className="w-full max-w-xs">
            <VolumeSlider status={status} actions={actions} />
          </div>
        </div>
        {status.shortcuts.length > 0 && <Shortcuts status={status} actions={actions} className="flex-wrap" />}
      </section>

      <div className="flex flex-col gap-4">
        <Panel icon={<Speaker />} title="Tocar em">
          <DeviceList status={status} actions={actions} />
        </Panel>
        <Panel icon={<Moon />} title="Timer para pausar">
          <SleepTimer sleepAt={status.sleepAt} />
        </Panel>
      </div>

      <Panel icon={<ListMusic />} title="Próximas" className="lg:col-span-2">
        <Queue playing={status.track?.name ?? null} />
      </Panel>
    </div>
  );
}

const SLEEP_OPTIONS = [15, 30, 60, 90];

function SleepTimer({ sleepAt }: { sleepAt: string | null }) {
  const set = useApiMutation((minutes: number | null) => api('/spotify/sleep', { method: 'PUT', body: { minutes } }), {
    invalidate: [['spotify']],
    success: (_r, m) => (m ? `A música pausa em ${m} min` : 'Timer cancelado'),
  });
  const [, tick] = useState(0);
  useEffect(() => {
    if (!sleepAt) return;
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [sleepAt]);
  const left = sleepAt ? Math.max(0, Math.ceil((new Date(sleepAt).getTime() - Date.now()) / 60_000)) : 0;
  return (
    <div className="flex flex-col gap-3">
      {sleepAt ? (
        <p className="text-sm text-ink-soft">
          Pausa às <b>{new Date(sleepAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</b> (em {left} min).
        </p>
      ) : (
        <p className="text-sm text-muted">Bom para dormir ou para quando sair de casa.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {SLEEP_OPTIONS.map((m) => (
          <Button key={m} variant="outline" size="sm" loading={set.isPending && set.variables === m} onClick={() => set.mutate(m)}>
            {m < 60 ? `${m} min` : `${m / 60} h`.replace('.5', ',5')}
          </Button>
        ))}
        {sleepAt && (
          <Button variant="ghost" size="sm" onClick={() => set.mutate(null)}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}

function Queue({ playing }: { playing: string | null }) {
  // A fila muda quando a música troca: consulta de novo a cada faixa
  const { data, isLoading } = useQuery({
    queryKey: ['spotify', 'queue', playing],
    queryFn: () => api<SpotifyQueueItem[]>('/spotify/queue'),
    enabled: !!playing,
  });
  if (!playing) return <p className="text-sm text-muted">Nada tocando agora.</p>;
  if (isLoading) return <ListSkeleton rows={3} />;
  if (!data?.length) return <p className="text-sm text-muted">A fila está vazia.</p>;
  return (
    <ol className="grid gap-2 sm:grid-cols-2">
      {data.map((t, i) => (
        <li key={`${i}-${t.name}`} className="flex min-w-0 items-center gap-3 rounded-xl bg-paper-2 p-2">
          {t.image ? (
            <img src={t.image} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-paper text-ink-soft">
              <Music2 className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold">{t.name}</p>
            <p className="truncate text-sm text-ink-soft">{t.artists}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
