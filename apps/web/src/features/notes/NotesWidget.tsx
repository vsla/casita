import { MessageSquare, Pin } from 'lucide-react';
import { AddButton } from '../../components/ui/button';
import { Card } from '../../components/ui/misc';
import { EmptyState, QueryState } from '../../components/ui/states';
import { timeAgo } from '../../lib/dates';
import { useNotes } from '../../lib/queries';
import { useOpenForm } from '../forms';

/** Card de texto limpo: o recado principal em destaque, os demais como lista simples */
export function NotesWidget() {
  const q = useNotes();
  const openForm = useOpenForm();
  return (
    <Card icon={<MessageSquare />} title="Recados" to="/recados" action={<AddButton label="Novo recado" onClick={() => openForm({ kind: 'note' })} />}>
      <QueryState
        query={q}
        compact
        isEmpty={(rows) => rows.length === 0}
        empty={<EmptyState compact title="Nenhum recado" hint="Deixe um bilhete para a casa." />}
      >
        {([first, ...rest]) => (
          <div className="flex h-full flex-col">
            <button onClick={() => openForm({ kind: 'note', note: first })} className="press text-left">
              <p className="line-clamp-3 font-display text-[1.18rem] leading-snug text-ink italic">{first!.body}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                {first!.pinned && <Pin className="size-3 text-sage-deep" />}— {first!.authorName ?? 'Alguém'}, {timeAgo(first!.createdAt)}
              </p>
            </button>
            <ul className="mt-2 min-h-0 flex-1 overflow-y-auto no-scrollbar">
              {rest.map((n) => (
                <li key={n.id} className="border-t border-line/70">
                  <button onClick={() => openForm({ kind: 'note', note: n })} className="press flex w-full items-center gap-1.5 py-2 text-left text-sm text-ink-soft">
                    {n.pinned && <Pin className="size-3 shrink-0 text-sage-deep" />}
                    <span className="truncate">{n.body}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </QueryState>
    </Card>
  );
}
