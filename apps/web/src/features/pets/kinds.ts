import { petActivityLabels, type PetActivityKind } from '@home-hub/shared';
import { Bath, Bone, Footprints, GraduationCap, Heart, Pill, Stethoscope, Syringe, type LucideIcon } from 'lucide-react';

export const ACTIVITY: Record<PetActivityKind, { icon: LucideIcon; label: string }> = {
  walk: { icon: Footprints, label: petActivityLabels.walk },
  feeding: { icon: Bone, label: petActivityLabels.feeding },
  care: { icon: Heart, label: petActivityLabels.care },
  training: { icon: GraduationCap, label: petActivityLabels.training },
  bath: { icon: Bath, label: petActivityLabels.bath },
  medication: { icon: Pill, label: petActivityLabels.medication },
  vaccine: { icon: Syringe, label: petActivityLabels.vaccine },
  vet: { icon: Stethoscope, label: petActivityLabels.vet },
};

/** Registros rápidos mais comuns no dia a dia */
export const QUICK_KINDS: PetActivityKind[] = ['walk', 'feeding', 'training', 'care'];
