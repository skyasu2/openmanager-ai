import { describe, expect, it } from 'vitest';
import { AI_ASSISTANT_ARCHITECTURE } from './architecture-diagrams/ai-assistant';
import { CLOUD_PLATFORM_ARCHITECTURE } from './architecture-diagrams/cloud-platform';
import { FEATURE_CARDS_DATA } from './feature-cards.data';
import { AI_ASSISTANT_TECH_STACK } from './tech-stacks/ai-assistant';
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

    expect(copy).toContain('18대 서버의 24시간 OTel 데이터');
    expect(copy).toContain('자연어 질의, 장애 보고서');
    expect(copy).toContain('무료 티어 친화 실행 경계');
    expect(copy).toContain('다운로드 가능한 장애/이상감지 아티팩트');
    expect(copy).toContain('PostgreSQL Full Text Search');
    expect(copy).toContain('search_knowledge_text RPC');
    expect(copy).toContain('Supabase는 검색 인덱스로 사용');
    expect(copy).toContain('GitLab CI semver tag pipeline');
    expect(copy).toContain('request-driven');
    expect(copy).toContain('Cloud Build가 만들고 로컬 Docker는 사전 검증');
    expect(copy).not.toContain('RAG');
    expect(copy).not.toContain('Knowledge Retrieval Lite (BM25 + pgVector)');
    expect(copy).not.toContain('Supabase pgVector');
    expect(copy).not.toContain('Tavily 하이브리드');
    expect(copy).not.toContain('Vercel 자동 배포');
    expect(copy).not.toContain('Sentry');
    expect(copy).not.toContain('로컬과 배포 환경 차이 제거');
    expect(copy).not.toContain('환경 불일치 원천 차단');
  });

  it('aligns supporting modal and diagram data with runtime wording', () => {
    const copy = stringify({
      aiAssistantDiagram: AI_ASSISTANT_ARCHITECTURE,
      aiAssistantTech: AI_ASSISTANT_TECH_STACK,
      cloudPlatformDiagram: CLOUD_PLATFORM_ARCHITECTURE,
      cloudPlatformTech: CLOUD_PLATFORM_TECH_STACK,
      vibeCodingData: VIBE_CODING_DATA,
    });

    expect(copy).toContain('BM25 RPC + metadata boost');
    expect(copy).toContain('Postgres FTS');
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
    expect(copy).toContain('Nivo Line 0.99');
    expect(copy).toContain('SVG Sparkline');
    expect(copy).toContain('Tailwind CSS 4.2');
    expect(copy).not.toContain('Recharts 3.8');
    expect(copy).not.toContain('Recharts 3.7');
    expect(copy).not.toContain('Tailwind CSS 4.1');
  });
});
