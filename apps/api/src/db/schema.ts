import type { DashboardLayout, IntegrationKind, MemberRole, PetActivityKind, Recurrence, ShoppingCategory } from '@home-hub/shared';
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const tz = (name: string) => timestamp(name, { withTimezone: true });

export const households = pgTable('households', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  subtitle: text('subtitle').notNull().default(''),
  city: text('city').notNull().default(''),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  timezone: text('timezone').notNull().default('America/Recife'),
  weatherEnabled: boolean('weather_enabled').notNull().default(true),
  createdAt: createdAt(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  color: text('color').notNull().default('#6f9a85'),
  photoPath: text('photo_path'),
  createdAt: createdAt(),
});

export const householdMembers = pgTable(
  'household_members',
  {
    householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<MemberRole>().notNull().default('member'),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.userId] })],
);

export const sessions = pgTable('sessions', {
  // sha256 do token; o token em si só existe no cookie
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  userAgent: text('user_agent'),
  expiresAt: tz('expires_at').notNull(),
  createdAt: createdAt(),
});

export const pets = pgTable('pets', {
  id: serial('id').primaryKey(),
  householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  species: text('species').$type<'dog' | 'cat' | 'other'>().notNull().default('dog'),
  breed: text('breed'),
  birthDate: date('birth_date'),
  status: text('status').notNull().default('Bem'),
  notes: text('notes'),
  photoPath: text('photo_path'),
  createdAt: createdAt(),
});

export const tasks = pgTable(
  'tasks',
  {
    id: serial('id').primaryKey(),
    householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    // null = "Todos"
    assigneeId: integer('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    petId: integer('pet_id').references(() => pets.id, { onDelete: 'set null' }),
    dueDate: date('due_date'),
    recurrence: jsonb('recurrence').$type<Recurrence>(),
    // Só tarefas avulsas ficam concluídas; recorrentes são reagendadas
    completedAt: tz('completed_at'),
    lastCompletedAt: tz('last_completed_at'),
    archivedAt: tz('archived_at'),
    createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('tasks_household_idx').on(t.householdId)],
);

export const taskCompletions = pgTable(
  'task_completions',
  {
    id: serial('id').primaryKey(),
    taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    // Prazo da ocorrência concluída (para recorrentes) — permite desfazer
    dueDate: date('due_date'),
    completedAt: tz('completed_at').notNull().defaultNow(),
  },
  (t) => [index('task_completions_task_idx').on(t.taskId)],
);

export const shoppingItems = pgTable('shopping_items', {
  id: serial('id').primaryKey(),
  householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quantity: text('quantity'),
  category: text('category').$type<ShoppingCategory>().notNull().default('outros'),
  checked: boolean('checked').notNull().default(false),
  checkedAt: tz('checked_at'),
  createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
});

export const notes = pgTable('notes', {
  id: serial('id').primaryKey(),
  householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  pinned: boolean('pinned').notNull().default(false),
  expiresAt: tz('expires_at'),
  authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: tz('updated_at').notNull().defaultNow(),
});

export const petActivities = pgTable(
  'pet_activities',
  {
    id: serial('id').primaryKey(),
    petId: integer('pet_id').notNull().references(() => pets.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<PetActivityKind>().notNull(),
    notes: text('notes'),
    // scheduledAt sem doneAt = lembrete pendente
    scheduledAt: tz('scheduled_at'),
    doneAt: tz('done_at'),
    doneById: integer('done_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('pet_activities_pet_idx').on(t.petId)],
);

export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: serial('id').primaryKey(),
    householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    location: text('location'),
    startsAt: tz('starts_at').notNull(),
    endsAt: tz('ends_at'),
    allDay: boolean('all_day').notNull().default(false),
    color: text('color').notNull().default('#5fa8a0'),
    icon: text('icon'),
    // 'icloud' = cache de eventos vindos do adaptador CalDAV (somente leitura)
    source: text('source').$type<'local' | 'icloud'>().notNull().default('local'),
    externalId: text('external_id'),
    demo: boolean('demo').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index('calendar_events_range_idx').on(t.householdId, t.startsAt),
    uniqueIndex('calendar_events_external_idx').on(t.householdId, t.externalId),
  ],
);

export const photos = pgTable(
  'photos',
  {
    id: serial('id').primaryKey(),
    householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
    // Caminho relativo ao UPLOAD_DIR, ou URL pública para imagens de demonstração
    path: text('path').notNull(),
    mimeType: text('mime_type').notNull(),
    caption: text('caption'),
    demo: boolean('demo').notNull().default(false),
    // 'upload' = enviada pelo app; 'icloud' = cópia local de um álbum compartilhado
    source: text('source').$type<'upload' | 'icloud'>().notNull().default('upload'),
    externalId: text('external_id'),
    takenAt: tz('taken_at'),
    uploadedById: integer('uploaded_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('photos_external_idx').on(t.householdId, t.externalId)],
);

export const dashboardLayouts = pgTable(
  'dashboard_layouts',
  {
    id: serial('id').primaryKey(),
    householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
    // Um layout por tipo de tela: o monitor da casa e os celulares podem diferir
    device: text('device').$type<'panel' | 'mobile'>().notNull(),
    layout: jsonb('layout').$type<DashboardLayout>().notNull(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('dashboard_layouts_device_idx').on(t.householdId, t.device)],
);

// Configuração não secreta das integrações. Segredos ficam em variáveis de ambiente.
export const integrationConfigs = pgTable(
  'integration_configs',
  {
    id: serial('id').primaryKey(),
    householdId: integer('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<IntegrationKind>().notNull(),
    enabled: boolean('enabled').notNull().default(false),
    settings: jsonb('settings').$type<Record<string, string | number | boolean>>().notNull().default({}),
    lastSyncAt: tz('last_sync_at'),
    lastError: text('last_error'),
    updatedAt: tz('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('integration_configs_kind_idx').on(t.householdId, t.kind)],
);
