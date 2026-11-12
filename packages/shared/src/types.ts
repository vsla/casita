// Formatos de resposta da API (datas chegam como string ISO no JSON).
import type { MemberRole, PetActivityKind, ShoppingCategory } from './schemas.ts';
import type { Recurrence } from './recurrence.ts';

export type Me = {
  id: number;
  username: string;
  displayName: string;
  color: string;
  role: MemberRole;
  householdId: number;
};

export type Member = { id: number; username: string; displayName: string; color: string; role: MemberRole; photoUrl: string | null };

export type Household = {
  id: number;
  name: string;
  subtitle: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  weatherEnabled: boolean;
};

export type Task = {
  id: number;
  title: string;
  description: string | null;
  assigneeId: number | null;
  petId: number | null;
  dueDate: string | null;
  recurrence: Recurrence | null;
  /** Só para tarefas não recorrentes: recorrentes nunca ficam "concluídas", são reagendadas */
  completedAt: string | null;
  lastCompletedAt: string | null;
  createdAt: string;
};

export type TaskCompletion = {
  id: number;
  taskId: number;
  taskTitle: string;
  userId: number | null;
  userName: string | null;
  dueDate: string | null;
  completedAt: string;
};

export type ShoppingItem = {
  id: number;
  name: string;
  quantity: string | null;
  category: ShoppingCategory;
  checked: boolean;
  checkedAt: string | null;
  createdAt: string;
};

export type Note = {
  id: number;
  body: string;
  pinned: boolean;
  expiresAt: string | null;
  authorId: number | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PetActivity = {
  id: number;
  petId: number;
  kind: PetActivityKind;
  notes: string | null;
  scheduledAt: string | null;
  doneAt: string | null;
  doneByName: string | null;
  createdAt: string;
};

export type Pet = {
  id: number;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed: string | null;
  birthDate: string | null;
  status: string;
  notes: string | null;
  photoUrl: string | null;
  reminders: PetActivity[];
  lastByKind: Partial<Record<PetActivityKind, string>>;
};

export type CalendarEvent = {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  color: string;
  icon: string | null;
  source: 'local' | 'icloud';
  demo: boolean;
};

export type Photo = { id: number; url: string; caption: string | null; demo: boolean; source: 'upload' | 'icloud'; createdAt: string };

export type Weather = { temperature: number; code: number; description: string; isDay: boolean; city: string };

export type CameraStatus =
  | { state: 'not_configured' }
  | { state: 'unavailable'; detail: string }
  | {
      state: 'connected';
      name: string;
      /** MP4 contínuo (Chromium/Android) */
      mp4Url?: string | null;
      /** HLS (Safari/iPhone) */
      hlsUrl: string | null;
      snapshotUrl: string | null;
    };

/** Eventos do Socket.IO */
export type RealtimeEntity = 'tasks' | 'shopping' | 'notes' | 'pets' | 'calendar' | 'photos' | 'household' | 'members' | 'layout' | 'spotify';

export type SpotifyDevice = { id: string; name: string; type: string; active: boolean; volume: number | null };
export type SpotifyStatus =
  | { state: 'not_configured' }
  | { state: 'disconnected' }
  | { state: 'unavailable'; detail: string }
  | {
      state: 'connected';
      playing: boolean;
      /** Aparelho onde está tocando agora (celular, PC, TV…) */
      device: SpotifyDevice | null;
      track: { name: string; artists: string; image: string | null; durationMs: number; progressMs: number } | null;
      devices: SpotifyDevice[];
      /** Nome do aparelho escolhido como TV em Ajustes */
      tvDevice: string | null;
      defaultContext: { uri: string; name: string } | null;
      shortcuts: { uri: string; name: string }[];
      /** Quando a música vai pausar sozinha (timer), em ISO */
      sleepAt: string | null;
    };
export type SpotifyQueueItem = { name: string; artists: string; image: string | null };
