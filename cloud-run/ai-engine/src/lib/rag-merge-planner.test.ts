import { describe, expect, it } from 'vitest';
import { buildMergePlan, type KnowledgeBaseDoc } from './rag-merge-planner';

function createDoc(
  id: string,
  category: string,
  title: string,
  content: string,
  source = 'seed_script'
): KnowledgeBaseDoc {
  return {
    id,
    category,
    title,
    content,
    source,
    severity: 'info',
    tags: [],
    related_server_types: [],
    metadata: null,
  };
}

describe('buildMergePlan', () => {
  it('creates a merge candidate for highly similar documents', () => {
    const docs: KnowledgeBaseDoc[] = [
      createDoc(
        '1',
        'command',
        'docker logs 확인',
        'docker logs --tail 200 app-server 를 사용해 최근 로그를 확인한다. 에러 패턴과 타임스탬프를 점검한다.'
      ),
      createDoc(
        '2',
        'command',
        'docker logs 조회',
        'docker logs --tail 200 app-server 명령으로 최근 로그를 조회한다. 에러 패턴을 빠르게 확인한다.'
      ),
      createDoc(
        '3',
        'incident',
        'CPU 급증 대응',
        'CPU 사용률이 90%를 넘으면 상위 프로세스를 확인하고 비정상 프로세스를 격리한다.'
      ),
    ];

    const result = buildMergePlan(docs, {
      targetTotalDocs: 2,
      categoryMinCounts: {
        command: 1,
        incident: 1,
      },
      similarityThreshold: 0.5,
    });

    expect(result.summary.candidateClusters).toBeGreaterThanOrEqual(1);
    expect(result.summary.selectedReduction).toBe(1);
    expect(result.items[0]?.category).toBe('command');
    expect(result.items[0]?.mergeIds.length).toBe(1);
  });

  it('respects category minimum counts guard', () => {
    const docs: KnowledgeBaseDoc[] = [
      createDoc(
        '1',
        'architecture',
        '아키텍처 개요',
        '로드밸런서 API DB 기본 구성과 트래픽 흐름 설명. 장애 시 복구 순서 설명.'
      ),
      createDoc(
        '2',
        'architecture',
        '아키텍처 소개',
        '로드밸런서 API DB 기본 구성과 트래픽 흐름 설명. 장애 복구 순서를 안내.'
      ),
    ];

    const result = buildMergePlan(docs, {
      targetTotalDocs: 1,
      categoryMinCounts: {
        architecture: 2,
      },
      similarityThreshold: 0.35,
    });

    expect(result.summary.candidateClusters).toBe(1);
    expect(result.items.length).toBe(0);
    expect(result.skippedClusters[0]?.reason).toContain('category guard');
  });
});
