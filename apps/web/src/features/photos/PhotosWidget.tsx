import { ImagePlus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Skeleton } from '../../components/ui/states';
import { assetUrl } from '../../lib/api';
import { useAllPhotos } from '../../lib/queries';
import { useOpenForm } from '../forms';

const INTERVAL_MS = 9000;

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Uma foto por vez, em apresentação de slides (crossfade + zoom lento).
 * Ordem aleatória a cada abertura; ao fim de uma volta embaralha de novo, sem repetir
 * nenhuma foto antes de passar por todas.
 */
export function PhotosWidget() {
  const { data: all, isPending } = useAllPhotos();
  const openForm = useOpenForm();
  const ids = useMemo(() => (all ?? []).map((p) => p.id).join(','), [all]);
  const [order, setOrder] = useState<typeof all>(undefined);
  const [index, setIndex] = useState(0);

  // Embaralha quando o conjunto de fotos muda (não a cada refetch)
  useEffect(() => {
    setOrder(all ? shuffle(all) : undefined);
    setIndex(0);
  }, [ids]);

  const photos = order;
  const count = photos?.length ?? 0;

  useEffect(() => {
    if (count < 2) return;
    const t = setInterval(() => {
      setIndex((i) => {
        if (i + 1 < count) return i + 1;
        // Nova volta: embaralha, evitando que a última foto abra a próxima volta
        setOrder((prev) => {
          if (!prev) return prev;
          const next = shuffle(prev);
          if (next[0]?.id === prev.at(-1)?.id) next.push(next.shift()!);
          return next;
        });
        return 0;
      });
    }, INTERVAL_MS);
    return () => clearInterval(t);
  }, [count]);

  const photo = photos?.[index % Math.max(count, 1)];

  return (
    <section className="card relative h-full min-h-48 overflow-hidden">
      {isPending ? (
        <Skeleton className="absolute inset-0 rounded-none" />
      ) : !photo ? (
        <button onClick={() => openForm({ kind: 'photo' })} className="press grid size-full place-items-center text-ink-soft">
          <span className="flex flex-col items-center gap-2">
            <ImagePlus className="size-8 text-sage" strokeWidth={1.4} />
            <span className="text-sm font-semibold">Enviar fotos</span>
          </span>
        </button>
      ) : (
        <Link to={`/fotos?slide=${photo.id}`} className="absolute inset-0" aria-label="Abrir slideshow">
          <AnimatePresence initial={false}>
            <motion.img
              key={photo.id}
              src={assetUrl(photo.url)}
              alt={photo.caption ?? ''}
              className="absolute inset-0 size-full object-cover"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1.12, transition: { opacity: { duration: 1.2 }, scale: { duration: INTERVAL_MS / 1000 + 1.5, ease: 'linear' } } }}
              exit={{ opacity: 0, transition: { duration: 1.2 } }}
            />
          </AnimatePresence>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2b2925]/55 to-transparent px-4 pt-10 pb-3 text-white">
            <p className="font-display text-lg leading-tight">Momentos</p>
            <p className="text-xs text-white/80">{photo.demo ? 'Imagem demonstrativa' : (photo.caption ?? (photo.source === 'icloud' ? 'Do álbum do iCloud' : `${index + 1} de ${count}`))}</p>
          </div>
          {count > 1 && (
            <div className="absolute top-3 right-3 flex gap-1">
              {photos!.slice(0, 8).map((p, i) => (
                <span key={p.id} className={`size-1.5 rounded-full transition-colors duration-300 ${i === index % 8 ? 'bg-white' : 'bg-white/45'}`} />
              ))}
            </div>
          )}
        </Link>
      )}
    </section>
  );
}
