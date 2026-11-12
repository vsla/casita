import { z } from 'zod';
import { recurrenceSchema } from './recurrence.ts';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (AAAA-MM-DD)');
const text = (max: number) => z.string().trim().min(1, 'Obrigatório').max(max);

// ---------- Auth / usuários ----------
export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

export const memberRoles = ['admin', 'member', 'kiosk'] as const;
export type MemberRole = (typeof memberRoles)[number];

export const userCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{2,32}$/, 'Use letras minúsculas, números, ponto ou traço'),
  displayName: text(40),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
  role: z.enum(memberRoles).default('member'),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#6f9a85'),
});

export const userUpdateSchema = z.object({
  displayName: text(40).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  role: z.enum(memberRoles).optional(),
  password: z.string().min(6, 'Mínimo de 6 caracteres').optional(),
});

// ---------- Casa ----------
export const householdUpdateSchema = z.object({
  name: text(60).optional(),
  subtitle: z.string().trim().max(120).optional(),
  city: z.string().trim().max(60).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  timezone: z.string().trim().min(1).max(60).refine((timezone) => {
    try {
      new Intl.DateTimeFormat('pt-BR', { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }, 'Use um fuso válido, como America/Sao_Paulo').optional(),
  weatherEnabled: z.boolean().optional(),
});

// ---------- Tarefas ----------
export const taskCreateSchema = z.object({
  title: text(200),
  description: z.string().trim().max(1000).nullable().optional(),
  assigneeId: z.number().int().nullable().optional(), // null = "Todos"
  petId: z.number().int().nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  recurrence: recurrenceSchema.nullable().optional(),
});
export const taskUpdateSchema = taskCreateSchema.partial();
export const taskCompleteSchema = z.object({ undo: z.boolean().optional() });

// ---------- Compras ----------
export const shoppingCategories = [
  'hortifruti',
  'padaria',
  'acougue',
  'laticinios',
  'mercearia',
  'bebidas',
  'limpeza',
  'higiene',
  'pets',
  'outros',
] as const;
export type ShoppingCategory = (typeof shoppingCategories)[number];
export const shoppingCategoryLabels: Record<ShoppingCategory, string> = {
  hortifruti: 'Hortifrúti',
  padaria: 'Padaria',
  acougue: 'Açougue e peixaria',
  laticinios: 'Frios e laticínios',
  mercearia: 'Mercearia',
  bebidas: 'Bebidas',
  limpeza: 'Limpeza',
  higiene: 'Higiene',
  pets: 'Pets',
  outros: 'Outros',
};

export const shoppingCreateSchema = z.object({
  name: text(100),
  quantity: z.string().trim().max(30).nullable().optional(),
  category: z.enum(shoppingCategories).default('outros'),
});
export const shoppingUpdateSchema = shoppingCreateSchema.partial().extend({ checked: z.boolean().optional() });

// ---------- Recados ----------
export const noteCreateSchema = z.object({
  body: text(500),
  pinned: z.boolean().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});
export const noteUpdateSchema = noteCreateSchema.partial();

// ---------- Pets ----------
export const petSpecies = ['dog', 'cat', 'other'] as const;
export const petUpdateSchema = z.object({
  name: text(40).optional(),
  species: z.enum(petSpecies).optional(),
  breed: z.string().trim().max(60).nullable().optional(),
  birthDate: isoDate.nullable().optional(),
  status: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
export const petCreateSchema = petUpdateSchema.extend({ name: text(40), species: z.enum(petSpecies).default('dog') });

export const petActivityKinds = ['walk', 'feeding', 'care', 'training', 'bath', 'medication', 'vaccine', 'vet'] as const;
export type PetActivityKind = (typeof petActivityKinds)[number];
export const petActivityLabels: Record<PetActivityKind, string> = {
  walk: 'Passeio',
  feeding: 'Alimentação',
  care: 'Cuidados',
  training: 'Treino',
  bath: 'Banho',
  medication: 'Remédio',
  vaccine: 'Vacina',
  vet: 'Veterinário',
};

/** scheduledAt sem doneAt = lembrete; doneAt preenchido = registro no histórico */
export const petActivityCreateSchema = z.object({
  kind: z.enum(petActivityKinds),
  notes: z.string().trim().max(500).nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  done: z.boolean().default(true),
});
export const petActivityUpdateSchema = z.object({
  notes: z.string().trim().max(500).nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  done: z.boolean().optional(),
});

// ---------- Agenda ----------
export const calendarEventCreateSchema = z
  .object({
    title: text(120),
    description: z.string().trim().max(1000).nullable().optional(),
    location: z.string().trim().max(120).nullable().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().nullable().optional(),
    allDay: z.boolean().default(false),
    color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#5fa8a0'),
    icon: z.string().max(30).nullable().optional(),
  })
  .refine((e) => !e.endsAt || e.endsAt >= e.startsAt, { message: 'O fim deve ser depois do início', path: ['endsAt'] });
export const calendarEventUpdateSchema = z.object({
  title: text(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  allDay: z.boolean().optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  icon: z.string().max(30).nullable().optional(),
});
export const calendarRangeSchema = z.object({ from: z.coerce.date(), to: z.coerce.date() });

// ---------- Fotos ----------
export const photoUpdateSchema = z.object({ caption: z.string().trim().max(200).nullable() });

// ---------- Dashboard ----------
export const widgetIds = ['agenda', 'tasks', 'shopping', 'notes', 'pets', 'camera', 'photos', 'music', 'laundry'] as const;
export type WidgetId = (typeof widgetIds)[number];
export const widgetLabels: Record<WidgetId, string> = {
  agenda: 'Agenda',
  tasks: 'Responsabilidades',
  shopping: 'Compras',
  notes: 'Recados',
  pets: 'Pets',
  camera: 'Câmera',
  photos: 'Momentos',
  music: 'Música',
  laundry: 'Lavanderia',
};
export const layoutPresets = ['balanced', 'agenda', 'pets', 'custom'] as const;
export type LayoutPreset = (typeof layoutPresets)[number];
export const layoutPresetLabels: Record<LayoutPreset, string> = {
  balanced: 'Equilibrado',
  agenda: 'Agenda primeiro',
  pets: 'Pets primeiro',
  custom: 'Personalizado',
};
const isWidgetId = (id: string): id is WidgetId => (widgetIds as readonly string[]).includes(id);
export const widgetSizeSchema = z.object({ col: z.number().int().min(1).max(2), row: z.number().int().min(1).max(3) });
export type WidgetSize = z.infer<typeof widgetSizeSchema>;
export const dashboardLayoutSchema = z.object({
  preset: z.enum(layoutPresets),
  // Ids desconhecidos (widgets removidos em versões anteriores) são descartados
  hidden: z.array(z.string()).transform((ids) => ids.filter(isWidgetId)),
  // Layout "Personalizado", montado à mão no painel: ordem dos cards e tamanho de cada um
  custom: z
    .object({
      order: z.array(z.string()).transform((ids) => ids.filter(isWidgetId)),
      sizes: z.record(z.string(), widgetSizeSchema).transform((r) => Object.fromEntries(Object.entries(r).filter(([id]) => isWidgetId(id))) as Partial<Record<WidgetId, WidgetSize>>),
    })
    .optional(),
});
export type DashboardLayout = z.infer<typeof dashboardLayoutSchema>;

// ---------- Spotify ----------
export const spotifyPlaySchema = z.object({
  // Aparelho onde tocar (ex.: a TV). Sem ele, continua no aparelho atual.
  deviceId: z.string().max(100).optional(),
  // Playlist/álbum para começar (spotify:playlist:…). Sem ele, retoma o que estava tocando.
  contextUri: z.string().regex(/^spotify:[a-z]+:[A-Za-z0-9]+$/).optional(),
});
const spotifyContextSchema = z.object({ uri: z.string().regex(/^spotify:[a-z]+:[A-Za-z0-9]+$/), name: z.string().max(200) });
export const spotifySettingsSchema = z.object({
  tvDevice: z.string().trim().max(100).nullable(),
  defaultContext: spotifyContextSchema.nullable(),
  // Atalhos no card: até 4 playlists favoritas
  shortcuts: z.array(spotifyContextSchema).max(4).default([]),
});
// Timer para pausar: minutos a partir de agora, ou null para cancelar
export const spotifySleepSchema = z.object({ minutes: z.number().int().min(1).max(240).nullable() });

// ---------- Integrações ----------
export const integrationKinds = ['weather', 'icloud_calendar', 'camera', 'icloud_photos', 'spotify', 'midea', 'alexa'] as const;
export type IntegrationKind = (typeof integrationKinds)[number];
/**
 * connected      — funcionando com dados reais
 * not_configured — falta configuração (credenciais/endereço)
 * unavailable    — configurado mas inacessível agora
 * planned        — integração futura, ainda sem implementação
 * disabled       — desligada pela casa
 */
export type IntegrationState = 'connected' | 'not_configured' | 'unavailable' | 'planned' | 'disabled';
export type IntegrationStatus = {
  kind: IntegrationKind;
  name: string;
  scope: 'local' | 'cloud';
  state: IntegrationState;
  detail: string;
  lastSyncAt?: string | null;
  /** Há opções para escolher em Ajustes (ex.: calendários) */
  configurable?: boolean;
};
