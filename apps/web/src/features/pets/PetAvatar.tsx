import type { Pet } from '@home-hub/shared';
import { Cat, PawPrint } from 'lucide-react';
import { DogFace } from '../../components/layout/illustrations';
import { assetUrl } from '../../lib/api';
import { cn } from '../../lib/cn';

export function PetAvatar({ pet, size = 52, className }: { pet: Pick<Pet, 'name' | 'species' | 'photoUrl' | 'id'>; size?: number; className?: string }) {
  if (pet.photoUrl)
    return <img src={assetUrl(pet.photoUrl)} alt={pet.name} className={cn('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />;
  if (pet.species === 'dog') return <DogFace tone={pet.id % 2 ? 'gold' : 'cream'} className={cn('shrink-0', className)} style={{ width: size, height: size }} aria-label={pet.name} />;
  const Icon = pet.species === 'cat' ? Cat : PawPrint;
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full bg-[#f3e6d2] text-[#8a6a45]', className)} style={{ width: size, height: size }}>
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.5} />
    </span>
  );
}
