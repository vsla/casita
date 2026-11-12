import type { CalendarEvent, Note, Pet, PetActivityKind, ShoppingItem, Task } from '@home-hub/shared';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Dialog } from '../components/ui/dialog';
import { EventForm } from './calendar/EventForm';
import { NoteForm } from './notes/NoteForm';
import { ActivityForm, PetForm } from './pets/PetForms';
import { PhotoUploadForm } from './photos/PhotoUploadForm';
import { ShoppingForm } from './shopping/ShoppingForm';
import { TaskForm } from './tasks/TaskForm';

// Um único diálogo de formulário para o app inteiro: widgets, telas e o botão "+"
// abrem o mesmo formulário, então criar/editar se comporta igual em todo lugar.
export type FormRequest =
  | { kind: 'task'; task?: Task }
  | { kind: 'shopping'; item?: ShoppingItem }
  | { kind: 'note'; note?: Note }
  | { kind: 'event'; event?: CalendarEvent; date?: Date }
  | { kind: 'petActivity'; petId?: number; activity?: PetActivityKind }
  | { kind: 'pet'; pet: Pet }
  | { kind: 'photo' };

const Ctx = createContext<(req: FormRequest) => void>(() => {});
export const useOpenForm = () => useContext(Ctx);

function titleFor(req: FormRequest) {
  switch (req.kind) {
    case 'task':
      return req.task ? 'Editar tarefa' : 'Nova tarefa';
    case 'shopping':
      return req.item ? 'Editar item' : 'Adicionar às compras';
    case 'note':
      return req.note ? 'Editar recado' : 'Novo recado';
    case 'event':
      return req.event ? 'Evento' : 'Novo evento';
    case 'petActivity':
      return 'Rotina dos pets';
    case 'pet':
      return `Cadastro de ${req.pet.name}`;
    case 'photo':
      return 'Enviar fotos';
  }
}

export function FormsProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<FormRequest | null>(null);
  const [open, setOpen] = useState(false);
  const openForm = useCallback((r: FormRequest) => {
    setReq(r);
    setOpen(true);
  }, []);
  const close = () => setOpen(false);

  const body = useMemo(() => {
    if (!req) return null;
    switch (req.kind) {
      case 'task':
        return <TaskForm task={req.task} onDone={close} />;
      case 'shopping':
        return <ShoppingForm item={req.item} onDone={close} />;
      case 'note':
        return <NoteForm note={req.note} onDone={close} />;
      case 'event':
        return <EventForm event={req.event} date={req.date} onDone={close} />;
      case 'petActivity':
        return <ActivityForm petId={req.petId} kind={req.activity} onDone={close} />;
      case 'pet':
        return <PetForm pet={req.pet} onDone={close} />;
      case 'photo':
        return <PhotoUploadForm onDone={close} />;
    }
  }, [req]);

  return (
    <Ctx.Provider value={openForm}>
      {children}
      {req && (
        <Dialog open={open} onOpenChange={setOpen} title={titleFor(req)}>
          {/* key: remonta o formulário a cada abertura, sem estado residual */}
          <div key={JSON.stringify(req, (_k, v) => (v instanceof Date ? v.toISOString() : v))}>{body}</div>
        </Dialog>
      )}
    </Ctx.Provider>
  );
}
