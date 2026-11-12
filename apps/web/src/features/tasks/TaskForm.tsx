import { describeRecurrence, type Recurrence, type Task } from '@home-hub/shared';
import { History, Repeat, Trash } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/dialog';
import { ChoiceChips, Field, Input, Select, Textarea } from '../../components/ui/form';
import { Avatar } from '../../components/ui/misc';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { isoToDate, todayISO, WEEKDAYS_SHORT } from '../../lib/dates';
import { useApiMutation, useHousehold, useMembers, usePets, useTaskHistory } from '../../lib/queries';

type Kind = 'none' | Recurrence['kind'];

export function TaskForm({ task, onDone }: { task?: Task; onDone: () => void }) {
  const { data: house } = useHousehold();
  const today = todayISO(house?.timezone);
  const { data: members = [] } = useMembers();
  const { data: pets = [] } = usePets();
  const people = members.filter((m) => m.role !== 'kiosk');

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [assigneeId, setAssigneeId] = useState<number | null>(task?.assigneeId ?? null);
  const [petId, setPetId] = useState<number | null>(task?.petId ?? null);
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const rec = task?.recurrence;
  const [kind, setKind] = useState<Kind>(rec?.kind ?? 'none');
  const [interval, setInterval] = useState(rec?.interval ?? 1);
  const [weekdays, setWeekdays] = useState<number[]>(rec?.kind === 'weekly' ? rec.weekdays : []);
  const [monthDay, setMonthDay] = useState(rec?.kind === 'monthly' ? rec.day : 0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const recurrence: Recurrence | null = (() => {
    const base = dueDate || today;
    if (kind === 'daily') return { kind, interval };
    if (kind === 'weekly') return { kind, interval, weekdays: weekdays.length ? weekdays : [isoToDate(base).getDay()] };
    if (kind === 'monthly') return { kind, interval, day: monthDay || isoToDate(base).getDate() };
    return null;
  })();

  const save = useApiMutation(
    (body: Record<string, unknown>) => (task ? api(`/tasks/${task.id}`, { method: 'PATCH', body }) : api('/tasks', { body })),
    { invalidate: [['tasks']], success: task ? 'Tarefa atualizada' : 'Tarefa criada' },
  );
  const remove = useApiMutation(() => api(`/tasks/${task!.id}`, { method: 'DELETE' }), { invalidate: [['tasks']], success: 'Tarefa excluída' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await save.mutateAsync({
      title,
      description: description || null,
      assigneeId,
      petId,
      // Recorrente sem data começa hoje
      dueDate: dueDate || (recurrence ? today : null),
      recurrence,
    });
    onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="O que precisa ser feito?">
        <Input autoFocus={!task} required maxLength={200} placeholder="Ex.: Limpar o banheiro" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <Field label="Responsável">
        <ChoiceChips
          value={assigneeId}
          onChange={setAssigneeId}
          options={[
            { value: null, label: 'Todos', icon: <Avatar name="T" color="#a59bc7" size={22} /> },
            ...people.map((m) => ({ value: m.id, label: m.displayName, icon: <Avatar name={m.displayName} color={m.color} size={22} /> })),
          ]}
        />
      </Field>

      {pets.length > 0 && (
        <Field label="Relacionada a um pet? (opcional)">
          <ChoiceChips value={petId} onChange={setPetId} options={[{ value: null, label: 'Não' }, ...pets.map((p) => ({ value: p.id, label: p.name }))]} />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={kind === 'none' ? 'Prazo (opcional)' : 'Próxima vez'}>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Repetir">
          <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="none">Não se repete</option>
            <option value="daily">Diariamente</option>
            <option value="weekly">Semanalmente</option>
            <option value="monthly">Mensalmente</option>
          </Select>
        </Field>
      </div>

      {kind !== 'none' && (
        <div className="flex flex-col gap-3 rounded-2xl bg-sage-wash/70 p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-soft">A cada</span>
            <Input
              type="number"
              min={1}
              max={kind === 'monthly' ? 12 : kind === 'weekly' ? 52 : 365}
              value={interval}
              onChange={(e) => setInterval(Math.max(1, Number(e.target.value) || 1))}
              className="h-11 w-20 text-center"
            />
            <span className="text-sm text-ink-soft">{kind === 'daily' ? 'dia(s)' : kind === 'weekly' ? 'semana(s)' : 'mês(es)'}</span>
          </div>
          {kind === 'weekly' && (
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const on = recurrence?.kind === 'weekly' && recurrence.weekdays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))}
                    className={cn('press size-11 rounded-full text-sm font-semibold', on ? 'bg-sage text-white' : 'bg-paper text-ink-soft')}
                  >
                    {WEEKDAYS_SHORT[d]!.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          )}
          {kind === 'monthly' && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-soft">No dia</span>
              <Input
                type="number"
                min={1}
                max={31}
                value={recurrence?.kind === 'monthly' ? recurrence.day : 1}
                onChange={(e) => setMonthDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                className="h-11 w-20 text-center"
              />
            </div>
          )}
          <p className="flex items-center gap-1.5 text-sm font-semibold text-sage-deep">
            <Repeat className="size-4" /> {describeRecurrence(recurrence)}
          </p>
        </div>
      )}

      <Field label="Detalhes (opcional)">
        <Textarea maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-20" />
      </Field>

      {task && <TaskHistory taskId={task.id} />}

      <div className="flex gap-2 pt-1">
        {task && (
          <Button variant="danger" size="icon" aria-label="Excluir tarefa" onClick={() => setConfirmDelete(true)}>
            <Trash />
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1" loading={save.isPending} disabled={!title.trim()}>
          {task ? 'Salvar' : 'Criar tarefa'}
        </Button>
      </div>

      {task && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Excluir tarefa?"
          description="Ela sai das listas. O histórico de conclusões continua salvo."
          loading={remove.isPending}
          onConfirm={async () => {
            await remove.mutateAsync(undefined);
            setConfirmDelete(false);
            onDone();
          }}
        />
      )}
    </form>
  );
}

function TaskHistory({ taskId }: { taskId: number }) {
  const { data = [] } = useTaskHistory(taskId);
  if (!data.length) return null;
  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
        <History className="size-4" /> Últimas conclusões
      </p>
      <ul className="flex flex-col gap-1 text-sm">
        {data.slice(0, 5).map((c) => (
          <li key={c.id} className="flex justify-between gap-2">
            <span>{c.userName ?? 'Alguém'}</span>
            <span className="text-muted">
              {new Date(c.completedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
