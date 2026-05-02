import { describe, expect, it } from 'vitest';
import { AI_ASSISTANT_ARCHITECTURE } from './architecture-diagrams/ai-assistant';
import { CLOUD_PLATFORM_ARCHITECTURE } from './architecture-diagrams/cloud-platform';
import { FEATURE_CARDS_DATA } from './feature-cards.data';
import { CLOUD_PLATFORM_TECH_STACK } from './tech-stacks/cloud-platform';
import { TECH_STACK_ITEMS } from './tech-stacks/tech-stack';
import { VIBE_CODING_DATA } from './tech-stacks/vibe-coding';

function stringify(value: unknown): string {
  return JSON.stringify(value);
}

describe('feature card public data', () => {
  it('keeps the four landing cards in the expected order', () => {
    expect(FEATURE_CARDS_DATA.map((card) => card.id)).toEqual([
      'ai-assistant',
      'cloud-platform',
      'tech-stack',
      'vibe-coding',
    ]);
  });

  it('describes the AI assistant with current artifact and retrieval wording', () => {
    const copy = stringify(FEATURE_CARDS_DATA);

    expect(copy).toContain('다운로드 가능한 장애/이상감지 아티팩트');
    expect(copy).toContain('BM25 RPC + metadata boost');
    expect(copy).toContain('GitLab CI semver tag pipeline');
    expect(copy).toContain('request-driven');
    expect(copy).not.toContain('Knowledge Retrieval Lite (BM25 + pgVector)');
    expect(copy).not.toContain('Supabase pgVector');
    expect(copy).not.toContain('Tavily 하이브리드');
    expect(copy).not.toContain('Vercel 자동 배포');
  });

  it('aligns supporting modal and diagram data with runtime wording', () => {
    const copy = stringify({
      aiAssistantDiagram: AI_ASSISTANT_ARCHITECTURE,
      cloudPlatformDiagram: CLOUD_PLATFORM_ARCHITECTURE,
      cloudPlatformTech: CLOUD_PLATFORM_TECH_STACK,
      vibeCodingData: VIBE_CODING_DATA,
    });

    expect(copy).toContain('BM25 RPC + metadata boost');
    expect(copy).toContain('GitLab CI deploy gate');
    expect(copy).toContain('Request-driven AI job dispatch');
    expect(copy).not.toContain('BM25 + pgVector');
    expect(copy).not.toContain('Tavily Hybrid RAG');
    expect(copy).not.toContain('PostgreSQL + pgVector');
    expect(copy).not.toContain('Vercel 자동 배포');
  });

  it('keeps frontend stack versions aligned with package-visible versions', () => {
    const copy = stringify({
      featureCards: FEATURE_CARDS_DATA,
      techStack: TECH_STACK_ITEMS,
    });

    expect(copy).toContain('React 19');
    expect(copy).toContain('19.2.4');
    expect(copy).toContain('Recharts 3.8');
    expect(copy).toContain('Tailwind CSS 4.2');
    expect(copy).not.toContain('Recharts 3.7');
    expect(copy).not.toContain('Tailwind CSS 4.1');
  });
});
