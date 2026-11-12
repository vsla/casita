import { CircleCheck, PartyPopper } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { AddButton } from '../../components/ui/button';
import { Card } from '../../components/ui/misc';
import { EmptyState, QueryState } from '../../components/ui/states';
import { todayISO } from '../../lib/dates';
import { useHousehold, useMembers, usePets, useTasks } from '../../lib/queries';
import { useOpenForm } from '../forms';
import { TaskRow } from './TaskRow';
import { useCompleteTask } from './useTaskActions';

/** Responsabilidades: o que vence até hoje primeiro, depois o restante da semana */
export function TasksWidget() {
  const q = useTasks();
  const { data: members = [] } = useMembers();
  const { data: pets = [] } = usePets();
  const openForm = useOpenForm();
  const toggle = useCompleteTask();
  const { data: house } = useHousehold();
  const today = todayISO(house?.timezone);

  return (
    <Card icon={<CircleCheck />} title="Responsabilidades" to="/tarefas" action={<AddButton label="Nova tarefa" onClick={() => openForm({ kind: 'task' })} />}>
      <QueryState
        query={q}
        compact
        isEmpty={(rows) => rows.length === 0}
        empty={<EmptyState compact icon={<PartyPopper strokeWidth={1.4} />} title="Tudo em dia" hint="Nenhuma tarefa pendente." />}
      >
        {(rows) => {
          const ordered = [...rows].sort((a, b) => Number(!!a.completedAt) - Number(!!b.completedAt));
          const urgent = ordered.filter((t) => !t.completedAt && t.dueDate && t.dueDate <= today).length;
          return (
            <div className="flex h-full flex-col">
              {urgent > 0 && <p className="-mt-1 mb-1 text-xs font-semibold text-sage-deep">{urgent} para hoje</p>}
              <ul className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
                <AnimatePresence initial={false}>
                  {ordered.map((t) => (
                    <TaskRow key={t.id} dense task={t} members={members} pets={pets} onToggle={() => toggle(t)} onOpen={() => openForm({ kind: 'task', task: t })} />
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          );
        }}
      </QueryState>
    </Card>
  );
}
