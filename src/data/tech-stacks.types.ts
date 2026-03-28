import type { TechItem } from '@/types/feature-card.types';

export type StageMetadata = {
  title: string;
  description: string;
  link?: { href: string; label: string };
};

export interface VibeCodeData {
  current: TechItem[];
  history: {
    stage1: TechItem[];
    stage2: TechItem[];
    stage3: TechItem[];
    stage4: TechItem[];
    stageMeta: {
      stage1: StageMetadata;
      stage2: StageMetadata;
      stage3: StageMetadata;
      stage4: StageMetadata;
    };
  };
}
