/**
 * Architecture Diagrams Data
 * 랜딩 페이지 Feature Card 모달용 아키텍처 다이어그램 데이터
 */

import { AI_ASSISTANT_PRO_ARCHITECTURE } from './architecture-diagrams/ai-assistant-pro';
import { CLOUD_PLATFORM_ARCHITECTURE } from './architecture-diagrams/cloud-platform';
import { INFRASTRUCTURE_TOPOLOGY_ARCHITECTURE } from './architecture-diagrams/infrastructure-topology';
import { TECH_STACK_ARCHITECTURE } from './architecture-diagrams/tech-stack';
import { VIBE_CODING_ARCHITECTURE } from './architecture-diagrams/vibe-coding';
import type { ArchitectureDiagram } from './architecture-diagrams.types';

export type {
  ArchitectureDiagram,
  DiagramConnection,
  DiagramLayer,
  DiagramNode,
} from './architecture-diagrams.types';

export const ARCHITECTURE_DIAGRAMS: Record<string, ArchitectureDiagram> = {
  'ai-assistant-pro': AI_ASSISTANT_PRO_ARCHITECTURE,
  'cloud-platform': CLOUD_PLATFORM_ARCHITECTURE,
  'tech-stack': TECH_STACK_ARCHITECTURE,
  'vibe-coding': VIBE_CODING_ARCHITECTURE,
  'infrastructure-topology': INFRASTRUCTURE_TOPOLOGY_ARCHITECTURE,
};

export function getDiagramByCardId(cardId: string): ArchitectureDiagram | null {
  return ARCHITECTURE_DIAGRAMS[cardId] || null;
}
