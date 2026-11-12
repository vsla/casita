import { PawPrint } from 'lucide-react';
import { AddButton } from '../../components/ui/button';
import { Card } from '../../components/ui/misc';
import { EmptyState, QueryState } from '../../components/ui/states';
import { api } from '../../lib/api';
import { relativeDateTime, timeAgo } from '../../lib/dates';
import { useApiMutation, usePets } from '../../lib/queries';
import { useOpenForm } from '../forms';
import { ACTIVITY } from './kinds';
import { PetAvatar } from './PetAvatar';

export function useMarkReminderDone() {
  return useApiMutation((id: number) => api(`/pet-activities/${id}`, { method: 'PATCH', body: { done: true } }), {
    invalidate: [['pets']],
    success: 'Feito ✓',
  });
}

export function PetsWidget() {
  const q = usePets();
  const openForm = useOpenForm();
  const done = useMarkReminderDone();

  return (
    <Card icon={<PawPrint />} title="Pets" to="/pets" leaf action={<AddButton label="Registrar rotina" onClick={() => openForm({ kind: 'petActivity' })} />}>
      <QueryState query={q} compact isEmpty={(p) => p.length === 0} empty={<EmptyState compact title="Nenhum pet cadastrado" />}>
        {(pets) => {
          const upcoming = pets
            .flatMap((p) => p.reminders.map((r) => ({ ...r, pet: p })))
            .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))
            .slice(0, 3);
          return (
            <div className="flex h-full flex-col gap-2.5">
              <div className="flex gap-3">
                {pets.slice(0, 2).map((p) => {
                  const lastMeal = p.lastByKind.feeding;
                  return (
                    <button key={p.id} onClick={() => openForm({ kind: 'petActivity', petId: p.id })} className="press flex min-w-0 flex-1 items-center gap-2.5 text-left">
                      <PetAvatar pet={p} size={50} />
                      <div className="min-w-0">
                        <div className="font-display text-lg leading-tight">{p.name}</div>
                        <div className="flex items-center gap-1 truncate text-xs text-ink-soft">
                          <span className="size-2 shrink-0 rounded-full bg-leaf" />
                          {lastMeal ? `Comeu ${timeAgo(lastMeal)}` : p.status}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto no-scrollbar">
                {upcoming.length === 0 && <li className="pt-1 text-sm text-muted">Sem lembretes pendentes.</li>}
                {upcoming.map((r) => {
                  const k = ACTIVITY[r.kind];
                  const overdue = r.scheduledAt && new Date(r.scheduledAt) < new Date();
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => done.mutate(r.id)}
                        title="Toque para marcar como feito"
                        className="press flex min-h-11 w-full items-center gap-3 rounded-xl bg-sage-wash/80 px-3 py-1.5 text-left"
                      >
                        <k.icon className="size-5 shrink-0 text-sage-deep" strokeWidth={1.6} />
                        <span className="w-[5.5rem] shrink-0 truncate font-semibold">{k.label}</span>
                        <span className={`flex-1 truncate text-sm ${overdue ? 'font-semibold text-danger' : 'text-ink-soft'}`}>
                          {r.scheduledAt ? relativeDateTime(r.scheduledAt) : ''}
                        </span>
                        {pets.length > 1 && <span className="text-xs text-muted">{r.pet.name}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        }}
      </QueryState>
    </Card>
  );
}
