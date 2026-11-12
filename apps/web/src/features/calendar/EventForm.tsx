import type { CalendarEvent } from '@home-hub/shared';
import { Trash } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/dialog';
import { Field, Input, Switch, Textarea } from '../../components/ui/form';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { dateToISO, hhmm } from '../../lib/dates';
import { useApiMutation } from '../../lib/queries';
import { EVENT_ICONS } from './icons';

const COLORS = ['#5fa8a0', '#6f9a85', '#7bb36e', '#d9925b', '#a78bc9', '#c97a7a'];

export function EventForm({ event, date, onDone }: { event?: CalendarEvent; date?: Date; onDone: () => void }) {
  const start = event ? new Date(event.startsAt) : (date ?? new Date());
  const [title, setTitle] = useState(event?.title ?? '');
  const [day, setDay] = useState(dateToISO(start));
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [from, setFrom] = useState(event ? hhmm(start) : '19:00');
  const [to, setTo] = useState(event?.endsAt ? hhmm(event.endsAt) : '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [color, setColor] = useState(event?.color ?? COLORS[0]!);
  const [icon, setIcon] = useState<string | null>(event?.icon ?? null);
  const [confirm, setConfirm] = useState(false);

  const save = useApiMutation(
    (body: Record<string, unknown>) => (event ? api(`/calendar/${event.id}`, { method: 'PATCH', body }) : api('/calendar', { body })),
    { invalidate: [['calendar']], success: event ? 'Evento atualizado' : 'Evento criado' },
  );
  const remove = useApiMutation(() => api(`/calendar/${event!.id}`, { method: 'DELETE' }), { invalidate: [['calendar']], success: 'Evento excluído' });

  const readOnly = event?.source === 'icloud';

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const startsAt = new Date(`${day}T${allDay ? '00:00' : from}:00`);
        const endsAt = !allDay && to ? new Date(`${day}T${to}:00`) : null;
        await save.mutateAsync({ title, startsAt, endsAt, allDay, location: location || null, description: description || null, color, icon });
        onDone();
      }}
    >
      {readOnly && <p className="rounded-xl bg-teal-soft p-3 text-sm">Este evento vem do iCloud. Para alterar, use o Calendário do iPhone.</p>}
      <Field label="Título">
        <Input autoFocus={!event} required disabled={readOnly} maxLength={120} placeholder="Ex.: Vôlei" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dia" className="col-span-2 sm:col-span-1">
          <Input type="date" required disabled={readOnly} value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <div className="col-span-2 flex items-end sm:col-span-1">
          <div className="flex h-12 w-full items-center justify-between rounded-xl bg-paper-2 px-4">
            <span className="text-sm font-semibold">Dia inteiro</span>
            <Switch checked={allDay} onChange={setAllDay} label="Dia inteiro" disabled={readOnly} />
          </div>
        </div>
        {!allDay && (
          <>
            <Field label="Início">
              <Input type="time" required disabled={readOnly} value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Fim (opcional)">
              <Input type="time" disabled={readOnly} value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </>
        )}
      </div>
      <Field label="Local (opcional)">
        <Input disabled={readOnly} maxLength={120} value={location} onChange={(e) => setLocation(e.target.value)} />
      </Field>
      {!readOnly && (
        <>
          <Field label="Cor e ícone">
            <div className="flex flex-wrap items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Cor ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cn('press size-9 rounded-full ring-offset-2 ring-offset-paper', color === c && 'ring-2 ring-ink-soft')}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(EVENT_ICONS).map(([key, Icon]) => (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  aria-pressed={icon === key}
                  onClick={() => setIcon(icon === key ? null : key)}
                  className={cn('press grid size-11 place-items-center rounded-xl', icon === key ? 'bg-sage text-white' : 'bg-paper-2 text-ink-soft')}
                >
                  <Icon className="size-5" />
                </button>
              ))}
            </div>
          </Field>
          <Field label="Observações (opcional)">
            <Textarea maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-20" />
          </Field>
        </>
      )}
      {!readOnly && (
        <div className="flex gap-2">
          {event && (
            <Button variant="danger" size="icon" aria-label="Excluir evento" onClick={() => setConfirm(true)}>
              <Trash />
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1" loading={save.isPending} disabled={!title.trim()}>
            {event ? 'Salvar' : 'Adicionar à agenda'}
          </Button>
        </div>
      )}
      {event && (
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Excluir evento?"
          description={event.title}
          loading={remove.isPending}
          onConfirm={async () => {
            await remove.mutateAsync(undefined);
            setConfirm(false);
            onDone();
          }}
        />
      )}
    </form>
  );
}
