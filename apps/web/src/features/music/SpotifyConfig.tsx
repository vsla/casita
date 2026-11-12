import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Field, Select } from '../../components/ui/form';
import { ListSkeleton } from '../../components/ui/states';
import { api, errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useApiMutation, useSpotify } from '../../lib/queries';

type Account = { connected: boolean; account: string | null; tvDevice: string | null; defaultContext: Playlist | null; shortcuts: Playlist[] };
type Playlist = { uri: string; name: string };

/** Ajustes → Integrações → Spotify: conectar a conta, escolher a TV e a playlist padrão */
export function SpotifyConfig() {
  const [acc, setAcc] = useState<Account | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [tv, setTv] = useState('');
  const [context, setContext] = useState('');
  const [shortcuts, setShortcuts] = useState<Playlist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { data: status } = useSpotify();

  const load = () =>
    api<Account>('/integrations/spotify').then((a) => {
      setAcc(a);
      setTv(a.tvDevice ?? '');
      setContext(a.defaultContext?.uri ?? '');
      setShortcuts(a.shortcuts);
      if (a.connected) api<Playlist[]>('/integrations/spotify/playlists').then(setPlaylists, (e) => setError(errorMessage(e)));
    }, (e) => setError(errorMessage(e)));
  useEffect(() => {
    load();
  }, []);

  const save = useApiMutation(
    () =>
      api('/integrations/spotify', {
        method: 'PUT',
        body: {
          tvDevice: tv || null,
          defaultContext: context ? { uri: context, name: playlists.find((p) => p.uri === context)?.name ?? acc?.defaultContext?.name ?? '' } : null,
          shortcuts,
        },
      }),
    { invalidate: [['spotify'], ['integrations']], success: 'Preferências do Spotify salvas' },
  );
  const disconnect = useApiMutation(() => api('/integrations/spotify', { method: 'DELETE' }), {
    invalidate: [['spotify'], ['integrations']],
    success: 'Spotify desconectado',
  });

  if (error) return <p className="mt-2 text-sm text-danger">{error}</p>;
  if (!acc) return <ListSkeleton rows={1} />;

  if (!acc.connected) {
    return (
      <div className="mt-3 flex flex-col items-start gap-2">
        <Button
          onClick={async () => {
            const { url } = await api<{ url: string }>('/integrations/spotify/login', { body: {} });
            window.open(url, '_blank');
          }}
        >
          Conectar Spotify
        </Button>
        <p className="text-xs text-muted">
          Faça isso no PC da casa (onde o servidor roda): o Spotify volta para 127.0.0.1. Depois, recarregue esta página.
        </p>
      </div>
    );
  }

  // Aparelhos que o Spotify vê agora + a TV já escolhida (mesmo desligada)
  const deviceNames = [...new Set([...(status?.state === 'connected' ? status.devices.map((d) => d.name) : []), ...(acc.tvDevice ? [acc.tvDevice] : [])])];

  return (
    <div className="mt-3 flex flex-col gap-3">
      <Field label="Qual aparelho é a TV?" hint="Abra o Spotify na TV uma vez para ela aparecer na lista.">
        <Select value={tv} onChange={(e) => setTv(e.target.value)}>
          <option value="">Nenhum</option>
          {deviceNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Playlist padrão" hint="Toca quando não há nada para continuar.">
        <Select value={context} onChange={(e) => setContext(e.target.value)}>
          <option value="">Nenhuma</option>
          {acc.defaultContext && !playlists.some((p) => p.uri === acc.defaultContext!.uri) && (
            <option value={acc.defaultContext.uri}>{acc.defaultContext.name}</option>
          )}
          {playlists.map((p) => (
            <option key={p.uri} value={p.uri}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-ink-soft">Atalhos no card (até 4)</p>
        <div className="flex flex-wrap gap-1.5">
          {playlists.map((p) => {
            const on = shortcuts.some((s) => s.uri === p.uri);
            return (
              <button
                key={p.uri}
                type="button"
                aria-pressed={on}
                disabled={!on && shortcuts.length >= 4}
                onClick={() => setShortcuts((list) => (on ? list.filter((s) => s.uri !== p.uri) : [...list, p]))}
                className={cn('press rounded-full border px-3 py-1.5 text-sm font-semibold disabled:opacity-40', on ? 'border-sage bg-sage-soft text-sage-deep' : 'border-line bg-white/60')}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button loading={save.isPending} onClick={() => save.mutate(undefined)}>
          Salvar
        </Button>
        <Button variant="ghost" loading={disconnect.isPending} onClick={() => disconnect.mutateAsync(undefined).then(load)}>
          Desconectar
        </Button>
      </div>
    </div>
  );
}
