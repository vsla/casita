import type { Photo } from '@home-hub/shared';
import { ChevronLeft, ChevronRight, ImagePlus, Play, Trash, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/dialog';
import { Badge, PageHeader } from '../../components/ui/misc';
import { EmptyState, QueryState, Skeleton } from '../../components/ui/states';
import { api, assetUrl } from '../../lib/api';
import { useAllPhotos, useApiMutation } from '../../lib/queries';
import { useOpenForm } from '../forms';

export function PhotosPage() {
  const q = useAllPhotos();
  const openForm = useOpenForm();
  const [params, setParams] = useSearchParams();
  const slideId = params.get('slide');
  const [confirm, setConfirm] = useState<Photo | null>(null);
  const remove = useApiMutation((id: number) => api(`/photos/${id}`, { method: 'DELETE' }), { invalidate: [['photos']], success: 'Foto removida' });

  const startAt = (id: number | null) => setParams(id ? { slide: String(id) } : {});

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Fotos"
        subtitle="Momentos da família — envie pelo celular ou sincronize um álbum compartilhado do iCloud (Ajustes)"
        actions={
          <>
            {q.data && q.data.length > 0 && (
              <Button variant="outline" onClick={() => startAt(q.data![0]!.id)}>
                <Play /> Slideshow
              </Button>
            )}
            <Button onClick={() => openForm({ kind: 'photo' })}>
              <ImagePlus /> Enviar fotos
            </Button>
          </>
        }
      />
      <QueryState
        query={q}
        loading={
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        }
        isEmpty={(r) => r.length === 0}
        empty={<EmptyState icon={<ImagePlus strokeWidth={1.4} />} title="Nenhuma foto ainda" hint="Envie fotos pelo celular para aparecerem no painel." />}
      >
        {(photos) => (
          <>
            {photos.some((p) => p.demo) && (
              <p className="mb-3 text-sm text-muted">As ilustrações marcadas como “exemplo” são demonstrativas — remova quando enviar as suas.</p>
            )}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((p) => (
                <li key={p.id} className="group relative">
                  <button onClick={() => startAt(p.id)} className="press block w-full">
                    <img src={assetUrl(p.url)} alt={p.caption ?? ''} loading="lazy" className="aspect-square w-full rounded-2xl object-cover" />
                  </button>
                  {p.demo && <Badge className="absolute top-2 left-2 bg-paper/90">exemplo</Badge>}
                  {p.source === 'icloud' && <Badge className="absolute top-2 left-2 bg-paper/90">iCloud</Badge>}
                  {/* Fotos do iCloud se removem no próprio álbum (voltariam na próxima sincronização) */}
                  {p.source !== 'icloud' && <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label="Remover foto"
                    className="absolute top-2 right-2 bg-paper/90"
                    onClick={() => setConfirm(p)}
                  >
                    <Trash />
                  </Button>}
                </li>
              ))}
            </ul>
            <AnimatePresence>{slideId && <Slideshow photos={photos} startId={Number(slideId)} onClose={() => startAt(null)} />}</AnimatePresence>
          </>
        )}
      </QueryState>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Remover foto?"
        description="A foto será apagada do painel e do servidor da casa."
        loading={remove.isPending}
        onConfirm={async () => {
          await remove.mutateAsync(confirm!.id);
          setConfirm(null);
        }}
      />
    </div>
  );
}

/** Slideshow em tela cheia; avança sozinho a cada 8 s, deslize ou setas para navegar */
export function Slideshow({ photos, startId, onClose }: { photos: Photo[]; startId: number; onClose: () => void }) {
  const [index, setIndex] = useState(() => Math.max(0, photos.findIndex((p) => p.id === startId)));
  const go = useCallback((d: number) => setIndex((i) => (i + d + photos.length) % photos.length), [photos.length]);

  useEffect(() => {
    const t = setInterval(() => go(1), 8000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [go, index, onClose]);

  const photo = photos[index];
  if (!photo) return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 bg-[#1f1d1a]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <AnimatePresence mode="popLayout">
        <motion.img
          key={photo.id}
          src={assetUrl(photo.url)}
          alt={photo.caption ?? ''}
          className="absolute inset-0 size-full object-contain"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={(_e, info) => info.offset.x < -60 ? go(1) : info.offset.x > 60 && go(-1)}
        />
      </AnimatePresence>
      <div className="absolute inset-x-0 top-0 flex justify-end p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button onClick={onClose} aria-label="Fechar slideshow" className="press grid size-12 place-items-center rounded-full bg-white/15 text-white backdrop-blur">
          <X />
        </button>
      </div>
      <button onClick={() => go(-1)} aria-label="Anterior" className="press absolute top-1/2 left-4 grid size-14 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white max-sm:hidden">
        <ChevronLeft className="size-7" />
      </button>
      <button onClick={() => go(1)} aria-label="Próxima" className="press absolute top-1/2 right-4 grid size-14 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white max-sm:hidden">
        <ChevronRight className="size-7" />
      </button>
      {photo.caption && <p className="absolute inset-x-0 bottom-8 text-center font-display text-lg text-white/90">{photo.caption}</p>}
    </motion.div>,
    document.body,
  );
}
