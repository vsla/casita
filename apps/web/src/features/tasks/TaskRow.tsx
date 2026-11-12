import type { Member, Pet, Task } from '@home-hub/shared';
import { PawPrint, Repeat, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { Checkbox } from '../../components/ui/form';
import { Avatar } from '../../components/ui/misc';
import { cn } from '../../lib/cn';
import { dueLabel } from '../../lib/dates';
import { useHousehold } from '../../lib/queries';

export function Assignee({ task, members, pets, size = 28 }: { task: Task; members: Member[]; pets: Pet[]; size?: number }) {
  const pet = pets.find((p) => p.id === task.petId);
  const user = members.find((m) => m.id === task.assigneeId);
  if (user) return <Avatar name={user.displayName} color={user.color} size={size} />;
  if (pet)
    return (
      <span className="grid shrink-0 place-items-center rounded-full bg-sage-soft text-sage-deep" style={{ width: size, height: size }}>
        <PawPrint className="size-4" />
      </span>
    );
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-[#e8e3f1] text-[#7d6fa6]" style={{ width: size, height: size }}>
      <Users className="size-4" />
    </span>
  );
}

export const assigneeName = (task: Task, members: Member[]) => members.find((m) => m.id === task.assigneeId)?.displayName ?? 'Todos';

const toneClass = { overdue: 'text-danger font-semibold', today: 'text-sage-deep font-semibold', soon: 'text-ink-soft', later: 'text-muted', none: 'text-muted' };

export function TaskRow({
  task,
  members,
  pets,
  onToggle,
  onOpen,
  dense,
}: {
  task: Task;
  members: Member[];
  pets: Pet[];
  onToggle: () => void;
  onOpen: () => void;
  dense?: boolean;
}) {
  const done = !!task.completedAt;
  const { data: house } = useHousehold();
  const due = dueLabel(task.dueDate, house?.timezone);
  const pet = pets.find((p) => p.id === task.petId);
  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22 }}
      className="border-b border-line/70 last:border-0"
    >
      <div className={cn('flex items-center gap-3', dense ? 'py-1.5' : 'py-3')}>
        <Assignee task={task} members={members} pets={pets} size={dense ? 28 : 34} />
        <button onClick={onOpen} className="press min-w-0 flex-1 text-left">
          <span className={cn('block truncate', dense ? 'text-[0.95rem]' : 'text-base font-semibold', done && 'text-muted line-through')}>{task.title}</span>
          <span className="flex items-center gap-1.5 truncate text-xs text-muted">
            <span className="font-semibold text-ink-soft">{pet ? pet.name : assigneeName(task, members)}</span>
            {task.dueDate && (
              <>
                · <span className={toneClass[due.tone]}>{due.text}</span>
              </>
            )}
            {task.recurrence && <Repeat className="size-3.5 shrink-0" aria-label="Recorrente" />}
          </span>
        </button>
        <Checkbox checked={done} label={done ? `Desfazer: ${task.title}` : `Concluir: ${task.title}`} onChange={onToggle} size={dense ? 'md' : 'lg'} />
      </div>
    </motion.li>
  );
}
