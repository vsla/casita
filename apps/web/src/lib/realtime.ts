import type { RealtimeEntity } from '@home-hub/shared';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from './api';
import { queryClient } from './queries';

// Algumas mudanças afetam mais de uma consulta
const KEYS: Record<RealtimeEntity, string[]> = {
  tasks: ['tasks'],
  shopping: ['shopping'],
  notes: ['notes'],
  pets: ['pets'],
  calendar: ['calendar'],
  photos: ['photos'],
  spotify: ['spotify'],
  household: ['household', 'weather', 'integrations'],
  members: ['members', 'me'],
  layout: ['layout'],
};

/** Conecta enquanto houver sessão; cada "changed" invalida as consultas daquela entidade. */
export function useRealtime(enabled: boolean) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (!enabled) return;
    const socket = io(API_URL || undefined, { withCredentials: true });
    let wasDisconnected = false;
    socket.on('changed', ({ entity }: { entity: RealtimeEntity }) => {
      for (const key of KEYS[entity] ?? [entity]) queryClient.invalidateQueries({ queryKey: [key] });
    });
    socket.on('connect', () => {
      setOnline(true);
      // Ao reconectar (PC acordou, Wi-Fi voltou), recarrega tudo que pode ter mudado
      if (wasDisconnected) queryClient.invalidateQueries();
    });
    socket.on('disconnect', () => {
      wasDisconnected = true;
      setOnline(false);
    });
    socket.on('connect_error', () => setOnline(false));
    return () => {
      socket.disconnect();
    };
  }, [enabled]);
  return online;
}
