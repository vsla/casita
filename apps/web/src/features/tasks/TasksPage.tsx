import { addDaysISO, type Task } from '@home-hub/shared';
import { History, PartyPopper, Plus } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Segmented } from '../../components/ui/form';
import { PageHeader } from '../../components/ui/misc';
import { EmptyState, QueryState } from '../../components/ui/states';
import { todayISO } from '../../lib/dates';
import { useHousehold, useMembers, useMe, usePets, useTaskHistory, useTasks } from '../../lib/queries';
import { useOpenForm } from '../forms';
import { TaskRow } from './TaskRow';
import { useCompleteTask } from './useTaskActions';

function group(tasks: Task[], today: ReturnType<typeof todayISO>) {
  const week = addDaysISO(today, 7);
  const groups: { title: string; items: Task[] }[] = [
    { title: 'Atrasadas', items: [] },
    { title: 'Hoje', items: [] },
    { title: 'Próximos 7 dias', items: [] },
    { title: 'Mais adiante', items: [] },
    { title: 'Sem prazo', items: [] },
    { title: 'Concluídas recentemente', items: [] },
  ];
  for (const t of tasks) {
    const g = t.completedAt ? 5 : !t.dueDate ? 4 : t.dueDate < today ? 0 : t.dueDate === today ? 1 : t.dueDate <= week ? 2 : 3;
    groups[g]!.items.push(t);
  }
  return groups.filter((g) => g.items.length);
}

export function TasksPage() {
  const { data: me } = useMe();
  const { data: house } = useHousehold();
  const [view, setView] = useState<'open' | 'history'>('open');
  // No celular, cada um costuma querer ver primeiro as próprias tarefas
  const [who, setWho] = useState<'all' | 'me'>('all');
  const q = useTasks(who);
  const { data: members = [] } = useMembers();
  const { data: pets = [] } = usePets();
  const openForm = useOpenForm();
  const toggle = useCompleteTask();
  const isPerson = me?.role !== 'kiosk';

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Tarefas"
        subtitle="Responsabilidades da casa, com recorrência e histórico"
        actions={
          <Button onClick={() => openForm({ kind: 'task' })}>
            <Plus /> Nova tarefa
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'open', label: 'Pendentes' },
            { value: 'history', label: 'Histórico' },
          ]}
        />
        {view === 'open' && isPerson && (
          <Segmented
            value={who}
            onChange={setWho}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'me', label: 'Minhas' },
            ]}
          />
        )}
      </div>

      {view === 'open' ? (
        <QueryState
          query={q}
          isEmpty={(r) => r.length === 0}
          empty={<EmptyState icon={<PartyPopper strokeWidth={1.4} />} title="Nada pendente" hint="Crie tarefas recorrentes para a rotina da casa." />}
        >
          {(rows) => (
            <div className="flex flex-col gap-4">
              {group(rows, todayISO(house?.timezone)).map((g) => (
                <section key={g.title} className="card px-5 py-2">
                  <h2 className={`pt-2 text-sm font-bold tracking-wide uppercase ${g.title === 'Atrasadas' ? 'text-danger' : 'text-muted'}`}>
                    {g.title} · {g.items.length}
                  </h2>
                  <ul>
                    <AnimatePresence initial={false}>
                      {g.items.map((t) => (
                        <TaskRow key={t.id} task={t} members={members} pets={pets} onToggle={() => toggle(t)} onOpen={() => openForm({ kind: 'task', task: t })} />
                      ))}
                    </AnimatePresence>
                  </ul>
                </section>
              ))}
            </div>
          )}
        </QueryState>
      ) : (
        <HistoryList />
      )}
    </div>
  );
}

function HistoryList() {
  const q = useTaskHistory();
  return (
    <QueryState query={q} isEmpty={(r) => r.length === 0} empty={<EmptyState icon={<History strokeWidth={1.4} />} title="Nenhuma conclusão ainda" />}>
      {(rows) => (
        <ul className="card divide-y divide-line/70 px-5">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{c.taskTitle}</p>
                <p className="text-sm text-muted">por {c.userName ?? 'alguém'}</p>
              </div>
              <time className="shrink-0 text-sm text-ink-soft">
                {new Date(c.completedAt).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </time>
            </li>
          ))}
        </ul>
      )}
    </QueryState>
  );
}
