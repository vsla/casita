import type { Note } from '@home-hub/shared';
import { Pin, Trash } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/dialog';
import { ChoiceChips, Field, Switch, Textarea } from '../../components/ui/form';
import { api } from '../../lib/api';
import { addDays, toLocalInput } from '../../lib/dates';
import { useApiMutation } from '../../lib/queries';

type Expiry = 'never' | 'today' | 'tomorrow' | 'week' | 'custom';

const endOf = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 0, 0);
  return x;
};

export function NoteForm({ note, onDone }: { note?: Note; onDone: () => void }) {
  const [body, setBody] = useState(note?.body ?? '');
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [expiry, setExpiry] = useState<Expiry>(note?.expiresAt ? 'custom' : 'never');
  const [custom, setCustom] = useState(note?.expiresAt ? toLocalInput(new Date(note.expiresAt)) : toLocalInput(endOf(addDays(new Date(), 1))));
  const [confirm, setConfirm] = useState(false);

  const expiresAt = (() => {
    const now = new Date();
    if (expiry === 'today') return endOf(now);
    if (expiry === 'tomorrow') return endOf(addDays(now, 1));
    if (expiry === 'week') return endOf(addDays(now, 7));
    if (expiry === 'custom') return new Date(custom);
    return null;
  })();

  const save = useApiMutation(
    (b: { body: string; pinned: boolean; expiresAt: Date | null }) =>
      note ? api(`/notes/${note.id}`, { method: 'PATCH', body: b }) : api('/notes', { body: b }),
    { invalidate: [['notes']], success: note ? 'Recado atualizado' : 'Recado deixado' },
  );
  const remove = useApiMutation(() => api(`/notes/${note!.id}`, { method: 'DELETE' }), { invalidate: [['notes']], success: 'Recado excluído' });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await save.mutateAsync({ body, pinned, expiresAt });
        onDone();
      }}
    >
      <Field label="Recado" hint={`${body.length}/500`}>
        <Textarea
          autoFocus={!note}
          required
          maxLength={500}
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva um recado para a casa…"
          className="text-lg"
        />
      </Field>
      <Field label="Validade">
        <ChoiceChips
          value={expiry}
          onChange={setExpiry}
          options={[
            { value: 'never', label: 'Sem validade' },
            { value: 'today', label: 'Até hoje' },
            { value: 'tomorrow', label: 'Até amanhã' },
            { value: 'week', label: '1 semana' },
            { value: 'custom', label: 'Escolher' },
          ]}
        />
      </Field>
      {expiry === 'custom' && (
        <Field label="Some depois de">
          <input
            type="datetime-local"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="h-12 w-full rounded-xl border border-line bg-white/70 px-4"
          />
        </Field>
      )}
      <div className="flex items-center justify-between rounded-2xl bg-paper-2 px-4 py-3">
        <span className="flex items-center gap-2 font-semibold">
          <Pin className="size-4 text-sage-deep" /> Fixar no topo
        </span>
        <Switch checked={pinned} onChange={setPinned} label="Fixar recado" />
      </div>
      <div className="flex gap-2">
        {note && (
          <Button variant="danger" size="icon" aria-label="Excluir recado" onClick={() => setConfirm(true)}>
            <Trash />
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1" loading={save.isPending} disabled={!body.trim()}>
          {note ? 'Salvar' : 'Deixar recado'}
        </Button>
      </div>
      {note && (
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Excluir recado?"
          description="Esta ação não pode ser desfeita."
          loading={remove.isPending}
          onConfirm={async () => {
            await remove.mutateAsync(undefined);
            setConfirm(false);
            onDone();
          }}
        />
      )}
    </form>
  );
}
