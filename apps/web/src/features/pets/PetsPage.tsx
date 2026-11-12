import type { Pet } from '@home-hub/shared';
import { BellPlus, Check, PawPrint, Pencil, Trash } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Badge, PageHeader } from '../../components/ui/misc';
import { EmptyState, ListSkeleton, QueryState } from '../../components/ui/states';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { relativeDateTime, timeAgo } from '../../lib/dates';
import { useApiMutation, usePetHistory, usePets } from '../../lib/queries';
import { useOpenForm } from '../forms';
import { ACTIVITY, QUICK_KINDS } from './kinds';
import { PetAvatar } from './PetAvatar';
import { useMarkReminderDone } from './PetsWidget';

function age(birth: string | null) {
  if (!birth) return null;
  const months = Math.floor((Date.now() - new Date(birth).getTime()) / (30.44 * 86_400_000));
  return months < 24 ? `${months} meses` : `${Math.floor(months / 12)} anos`;
}

export function PetsPage() {
  const q = usePets();
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Pets" subtitle="Rotina, treinamento e cuidados" />
      <QueryState query={q} isEmpty={(p) => p.length === 0} empty={<EmptyState icon={<PawPrint strokeWidth={1.4} />} title="Nenhum pet cadastrado" />}>
        {(pets) => {
          const pet = pets.find((p) => p.id === selected) ?? pets[0]!;
          return (
            <>
              <div className="mb-4 flex gap-2">
                {pets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={cn(
                      'press flex h-14 items-center gap-2.5 rounded-full border pr-5 pl-1.5 font-display text-lg',
                      p.id === pet.id ? 'border-sage bg-sage-soft' : 'border-line bg-paper',
                    )}
                  >
                    <PetAvatar pet={p} size={44} /> {p.name}
                  </button>
                ))}
              </div>
              <PetDetail pet={pet} />
            </>
          );
        }}
      </QueryState>
    </div>
  );
}

function PetDetail({ pet }: { pet: Pet }) {
  const openForm = useOpenForm();
  const done = useMarkReminderDone();
  const history = usePetHistory(pet.id);
  const log = useApiMutation(
    (kind: string) => api(`/pets/${pet.id}/activities`, { body: { kind, done: true } }),
    { invalidate: [['pets']], success: (_r, k) => `${ACTIVITY[k as keyof typeof ACTIVITY].label} de ${pet.name} registrado` },
  );
  const removeActivity = useApiMutation((id: number) => api(`/pet-activities/${id}`, { method: 'DELETE' }), {
    invalidate: [['pets']],
    success: 'Registro removido',
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col gap-4">
        <section className="card flex items-center gap-4 p-5">
          <PetAvatar pet={pet} size={88} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl">{pet.name}</h2>
            <p className="text-ink-soft">{[pet.breed, age(pet.birthDate)].filter(Boolean).join(' · ') || 'Sem raça/idade cadastrada'}</p>
            <Badge tone="sage" className="mt-1.5">
              {pet.status}
            </Badge>
            {pet.notes && <p className="mt-2 text-sm text-ink-soft">{pet.notes}</p>}
          </div>
          <Button variant="ghost" size="icon" aria-label={`Editar ${pet.name}`} onClick={() => openForm({ kind: 'pet', pet })}>
            <Pencil />
          </Button>
        </section>

        {/* Um toque registra; o horário é o de agora */}
        <section className="card p-5">
          <h3 className="mb-3 font-display text-lg">Registrar agora</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUICK_KINDS.map((k) => {
              const A = ACTIVITY[k];
              const last = pet.lastByKind[k];
              return (
                <button
                  key={k}
                  onClick={() => log.mutate(k)}
                  disabled={log.isPending}
                  className="press flex flex-col items-center gap-1 rounded-2xl bg-sage-wash px-2 py-4 text-center disabled:opacity-60"
                >
                  <A.icon className="size-7 text-sage-deep" strokeWidth={1.6} />
                  <span className="font-semibold">{A.label}</span>
                  <span className="text-xs text-muted">{last ? timeAgo(last) : 'nunca'}</span>
                </button>
              );
            })}
          </div>
          <Button variant="outline" className="mt-3 w-full" onClick={() => openForm({ kind: 'petActivity', petId: pet.id })}>
            <BellPlus /> Outra atividade ou lembrete
          </Button>
        </section>

        <section className="card p-5">
          <h3 className="mb-2 font-display text-lg">Lembretes</h3>
          {pet.reminders.length === 0 ? (
            <p className="text-sm text-muted">Nenhum lembrete pendente.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pet.reminders.map((r) => {
                const A = ACTIVITY[r.kind];
                const overdue = r.scheduledAt && new Date(r.scheduledAt) < new Date();
                return (
                  <li key={r.id} className="flex items-center gap-3 rounded-xl bg-paper-2 px-3 py-2">
                    <A.icon className="size-5 text-sage-deep" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{A.label}</p>
                      <p className={cn('text-sm', overdue ? 'font-semibold text-danger' : 'text-muted')}>
                        {r.scheduledAt && relativeDateTime(r.scheduledAt)}
                        {r.notes && ` · ${r.notes}`}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => done.mutate(r.id)}>
                      <Check /> Feito
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="card p-5">
        <h3 className="mb-2 font-display text-lg">Histórico</h3>
        {history.isPending ? (
          <ListSkeleton />
        ) : !history.data?.length ? (
          <p className="text-sm text-muted">Nada registrado ainda.</p>
        ) : (
          <ul className="divide-y divide-line/70">
            {history.data.map((a) => {
              const A = ACTIVITY[a.kind];
              return (
                <li key={a.id} className="group flex items-center gap-3 py-2.5">
                  <A.icon className="size-5 shrink-0 text-ink-soft" strokeWidth={1.6} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {A.label}
                      {a.notes && <span className="font-normal text-ink-soft"> · {a.notes}</span>}
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(a.doneAt!).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      {a.doneByName && ` · ${a.doneByName}`}
                    </p>
                  </div>
                  <Button size="icon-sm" variant="ghost" aria-label="Remover registro" onClick={() => removeActivity.mutate(a.id)}>
                    <Trash />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
