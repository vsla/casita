import type { CalendarEvent } from '@home-hub/shared';
import { CalendarDays, ChevronLeft, ChevronRight, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { AddButton } from '../../components/ui/button';
import { Card } from '../../components/ui/misc';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/states';
import { cn } from '../../lib/cn';
import { addDays, capitalize, hhmm, sameDay, startOfDay, startOfWeek, WEEKDAYS_SHORT } from '../../lib/dates';
import { useCalendar } from '../../lib/queries';
import { useOpenForm } from '../forms';
import { EVENT_ICONS } from './icons';

/** Eventos que tocam o dia (inclui os que começaram antes e terminam nele) */
export const eventsOnDay = (events: CalendarEvent[], day: Date) => {
  const d0 = startOfDay(day);
  const d1 = addDays(d0, 1);
  return events.filter((e) => {
    const s = new Date(e.startsAt);
    const end = e.endsAt ? new Date(e.endsAt) : s;
    return s < d1 && end >= d0;
  });
};

export function EventLine({ event, onClick, showDay }: { event: CalendarEvent; onClick?: () => void; showDay?: boolean }) {
  const past = new Date(event.endsAt ?? event.startsAt).getTime() < Date.now() && !event.allDay;
  const Icon = event.icon ? EVENT_ICONS[event.icon] : undefined;
  const start = new Date(event.startsAt);
  return (
    <button onClick={onClick} className={cn('press flex min-h-11 w-full items-center gap-3 rounded-xl bg-sage-wash/80 px-3 py-1.5 text-left', past && 'opacity-55')}>
      {showDay && <span className="w-9 shrink-0 text-xs font-bold text-muted uppercase">{WEEKDAYS_SHORT[start.getDay()]}</span>}
      <span className="w-12 shrink-0 text-sm font-bold tabular-nums">{event.allDay ? 'Dia' : hhmm(start)}</span>
      <span className="size-2 shrink-0 rounded-full" style={{ background: event.color }} />
      <span className={cn('min-w-0 flex-1 truncate', past && 'line-through')}>{event.title}</span>
      {Icon && <Icon className="size-4 shrink-0 text-ink-soft" />}
    </button>
  );
}

/**
 * Agenda num card só: faixa da semana no topo (toque num dia, setas ou deslize
 * para trocar de semana), compromissos do dia escolhido e os próximos na sequência.
 */
export function AgendaWidget() {
  const today = new Date();
  const [selected, setSelected] = useState(() => startOfDay(today));
  const [dir, setDir] = useState(0);
  const openForm = useOpenForm();

  const weekStart = startOfWeek(selected);
  const key = weekStart.toDateString();
  // Duas semanas: a visível + a seguinte, para a lista "Próximos"
  const from = useMemo(() => weekStart, [key]);
  const to = useMemo(() => addDays(weekStart, 14), [key]);
  const q = useCalendar(from, to);
  const events = q.data ?? [];

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayEvents = eventsOnDay(events, selected);
  const upcoming = events.filter((e) => new Date(e.startsAt) >= addDays(selected, 1)).slice(0, 4);

  const moveWeek = (n: number) => {
    setDir(n);
    setSelected((s) => addDays(s, 7 * n));
  };
  const isToday = sameDay(selected, today);
  const label = isToday ? 'Hoje' : capitalize(selected.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }));

  return (
    <Card icon={<CalendarDays />} title="Agenda" to="/agenda" leaf action={<AddButton label="Novo evento" onClick={() => openForm({ kind: 'event', date: selected })} />}>
      <div className="flex h-full flex-col gap-3">
        {/* Faixa da semana */}
        <div className="flex items-center gap-1">
          <button onClick={() => moveWeek(-1)} aria-label="Semana anterior" className="press grid size-10 max-sm:hidden shrink-0 place-items-center rounded-full text-ink-soft hover:bg-paper-2">
            <ChevronLeft className="size-5" />
          </button>
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.div
                key={key}
                custom={dir}
                initial={{ x: dir * 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: dir * -60, opacity: 0 }}
                transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.25}
                onDragEnd={(_e, info) => (info.offset.x < -50 ? moveWeek(1) : info.offset.x > 50 && moveWeek(-1))}
                className="grid grid-cols-7 gap-1"
              >
                {days.map((d) => {
                  const list = eventsOnDay(events, d);
                  const first = list[0];
                  const Icon = first?.icon ? EVENT_ICONS[first.icon] : undefined;
                  const isSel = sameDay(d, selected);
                  const isTd = sameDay(d, today);
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => {
                        setDir(0);
                        setSelected(startOfDay(d));
                      }}
                      aria-pressed={isSel}
                      aria-label={`${d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric' })}: ${list.length} evento(s)`}
                      className={cn(
                        'press flex flex-col items-center gap-0.5 rounded-2xl py-2 text-sm transition-colors duration-200',
                        isSel ? 'bg-sage text-white shadow' : 'bg-paper-2/70 text-ink-soft',
                      )}
                    >
                      <span className={cn('text-xs', isTd && !isSel && 'font-bold text-sage-deep')}>{WEEKDAYS_SHORT[d.getDay()]}</span>
                      <span className="text-base font-bold">{d.getDate()}</span>
                      <span className="grid h-6 place-items-center">
                        {Icon ? (
                          <Icon className={cn('size-5', !isSel && 'text-sage-deep')} strokeWidth={1.6} />
                        ) : first ? (
                          <span className="size-1.5 rounded-full" style={{ background: isSel ? '#fff' : first.color }} />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
          <button onClick={() => moveWeek(1)} aria-label="Próxima semana" className="press grid size-10 max-sm:hidden shrink-0 place-items-center rounded-full text-ink-soft hover:bg-paper-2">
            <ChevronRight className="size-5" />
          </button>
        </div>

        {/* Dia escolhido + próximos */}
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
          {q.isPending ? (
            <ListSkeleton rows={3} />
          ) : q.isError ? (
            <ErrorState compact error={q.error} onRetry={() => q.refetch()} />
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={selected.toDateString()} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <h3 className="font-display text-lg">{label}</h3>
                  {!isToday && (
                    <button onClick={() => setSelected(startOfDay(today))} className="press text-sm font-semibold text-sage-deep">
                      Voltar para hoje
                    </button>
                  )}
                </div>
                {dayEvents.length === 0 ? (
                  <EmptyState compact icon={<Sun strokeWidth={1.4} />} title="Dia livre" />
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {dayEvents.map((e) => (
                      <li key={e.id}>
                        <EventLine event={e} onClick={() => openForm({ kind: 'event', event: e })} />
                      </li>
                    ))}
                  </ul>
                )}
                {upcoming.length > 0 && (
                  <>
                    <h3 className="mt-3 mb-1.5 text-xs font-bold tracking-wide text-muted uppercase">Próximos</h3>
                    <ul className="flex flex-col gap-1.5">
                      {upcoming.map((e) => (
                        <li key={e.id}>
                          <EventLine showDay event={e} onClick={() => openForm({ kind: 'event', event: e })} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </Card>
  );
}
