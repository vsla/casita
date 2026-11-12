import type {
  CalendarEvent,
  CameraStatus,
  DashboardLayout,
  Household,
  IntegrationStatus,
  Me,
  Member,
  Note,
  Pet,
  PetActivity,
  Photo,
  ShoppingItem,
  Task,
  TaskCompletion,
  SpotifyStatus,
  Weather,
} from '@home-hub/shared';
import { QueryClient, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, errorMessage } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => !(err instanceof ApiError && [401, 403, 404].includes(err.status)) && count < 2,
    },
  },
});

// Sessão expirada em qualquer chamada → volta para o login
queryClient.getQueryCache().subscribe((ev) => {
  const err = ev.query.state.error;
  if (err instanceof ApiError && err.status === 401 && ev.query.queryKey[0] !== 'me') queryClient.setQueryData(['me'], null);
});

// ---------- Leitura ----------
export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/auth/me').catch((e) => (e instanceof ApiError && e.status === 401 ? null : Promise.reject(e))),
    staleTime: Infinity,
  });
export const useHousehold = () => useQuery({ queryKey: ['household'], queryFn: () => api<Household>('/household') });
export const useMembers = () => useQuery({ queryKey: ['members'], queryFn: () => api<Member[]>('/members') });
export const useTasks = (assignee: 'all' | 'me' = 'all') =>
  useQuery({ queryKey: ['tasks', assignee], queryFn: () => api<Task[]>(`/tasks?assignee=${assignee}`) });
export const useTaskHistory = (taskId?: number) =>
  useQuery({
    queryKey: ['tasks', 'history', taskId ?? 'all'],
    queryFn: () => api<TaskCompletion[]>(`/tasks/history${taskId ? `?taskId=${taskId}` : ''}`),
  });
export const useShopping = () => useQuery({ queryKey: ['shopping'], queryFn: () => api<ShoppingItem[]>('/shopping') });
export const useShoppingSuggestions = () =>
  useQuery({
    queryKey: ['shopping', 'suggestions'],
    queryFn: () => api<{ name: string; category: ShoppingItem['category'] }[]>('/shopping/suggestions'),
  });
export const useNotes = () => useQuery({ queryKey: ['notes'], queryFn: () => api<Note[]>('/notes') });
export const usePets = () => useQuery({ queryKey: ['pets'], queryFn: () => api<Pet[]>('/pets') });
export const usePetHistory = (petId: number | undefined) =>
  useQuery({
    queryKey: ['pets', 'history', petId],
    queryFn: () => api<PetActivity[]>(`/pets/${petId}/activities`),
    enabled: !!petId,
  });
export const useCalendar = (from: Date, to: Date) =>
  useQuery({
    queryKey: ['calendar', from.toISOString(), to.toISOString()],
    queryFn: () => api<CalendarEvent[]>(`/calendar?from=${from.toISOString()}&to=${to.toISOString()}`),
    placeholderData: (prev) => prev,
  });
/** Todas as fotos (até 500): galeria e slideshow aleatório */
export const useAllPhotos = () => useQuery({ queryKey: ['photos', 'all'], queryFn: () => api<Photo[]>('/photos?limit=500') });
export const useWeather = () =>
  useQuery({ queryKey: ['weather'], queryFn: () => api<Weather | null>('/weather'), refetchInterval: 15 * 60_000, retry: false });
export const useCamera = () =>
  useQuery({
    queryKey: ['camera'],
    queryFn: () => api<CameraStatus>('/camera'),
    // sem sinal, tenta de novo logo; conectada, só confere de vez em quando
    refetchInterval: (q) => (q.state.data?.state === 'unavailable' ? 15_000 : 60_000),
  });
export const useSpotify = () =>
  useQuery({
    queryKey: ['spotify'],
    queryFn: () => api<SpotifyStatus>('/spotify'),
    // A música pode começar ou parar em outro aparelho (celular, TV) sem passar pelo painel:
    // conectado, confere a cada 5 s (a API guarda a resposta por 3 s, então várias telas não somam)
    refetchInterval: (q) => (q.state.data?.state === 'connected' ? 5_000 : 30_000),
    staleTime: 0,
  });
export const useIntegrations = () => useQuery({ queryKey: ['integrations'], queryFn: () => api<IntegrationStatus[]>('/integrations') });
export const useLayout = (device: 'panel' | 'mobile') =>
  useQuery({ queryKey: ['layout', device], queryFn: () => api<DashboardLayout>(`/layout?device=${device}`) });

// ---------- Escrita ----------
type MutateOpts<V, R> = {
  invalidate: QueryKey[];
  success?: string | ((result: R, vars: V) => string | undefined);
  /** Atualização otimista: altera a lista antes da resposta (toque responde na hora) */
  optimistic?: { key: QueryKey; update: (rows: any[], vars: V) => any[] };
};

export function useApiMutation<V, R = unknown>(fn: (vars: V) => Promise<R>, opts: MutateOpts<V, R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onMutate: async (vars) => {
      if (!opts.optimistic) return;
      const { key, update } = opts.optimistic;
      await qc.cancelQueries({ queryKey: key });
      const snapshots = qc.getQueriesData<any[]>({ queryKey: key });
      for (const [k, rows] of snapshots) if (Array.isArray(rows)) qc.setQueryData(k, update(rows, vars));
      return { snapshots };
    },
    onError: (err, _vars, ctx) => {
      ctx?.snapshots?.forEach(([k, rows]) => qc.setQueryData(k, rows));
      toast.error(errorMessage(err));
    },
    onSuccess: (result, vars) => {
      const msg = typeof opts.success === 'function' ? opts.success(result, vars) : opts.success;
      if (msg) toast.success(msg);
    },
    onSettled: () => Promise.all(opts.invalidate.map((queryKey) => qc.invalidateQueries({ queryKey }))),
  });
}
