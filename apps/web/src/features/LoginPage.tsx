import { useQueryClient } from '@tanstack/react-query';
import type { Me } from '@home-hub/shared';
import { useState } from 'react';
import { HouseHeart, Landscape } from '../components/layout/illustrations';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/form';
import { api, errorMessage } from '../lib/api';

export function LoginPage() {
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <form
        className="card relative w-full max-w-sm animate-in overflow-hidden p-8 pt-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const me = await api<Me>('/auth/login', { body: { username, password } });
            qc.setQueryData(['me'], me);
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Landscape className="pointer-events-none absolute inset-x-0 top-0 h-24 w-full opacity-70" aria-hidden />
        <div className="relative mb-6 flex flex-col items-center pt-10 text-center">
          <HouseHeart className="size-14 text-sage-deep" />
          <h1 className="mt-2 font-display text-3xl font-semibold">Casita</h1>
          <p className="text-sm text-ink-soft">Entre para ver o painel da família</p>
        </div>
        <div className="relative flex flex-col gap-3">
          <Input autoComplete="username" autoCapitalize="none" placeholder="Usuário" aria-label="Usuário" value={username} onChange={(e) => setUsername(e.target.value)} />
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="Senha"
            aria-label="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" loading={busy} disabled={!username || !password}>
            Entrar
          </Button>
        </div>
      </form>
    </div>
  );
}
