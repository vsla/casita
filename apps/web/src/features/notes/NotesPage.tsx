import { Clock, MessageSquare, Pin, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '../../components/ui/button';
import { PageHeader } from '../../components/ui/misc';
import { EmptyState, QueryState } from '../../components/ui/states';
import { relativeDateTime, timeAgo } from '../../lib/dates';
import { useNotes } from '../../lib/queries';
import { useOpenForm } from '../forms';

/** Lista textual simples — sem post-its */
export function NotesPage() {
  const q = useNotes();
  const openForm = useOpenForm();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Recados"
        subtitle="Bilhetes para a casa. Os com validade somem sozinhos."
        actions={
          <Button onClick={() => openForm({ kind: 'note' })}>
            <Plus /> Novo recado
          </Button>
        }
      />
      <QueryState query={q} isEmpty={(r) => r.length === 0} empty={<EmptyState icon={<MessageSquare strokeWidth={1.4} />} title="Nenhum recado" />}>
        {(rows) => (
          <ul className="card divide-y divide-line/70">
            <AnimatePresence initial={false}>
              {rows.map((n) => (
                <motion.li key={n.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
                  <button onClick={() => openForm({ kind: 'note', note: n })} className="press w-full px-5 py-4 text-left">
                    <p className="font-display text-lg leading-snug whitespace-pre-line">{n.body}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                      <span>
                        {n.authorName ?? 'Alguém'} · {timeAgo(n.createdAt)}
                      </span>
                      {n.pinned && (
                        <span className="flex items-center gap-1 font-semibold text-sage-deep">
                          <Pin className="size-3.5" /> Fixado
                        </span>
                      )}
                      {n.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" /> Some {relativeDateTime(n.expiresAt).toLowerCase()}
                        </span>
                      )}
                    </p>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </QueryState>
    </div>
  );
}
