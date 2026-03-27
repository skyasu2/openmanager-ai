import { CORE_KNOWLEDGE_ENTRIES } from './seed-knowledge-base.core';
import { INFRA_KNOWLEDGE_ENTRIES } from './seed-knowledge-base.infra';
import type { KnowledgeEntry } from './seed-knowledge-base.types';

export type { KnowledgeEntry } from './seed-knowledge-base.types';

export const KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [
  ...CORE_KNOWLEDGE_ENTRIES,
  ...INFRA_KNOWLEDGE_ENTRIES,
];
