import { Camera } from 'lucide-react';
import { Card, LiveDot } from '../../components/ui/misc';
import { useCamera } from '../../lib/queries';
import { CameraView } from './CameraView';

export function CameraWidget() {
  const { data } = useCamera();
  const live = data?.state === 'connected';
  const name = data?.state === 'connected' ? data.name : 'Câmera';
  return (
    <Card icon={<Camera />} title={name} to="/camera" action={<LiveDot on={live} label={live ? 'Ao vivo' : 'Não conectada'} />}>
      <CameraView status={data} className="h-full min-h-36" />
    </Card>
  );
}
