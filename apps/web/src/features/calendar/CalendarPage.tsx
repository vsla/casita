import type { CalendarEvent } from '@home-hub/shared';
import { CalendarClock, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Segmented } from '../../components/ui/form';
import { PageHeader } from '../../components/ui/misc';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/states';
import { cn } from '../../lib/cn';
import { addDays, capitalize, sameDay, startOfDay, startOfMonth, startOfWeek, WEEKDAYS_MIN, WEEKDAYS_SHORT } from '../../lib/dates';
import { useCalendar, useIntegrations } from '../../lib/queries';
import { useDevice } from '../../lib/useDevice';
import { useOpenForm } from '../forms';
import { EventLine, eventsOnDay } from './AgendaWidgets';

type View = 'day' | 'week' | 'month';

function range(view: View, anchor: Date) {
  if (view === 'day') return { from: startOfDay(anchor), to: addDays(startOfDay(anchor), 1) };
  if (view === 'week') return { from: startOfWeek(anchor), to: addDays(startOfWeek(anchor), 7) };
  // Mês: grade completa de semanas (inclui dias do mês anterior/seguinte)
  const from = startOfWeek(startOfMonth(anchor));
  return { from, to: addDays(from, 42) };
}

export function CalendarPage() {
  const device = useDevice();
  const [view, setView] = useState<View>(device === 'panel' ? 'week' : 'day');
  const [anchor, setAnchor] = useState(() => new Date());
  const { from, to } = useMemo(() => range(view, anchor), [view, anchor.toDateString()]);
  const q = useCalendar(from, to);
  const openForm = useOpenForm();
  const { data: integrations } = useIntegrations();
  const icloud = integrations?.find((i) => i.kind === 'icloud_calendar');

  const step = (dir: number) =>
    setAnchor((a) => (view === 'day' ? addDays(a, dir) : view === 'week' ? addDays(a, 7 * dir) : new Date(a.getFullYear(), a.getMonth() + dir, 1)));

  const label =
    view === 'day'
      ? capitalize(anchor.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))
      : view === 'week'
        ? `${from.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${addDays(to, -1).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`
        : capitalize(anchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));

  const events = q.data ?? [];
  const open = (e: CalendarEvent) => openForm({ kind: 'event', event: e });

  return (
    <div className="flex flex-col xl:h-full">
      <PageHeader
        title="Agenda"
        subtitle={
          icloud?.state === 'connected' ? 'Sincronizada com o iCloud' : 'Eventos locais · a sincronização com o iCloud ainda não está conectada'
        }
        actions={
          <Button onClick={() => openForm({ kind: 'event', date: anchor })}>
            <Plus /> Novo evento
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'day', label: 'Dia' },
            { value: 'week', label: 'Semana' },
            { value: 'month', label: 'Mês' },
          ]}
        />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Anterior" onClick={() => step(-1)}>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Próximo" onClick={() => step(1)}>
            <ChevronRight />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            Hoje
          </Button>
        </div>
        <h2 className="font-display text-xl">{label}</h2>
      </div>

      <motion.div key={`${view}-${from.toISOString()}`} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.24 }} className="min-h-0 flex-1">
        {q.isPending ? (
          <div className="card p-5">
            <ListSkeleton />
          </div>
        ) : q.isError ? (
          <div className="card">
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          </div>
        ) : view === 'day' ? (
          <DayView day={anchor} events={events} onOpen={open} />
        ) : view === 'week' ? (
          <WeekView from={from} events={events} onOpen={open} onDay={(d) => openForm({ kind: 'event', date: d })} />
        ) : (
          <MonthView
            anchor={anchor}
            from={from}
            events={events}
            onDay={(d) => {
              setAnchor(d);
              setView('day');
            }}
          />
        )}
      </motion.div>
    </div>
  );
}

function DayView({ day, events, onOpen }: { day: Date; events: CalendarEvent[]; onOpen: (e: CalendarEvent) => void }) {
  const list = eventsOnDay(events, day);
  return (
    <div className="card mx-auto max-w-2xl p-5">
      {list.length === 0 ? (
        <EmptyState icon={<CalendarClock strokeWidth={1.4} />} title="Nada marcado" hint="Toque em “Novo evento” para adicionar." />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((e) => (
            <li key={e.id}>
              <EventLine event={e} onClick={() => onOpen(e)} />
              {(e.location || e.description) && <p className="mt-1 ml-[4.4rem] text-sm text-muted">{[e.location, e.description].filter(Boolean).join(' · ')}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WeekView({ from, events, onOpen, onDay }: { from: Date; events: CalendarEvent[]; onOpen: (e: CalendarEvent) => void; onDay: (d: Date) => void }) {
  const today = new Date();
  return (
    <div className="grid gap-3 md:grid-cols-7 xl:h-full">
      {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => {
        const list = eventsOnDay(events, d);
        const isToday = sameDay(d, today);
        return (
          <section key={d.toISOString()} className={cn('card flex min-h-0 flex-col p-3', isToday && 'ring-2 ring-sage/50')}>
            <button onClick={() => onDay(d)} className="press mb-2 flex items-baseline gap-1.5 text-left" aria-label={`Adicionar evento em ${d.toLocaleDateString('pt-BR')}`}>
              <span className={cn('text-sm font-bold', isToday ? 'text-sage-deep' : 'text-muted')}>{WEEKDAYS_SHORT[d.getDay()]}</span>
              <span className="font-display text-2xl">{d.getDate()}</span>
            </button>
            <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto no-scrollbar">
              {list.length === 0 && <li className="text-xs text-muted md:pt-1">—</li>}
              {list.map((e) => (
                <li key={e.id}>
                  <button onClick={() => onOpen(e)} className="press w-full rounded-lg px-2 py-1.5 text-left text-sm" style={{ background: `${e.color}22` }}>
                    <span className="block text-xs font-bold" style={{ color: e.color }}>
                      {e.allDay ? 'Dia inteiro' : new Date(e.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="line-clamp-2">{e.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function MonthView({ anchor, from, events, onDay }: { anchor: Date; from: Date; events: CalendarEvent[]; onDay: (d: Date) => void }) {
  const today = new Date();
  return (
    <div className="card p-3 xl:flex xl:h-full xl:flex-col">
      <div className="grid grid-cols-7 pb-1 text-center text-xs font-bold text-muted">
        {[1, 2, 3, 4, 5, 6, 0].map((d, i) => (
          <span key={i}>
            <span className="sm:hidden">{WEEKDAYS_MIN[d]}</span>
            <span className="max-sm:hidden">{WEEKDAYS_SHORT[d]}</span>
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 xl:flex-1 xl:grid-rows-6">
        {Array.from({ length: 42 }, (_, i) => addDays(from, i)).map((d) => {
          const list = eventsOnDay(events, d);
          const other = d.getMonth() !== anchor.getMonth();
          return (
            <button
              key={d.toISOString()}
              onClick={() => onDay(d)}
              className={cn(
                'press flex min-h-14 flex-col items-start gap-0.5 overflow-hidden rounded-xl p-1.5 text-left sm:min-h-20',
                other ? 'opacity-40' : 'bg-paper-2/60',
                sameDay(d, today) && 'bg-sage-soft',
              )}
            >
              <span className={cn('text-sm font-bold', sameDay(d, today) && 'text-sage-deep')}>{d.getDate()}</span>
              {/* Celular: pontos coloridos. Painel: títulos */}
              <span className="flex flex-wrap gap-0.5 sm:hidden">
                {list.slice(0, 4).map((e) => (
                  <span key={e.id} className="size-1.5 rounded-full" style={{ background: e.color }} />
                ))}
              </span>
              <span className="flex w-full flex-col gap-0.5 max-sm:hidden">
                {list.slice(0, 2).map((e) => (
                  <span key={e.id} className="truncate rounded px-1 text-[11px]" style={{ background: `${e.color}26` }}>
                    {e.title}
                  </span>
                ))}
                {list.length > 2 && <span className="text-[11px] text-muted">+{list.length - 2}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
