import type { Task } from '@home-hub/shared';
import { describeRecurrence } from '@home-hub/shared';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { isoToDate } from '../../lib/dates';
import { useApiMutation } from '../../lib/queries';

/** Concluir com resposta imediata no toque e "Desfazer" no aviso (toques acidentais no painel) */
export function useCompleteTask() {
  const undo = useApiMutation((id: number) => api<Task>(`/tasks/${id}/complete`, { body: { undo: true } }), {
    invalidate: [['tasks']],
    success: 'Conclusão desfeita',
  });

  const complete = useApiMutation((t: Task) => api<Task>(`/tasks/${t.id}/complete`, { body: {} }), {
    invalidate: [['tasks']],
    optimistic: {
      key: ['tasks'],
      // Avulsa: marca na hora. Recorrente: o servidor devolve o novo prazo.
      update: (rows: Task[], t) => rows.map((r) => (r.id === t.id && !t.recurrence ? { ...r, completedAt: new Date().toISOString() } : r)),
    },
    success: (updated, t) => {
      const next = t.recurrence && updated.dueDate ? isoToDate(updated.dueDate).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }) : null;
      toast.success(next ? `"${t.title}" feita · próxima: ${next}` : `"${t.title}" concluída`, {
        description: t.recurrence ? describeRecurrence(t.recurrence) : undefined,
        action: { label: 'Desfazer', onClick: () => undo.mutate(t.id) },
      });
      return undefined;
    },
  });

  return (t: Task) => (t.completedAt ? undo.mutate(t.id) : complete.mutate(t));
}
