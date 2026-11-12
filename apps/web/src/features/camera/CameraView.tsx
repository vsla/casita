import type { CameraStatus } from '@home-hub/shared';
import { Loader2, VideoOff, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { assetUrl } from '../../lib/api';
import { cn } from '../../lib/cn';

/**
 * Mostra a transmissão REAL do gateway local quando existir.
 * Sem gateway, mostra claramente que não está conectada — nunca um vídeo de exemplo.
 */
export function CameraView({ status, className, controls }: { status: CameraStatus | undefined; className?: string; controls?: boolean }) {
  return (
    <div className={cn('relative grid place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#e9e1d3] to-[#d9cdb9]', className)}>
      {!status ? (
        <Loader2 className="size-7 animate-spin text-ink-soft" />
      ) : status.state === 'connected' ? (
        status.mp4Url || status.hlsUrl ? (
          <LivePlayer mp4={status.mp4Url ? assetUrl(status.mp4Url) : null} hls={status.hlsUrl ? assetUrl(status.hlsUrl) : null} poster={status.snapshotUrl ? assetUrl(status.snapshotUrl) : undefined} controls={controls} />
        ) : status.snapshotUrl ? (
          <Snapshot src={assetUrl(status.snapshotUrl)} />
        ) : (
          <Message icon={<VideoOff />} text="Gateway conectado, mas sem stream disponível" />
        )
      ) : status.state === 'unavailable' ? (
        <Message icon={<WifiOff />} text={status.detail} />
      ) : (
        <Message icon={<VideoOff />} text="Câmera ainda não conectada" hint="Falta configurar o gateway local da Yoosee" />
      )}
    </div>
  );
}

function Message({ icon, text, hint }: { icon: React.ReactNode; text: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-4 text-center text-ink-soft [&>svg]:size-8">
      {icon}
      <span className="text-sm font-semibold">{text}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

function Snapshot({ src }: { src: string }) {
  const [t, setT] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  return <img src={`${src}${src.includes('?') ? '&' : '?'}t=${t}`} alt="Câmera" className="absolute inset-0 size-full object-cover" />;
}

// No iPhone todo navegador é WebKit (o Chrome do iOS se identifica como "CriOS")
const isWebKit = () => /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Android|Edg/.test(navigator.userAgent);

// Sem avanço por esse tempo = travou (câmera caiu, rede, gateway reiniciou): reconecta
const STALL_MS = 8_000;
// Mais atrasado que isso em relação ao ao vivo: pula para o fim do que já chegou
const MAX_LAG_S = 1.5;
// Quanto vídeo já visto fica guardado (o painel fica ligado o dia todo)
const KEEP_S = 10;

const canMse = () => typeof MediaSource !== 'undefined' && !isWebKit();

/**
 * Alimenta o <video> com o MP4 ao vivo via MSE. No MP4 contínuo comum o Chrome não diz
 * quanto vídeo tem guardado, então depois de um engasgo ele seguia atrasado para sempre.
 * Aqui o buffer é nosso: dá para pular para o ao vivo e descartar o que já passou.
 */
function streamMse(video: HTMLVideoElement, url: string, onFail: () => void) {
  const abort = new AbortController();
  const fail = () => !abort.signal.aborted && onFail();
  const ms = new MediaSource();
  video.src = URL.createObjectURL(ms);
  ms.addEventListener(
    'sourceopen',
    async () => {
      URL.revokeObjectURL(video.src);
      try {
        const res = await fetch(url, { credentials: 'include', signal: abort.signal });
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok || !res.body || !MediaSource.isTypeSupported(type)) throw new Error('formato');
        const sb = ms.addSourceBuffer(type);
        sb.addEventListener('error', fail);
        let queue: Uint8Array[] = [];
        const pump = () => {
          if (sb.updating || !queue.length || ms.readyState !== 'open') return;
          try {
            const t = video.currentTime;
            if (sb.buffered.length && t - sb.buffered.start(0) > KEEP_S * 2) return sb.remove(0, t - KEEP_S);
            const chunk = new Uint8Array(queue.reduce((n, c) => n + c.length, 0));
            queue.reduce((at, c) => (chunk.set(c, at), at + c.length), 0);
            queue = [];
            sb.appendBuffer(chunk);
          } catch {
            fail();
          }
        };
        sb.addEventListener('updateend', pump);
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) throw new Error('fim do stream');
          queue.push(value);
          pump();
        }
      } catch {
        fail();
      }
    },
    { once: true },
  );
  return () => abort.abort();
}

/**
 * Chromium (painel) e Android: MP4 ao vivo do go2rtc via MSE. Safari/iPhone: HLS nativo.
 * O vídeo passa pela API (cookie de sessão). O painel fica ligado o dia todo, então o player
 * se recupera sozinho: qualquer erro, fim de stream ou travamento abre uma conexão nova.
 */
function LivePlayer({ mp4, hls, poster, controls }: { mp4: string | null; hls: string | null; poster?: string; controls?: boolean }) {
  const mse = !!mp4 && canMse();
  const src = (isWebKit() ? hls ?? mp4 : mp4 ?? hls)!;
  const ref = useRef<HTMLVideoElement>(null);
  const [attempt, setAttempt] = useState(0);
  // Até o primeiro quadro, mostra a foto atual da câmera
  const [playing, setPlaying] = useState(false);
  const [retries, setRetries] = useState(0);
  const pending = useRef<ReturnType<typeof setTimeout>>(undefined);
  const startedAt = useRef<number | null>(null);

  const reconnect = useCallback(() => {
    clearTimeout(pending.current);
    pending.current = undefined;
    startedAt.current = null;
    setPlaying(false);
    setRetries((n) => n + 1);
    setAttempt((a) => a + 1);
  }, []);

  // Erro ou fim: tenta de novo com espera crescente (2 s, 4 s… até 30 s)
  const retryLater = useCallback(() => {
    if (pending.current) return;
    pending.current = setTimeout(() => {
      pending.current = undefined;
      reconnect();
    }, Math.min(30_000, 2_000 * 2 ** Math.min(retries, 4)));
  }, [reconnect, retries]);
  useEffect(() => () => clearTimeout(pending.current), []);

  useEffect(() => {
    const v = ref.current;
    if (!v || !mse) return;
    return streamMse(v, src, retryLater);
    // retryLater muda a cada tentativa; a conexão só deve abrir de novo quando a tentativa muda
  }, [attempt, mse, src]);

  useEffect(() => {
    let last = { t: -1, at: Date.now() };
    const id = setInterval(() => {
      const v = ref.current;
      if (!v || document.hidden) return (last.at = Date.now());
      if (v.currentTime !== last.t) last = { t: v.currentTime, at: Date.now() };
      else if (Date.now() - last.at > STALL_MS) reconnect();
      const end = v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0;
      if (end - v.currentTime > MAX_LAG_S) v.currentTime = end - 0.3;
      if (v.paused && end > 0) v.play().catch(() => {});
    }, 1000);
    return () => clearInterval(id);
  }, [attempt, reconnect]);

  return (
    <>
      {poster && !playing && <img src={`${poster}&t=${attempt}`} alt="" className="absolute inset-0 size-full object-cover" />}
      <video
        key={attempt}
        ref={ref}
        src={mse ? undefined : src}
        autoPlay
        muted
        playsInline
        controls={controls}
        onError={retryLater}
        onEnded={retryLater}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          startedAt.current ??= t;
          if (!playing && t - startedAt.current > 0.3) {
            setPlaying(true);
            setRetries(0);
          }
        }}
        className={cn('absolute inset-0 size-full object-cover transition-opacity duration-300', playing ? 'opacity-100' : 'opacity-0')}
      />
      {!playing && attempt > 0 && (
        <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white">
          <Loader2 className="size-3.5 animate-spin" /> Reconectando…
        </span>
      )}
    </>
  );
}
