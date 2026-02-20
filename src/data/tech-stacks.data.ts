/**
 * Tech Stacks 데이터
 * 각 Feature Card의 모달에서 표시되는 상세 기술 스택 정보
 */

import type { TechItem } from '../types/feature-card.types';
import { AI_ASSISTANT_PRO_TECH_STACK } from './tech-stacks/ai-assistant-pro';
import { CLOUD_PLATFORM_TECH_STACK } from './tech-stacks/cloud-platform';
import { TECH_STACK_ITEMS } from './tech-stacks/tech-stack';
import { VIBE_CODING_DATA } from './tech-stacks/vibe-coding';
import type { VibeCodeData } from './tech-stacks.types';

export type { VibeCodeData } from './tech-stacks.types';

export const TECH_STACKS_DATA: Record<string, TechItem[] | VibeCodeData> = {
  'ai-assistant-pro': AI_ASSISTANT_PRO_TECH_STACK,
  'cloud-platform': CLOUD_PLATFORM_TECH_STACK,
  'tech-stack': TECH_STACK_ITEMS,
  'vibe-coding': VIBE_CODING_DATA,
};

export { CATEGORY_STYLES, IMPORTANCE_STYLES } from './tech-stacks.styles';
