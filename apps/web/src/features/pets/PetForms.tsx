import { petActivityKinds, type Pet, type PetActivityKind } from '@home-hub/shared';
import { Camera } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { ChoiceChips, Field, Input, Textarea } from '../../components/ui/form';
import { api, assetUrl } from '../../lib/api';
import { addDays, toLocalInput } from '../../lib/dates';
import { useApiMutation, usePets } from '../../lib/queries';
import { ACTIVITY } from './kinds';
import { PetAvatar } from './PetAvatar';

/** Registrar algo que aconteceu agora OU agendar um lembrete */
export function ActivityForm({ petId, kind, onDone }: { petId?: number; kind?: PetActivityKind; onDone: () => void }) {
  const { data: pets = [] } = usePets();
  const [pet, setPet] = useState<number | null>(petId ?? pets[0]?.id ?? null);
  const [k, setK] = useState<PetActivityKind>(kind ?? 'walk');
  const [mode, setMode] = useState<'now' | 'reminder'>('now');
  const [when, setWhen] = useState(toLocalInput(addDays(new Date(), 1)));
  const [notes, setNotes] = useState('');

  const save = useApiMutation(
    (v: { pet: number; body: Record<string, unknown> }) => api(`/pets/${v.pet}/activities`, { body: v.body }),
    {
      invalidate: [['pets']],
      success: () => (mode === 'now' ? `${ACTIVITY[k].label} registrado` : 'Lembrete criado'),
    },
  );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!pet) return;
        await save.mutateAsync({
          pet,
          body: { kind: k, notes: notes || null, done: mode === 'now', scheduledAt: mode === 'reminder' ? new Date(when) : null },
        });
        onDone();
      }}
    >
      {pets.length > 1 && (
        <Field label="Pet">
          <ChoiceChips value={pet} onChange={setPet} options={pets.map((p) => ({ value: p.id, label: p.name, icon: <PetAvatar pet={p} size={26} /> }))} />
        </Field>
      )}
      <Field label="O quê?">
        <div className="grid grid-cols-4 gap-2">
          {petActivityKinds.map((kk) => {
            const A = ACTIVITY[kk];
            return (
              <button
                key={kk}
                type="button"
                aria-pressed={k === kk}
                onClick={() => setK(kk)}
                className={`press flex flex-col items-center gap-1 rounded-2xl border py-3 text-xs font-semibold ${
                  k === kk ? 'border-sage bg-sage-soft text-sage-deep' : 'border-line bg-white/60 text-ink-soft'
                }`}
              >
                <A.icon className="size-6" strokeWidth={1.6} />
                {A.label}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Quando">
        <ChoiceChips
          value={mode}
          onChange={setMode}
          options={[
            { value: 'now', label: 'Feito agora' },
            { value: 'reminder', label: 'Lembrete' },
          ]}
        />
      </Field>
      {mode === 'reminder' && (
        <Field label="Lembrar em">
          <input
            type="datetime-local"
            required
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="h-12 w-full rounded-xl border border-line bg-white/70 px-4"
          />
        </Field>
      )}
      <Field label="Observação (opcional)">
        <Input maxLength={500} placeholder={k === 'training' ? 'Ex.: 10 min de "fica"' : ''} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" loading={save.isPending} disabled={!pet}>
        {mode === 'now' ? 'Registrar' : 'Criar lembrete'}
      </Button>
    </form>
  );
}

/** Editar cadastro do pet (nome, raça, nascimento, status, observações, foto) */
export function PetForm({ pet, onDone }: { pet: Pet; onDone: () => void }) {
  const [name, setName] = useState(pet.name);
  const [breed, setBreed] = useState(pet.breed ?? '');
  const [birthDate, setBirthDate] = useState(pet.birthDate ?? '');
  const [status, setStatus] = useState(pet.status);
  const [notes, setNotes] = useState(pet.notes ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  const save = useApiMutation((body: Record<string, unknown>) => api(`/pets/${pet.id}`, { method: 'PATCH', body }), {
    invalidate: [['pets']],
    success: 'Cadastro atualizado',
  });
  const upload = useApiMutation(
    (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api(`/pets/${pet.id}/photo`, { form });
    },
    { invalidate: [['pets']], success: 'Foto atualizada' },
  );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await save.mutateAsync({ name, breed: breed || null, birthDate: birthDate || null, status, notes: notes || null });
        onDone();
      }}
    >
      <div className="flex items-center gap-4">
        {pet.photoUrl ? (
          <img src={assetUrl(pet.photoUrl)} alt={pet.name} className="size-20 rounded-full object-cover" />
        ) : (
          <PetAvatar pet={pet} size={80} />
        )}
        <Button variant="outline" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
          <Camera /> Trocar foto
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome">
          <Input required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Raça">
          <Input maxLength={60} value={breed} onChange={(e) => setBreed(e.target.value)} />
        </Field>
        <Field label="Nascimento">
          <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </Field>
        <Field label="Como está">
          <Input maxLength={60} placeholder="Ex.: Bem, em treinamento" value={status} onChange={(e) => setStatus(e.target.value)} />
        </Field>
      </div>
      <Field label="Observações">
        <Textarea maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-20" />
      </Field>
      <Button type="submit" size="lg" loading={save.isPending} disabled={!name.trim()}>
        Salvar
      </Button>
    </form>
  );
}
