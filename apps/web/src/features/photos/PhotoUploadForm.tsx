import { ImagePlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { api, errorMessage } from '../../lib/api';
import { queryClient } from '../../lib/queries';

export function PhotoUploadForm({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const form = new FormData();
      files.forEach((f) => form.append('files', f));
      await api('/photos', { form });
      await queryClient.invalidateQueries({ queryKey: ['photos'] });
      toast.success(files.length === 1 ? 'Foto enviada' : `${files.length} fotos enviadas`);
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="press flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line bg-white/50 px-4 py-10 text-ink-soft"
      >
        <ImagePlus className="size-9 text-sage" strokeWidth={1.4} />
        <span className="font-semibold">{files.length ? `${files.length} selecionada(s)` : 'Escolher fotos'}</span>
        <span className="text-xs text-muted">JPG, PNG ou WEBP · até 15 MB cada</span>
      </button>
      <input
        ref={ref}
        type="file"
        multiple
        // No iPhone, "image/jpeg" faz o Safari converter HEIC automaticamente
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {files.slice(0, 8).map((f) => (
            <img key={f.name + f.size} src={URL.createObjectURL(f)} alt="" className="aspect-square w-full rounded-xl object-cover" />
          ))}
        </div>
      )}
      <Button size="lg" disabled={!files.length} loading={busy} onClick={send}>
        Enviar
      </Button>
    </div>
  );
}
