import { WashingMachine } from 'lucide-react';
import { FoldedTowels } from '../../components/layout/illustrations';
import { Card, StatusPill } from '../../components/ui/misc';

export function LaundryWidget() {
  return (
    <Card icon={<WashingMachine />} title="Lavanderia">
      <StatusPill>Integração futura</StatusPill>
      <FoldedTowels className="absolute right-3 bottom-2 w-32 opacity-90" aria-hidden />
    </Card>
  );
}
