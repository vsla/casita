import { Maximize, RefreshCw } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '../../components/ui/button';
import { LiveDot, PageHeader } from '../../components/ui/misc';
import { useCamera } from '../../lib/queries';
import { CameraView } from './CameraView';

export function CameraPage() {
  const q = useCamera();
  const box = useRef<HTMLDivElement>(null);
  const live = q.data?.state === 'connected';

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={q.data?.state === 'connected' ? q.data.name : 'Câmera'}
        subtitle={<LiveDot on={live} label={live ? 'Transmissão local ao vivo' : 'Não conectada'} />}
        actions={
          <>
            <Button variant="outline" size="icon" aria-label="Verificar de novo" onClick={() => q.refetch()} loading={q.isFetching}>
              <RefreshCw />
            </Button>
            {live && (
              <Button variant="outline" onClick={() => box.current?.requestFullscreen?.()}>
                <Maximize /> Tela cheia
              </Button>
            )}
          </>
        }
      />
      <div ref={box} className="bg-black/0">
        <CameraView status={q.data} controls className="aspect-video w-full" />
      </div>

      {!live && (
        <section className="card mt-4 p-5 text-sm leading-relaxed text-ink-soft">
          <h2 className="mb-2 font-display text-lg text-ink">Como conectar a Yoosee</h2>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Descobrir o IP da câmera no roteador e testar se ela aceita RTSP/ONVIF (ex.: no VLC).</li>
            <li>
              Rodar um gateway na rede da casa (ex.: <strong>go2rtc</strong> ou <strong>MediaMTX</strong>) lendo o RTSP e publicando HLS.
            </li>
            <li>
              Expor no gateway <code>/health</code>, <code>/stream/index.m3u8</code> e <code>/snapshot.jpg</code> e configurar <code>CAMERA_GATEWAY_URL</code> na API.
            </li>
          </ol>
          <p className="mt-3">O vídeo fica na rede local; a câmera nunca é exposta diretamente à internet. Detalhes em <code>docs/camera-gateway.md</code>.</p>
        </section>
      )}
    </div>
  );
}
