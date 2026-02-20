import type { TechItem } from '@/types/feature-card.types';

export interface VibeCodeData {
  current: TechItem[];
  history: {
    stage1: TechItem[];
    stage2: TechItem[];
    stage3: TechItem[];
  };
}
