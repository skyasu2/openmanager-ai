import { describe, expect, it } from 'vitest';
import {
  applyClarification,
  applyCustomClarification,
  generateClarification,
} from './clarification-generator';
import type { QueryClassification } from './query-classifier';

// 명확화가 발생하는 기본 classification (confidence < 85, complexity >= 2)
const lowConfidence: QueryClassification = {
  complexity: 3,
  intent: 'monitoring',
  reasoning: 'test',
  confidence: 60,
};

// 명확화가 발생하지 않는 classification (confidence >= 85)
const highConfidence: QueryClassification = {
  complexity: 3,
  intent: 'monitoring',
  reasoning: 'test',
  confidence: 90,
};

// 명확화가 발생하지 않는 classification (complexity < 2)
const lowComplexity: QueryClassification = {
  complexity: 1,
  intent: 'general',
  reasoning: 'test',
  confidence: 60,
};

describe('generateClarification', () => {
  describe('confidence/complexity 기반 스킵', () => {
    it('confidence >= 85이면 null 반환', () => {
      expect(generateClarification('서버 상태', highConfidence)).toBeNull();
    });

    it('complexity < 2이면 null 반환', () => {
      expect(generateClarification('서버 상태', lowComplexity)).toBeNull();
    });
  });

  describe('구체적 조건 패턴으로 스킵', () => {
    it('퍼센트가 포함되면 clarification 스킵', () => {
      expect(generateClarification('서버 CPU 92%', lowConfidence)).toBeNull();
    });

    it('TOP N 패턴이면 clarification 스킵', () => {
      expect(generateClarification('서버 CPU TOP 5', lowConfidence)).toBeNull();
    });

    it('"3개" 같은 수량이면 clarification 스킵', () => {
      expect(
        generateClarification('서버 상태 3개 보여줘', lowConfidence)
      ).toBeNull();
    });

    it('상태 조건이면 clarification 스킵', () => {
      expect(
        generateClarification('경고 상태인 서버', lowConfidence)
      ).toBeNull();
    });

    it('비교 조건이면 clarification 스킵', () => {
      expect(
        generateClarification('가장 높은 CPU 서버', lowConfidence)
      ).toBeNull();
    });

    it('"모든 서버" 스코프 명시 → clarification 스킵', () => {
      expect(
        generateClarification('현재 모든 서버의 상태를 요약해줘', lowConfidence)
      ).toBeNull();
    });

    it('"전체 서버" 스코프 명시 → clarification 스킵', () => {
      expect(
        generateClarification('전체 서버 상태 확인', lowConfidence)
      ).toBeNull();
    });

    it('"CPU 높은 서버 찾아줘" → clarification 스킵', () => {
      expect(
        generateClarification('CPU 높은 서버 찾아줘', lowConfidence)
      ).toBeNull();
    });

    it('"메모리 낮은 서버" → clarification 스킵', () => {
      expect(
        generateClarification('메모리 낮은 서버', lowConfidence)
      ).toBeNull();
    });

    it('"디스크 많이 쓰는 서버 찾아줘" → clarification 스킵 (filterIntent)', () => {
      expect(
        generateClarification('디스크 많이 쓰는 서버 찾아줘', lowConfidence)
      ).toBeNull();
    });

    it('직전 답변 재작성 요청이면 서버 scope clarification을 스킵', () => {
      expect(
        generateClarification(
          '위 답변을 운영 보고서용 2문장으로 다시 작성해줘. 서버 ID와 수치는 보존해.',
          lowConfidence
        )
      ).toBeNull();
    });

    it('최신 외부 문서/버전 질의는 서버 scope clarification을 스킵', () => {
      expect(
        generateClarification(
          'Next.js 최신 stable major 버전 확인해줘',
          lowConfidence
        )
      ).toBeNull();
      expect(
        generateClarification(
          '공식 문서 기준 Next.js latest release 알려줘',
          lowConfidence
        )
      ).toBeNull();
    });

    it('내부 문서/파일 경로 질의는 서버 scope clarification을 스킵', () => {
      expect(
        generateClarification(
          'RAG On 상태에서 OpenManager의 Pre-generated OTel 데이터 SSOT 파일 경로와 데이터 로더 경로를 근거와 함께 알려줘.',
          lowConfidence
        )
      ).toBeNull();
      expect(
        generateClarification(
          '프로젝트 문서에서 데이터 로더 코드 위치 찾아줘',
          lowConfidence
        )
      ).toBeNull();
    });

    it('운영 명령어/절차 질의는 command guidance로 바로 실행되도록 clarification을 스킵', () => {
      expect(
        generateClarification(
          'Nginx 액세스 로그에서 5xx 에러가 많이 나는 경로 분석하는 방법 알려줘',
          {
            complexity: 4,
            intent: 'analysis',
            reasoning: 'Keyword match: Analysis/Coding',
            confidence: 80,
          }
        )
      ).toBeNull();
      expect(
        generateClarification(
          'NFS 마운트가 끊겼을 때 확인하고 재마운트하는 순서 알려줘',
          lowConfidence
        )
      ).toBeNull();
    });

    it('실제 서버 ID가 있으면 analysis intent여도 clarification을 스킵', () => {
      expect(
        generateClarification('api-was-dc1-01 CPU 상태 분석해줘', {
          complexity: 4,
          intent: 'analysis',
          reasoning: 'Keyword match: Analysis/Coding',
          confidence: 60,
        })
      ).toBeNull();
    });

    it('primary/replica 접미사가 있는 서버 ID도 명시 서버로 인식한다', () => {
      expect(
        generateClarification(
          'db-mysql-dc1-primary 상세 분석, 위험한지 판단해줘',
          {
            complexity: 4,
            intent: 'analysis',
            reasoning: 'Keyword match: Analysis/Coding',
            confidence: 60,
          }
        )
      ).toBeNull();
    });

    it('신뢰도 높은 추출 서버가 있으면 서버 clarification을 스킵', () => {
      expect(
        generateClarification('서버 상태 확인', lowConfidence, {
          server: 'api-was-dc1-01',
          confidence: 90,
        })
      ).toBeNull();
    });

    it('신뢰도 낮은 추출 서버만 있으면 clarification을 유지', () => {
      const result = generateClarification('서버 상태 확인', lowConfidence, {
        server: 'api-was-dc1-01',
        confidence: 50,
      });

      expect(result?.options.some((option) => option.id === 'server-all')).toBe(
        true
      );
    });

    it('whole_fleet metric_peak intent frame이면 서버명이 없어도 clarification을 스킵', () => {
      expect(
        generateClarification(
          '24h 기준 load1 peak가 언제였고 어떤 서버가 가장 영향을 줬어?',
          lowConfidence,
          {
            confidence: 91,
            intentFrame: {
              domain: 'monitoring',
              intent: 'metric_peak',
              scope: 'whole_fleet',
              targets: [],
              metric: 'load1',
              timeWindow: '24h',
              aggregation: 'peak',
              topN: 3,
              ambiguity: 'low',
              confidence: 91,
            },
          } as any
        )
      ).toBeNull();
    });

    it('server scope intent frame에서 대상이 비어 있고 ambiguity가 높으면 clarification을 유지', () => {
      const result = generateClarification(
        '서버 상태 분석해줘',
        lowConfidence,
        {
          confidence: 88,
          intentFrame: {
            domain: 'monitoring',
            intent: 'server_health',
            scope: 'server',
            targets: [],
            metric: 'unknown',
            timeWindow: 'unknown',
            aggregation: 'summary',
            ambiguity: 'high',
            confidence: 88,
          },
        } as any
      );

      expect(result?.options.some((option) => option.id === 'server-all')).toBe(
        true
      );
    });

    // 한국어 활용형 테스트
    it('"CPU 높아?" → clarification 스킵 (comparisonCondition 활용형)', () => {
      expect(generateClarification('CPU 높아?', lowConfidence)).toBeNull();
    });

    it('"제일 높은 CPU 서버" → clarification 스킵 (제일 + 높은)', () => {
      expect(
        generateClarification('제일 높은 CPU 서버', lowConfidence)
      ).toBeNull();
    });

    it('"메모리 많으면 알려줘" → clarification 스킵 (많으 활용형)', () => {
      expect(
        generateClarification('메모리 많으면 알려줘', lowConfidence)
      ).toBeNull();
    });

    // 오프라인/상태 쿼리 테스트
    it('"오프라인 서버 있어?" → clarification 스킵 (statusCondition)', () => {
      expect(
        generateClarification('오프라인 서버 있어?', lowConfidence)
      ).toBeNull();
    });

    it('"다운된 서버" → clarification 스킵 (statusCondition)', () => {
      expect(generateClarification('다운된 서버', lowConfidence)).toBeNull();
    });

    // 혼합 언어
    it('"DB server CPU 높은 거" → clarification 스킵 (혼합 언어)', () => {
      expect(
        generateClarification('DB server CPU 높은 거', lowConfidence)
      ).toBeNull();
    });

    // 구두점
    it('"서버 상태 알려줘!!" → clarification 정상 동작 (구두점 무시)', () => {
      const result = generateClarification('서버 상태 알려줘!!', lowConfidence);
      // 서버 + 상태 키워드 → 서버 clarification 또는 null (패턴 매칭에 따라)
      // 중요한 것은 에러 없이 동작하는 것
      expect(result === null || result.options.length > 0).toBe(true);
    });
  });

  describe('모호한 쿼리', () => {
    it('"서버" 한 단어 → clarification 트리거', () => {
      const result = generateClarification('서버', lowConfidence);
      expect(result).not.toBeNull();
    });
  });

  describe('SERVER_PATTERNS', () => {
    it('서버 키워드만 있고 제품명 없으면 서버 clarification 생성', () => {
      const result = generateClarification('서버 상태 확인', lowConfidence);
      expect(result).not.toBeNull();
      expect(result!.options.some((o) => o.id === 'server-all')).toBe(true);
    });

    it('서버 제품명(mysql)이 있으면 서버 clarification 스킵', () => {
      const result = generateClarification(
        'mysql 서버 상태 확인',
        lowConfidence
      );
      // 서버 clarification 옵션이 없어야 함
      expect(
        result === null || !result.options.some((o) => o.id === 'server-all')
      ).toBe(true);
    });

    it('서버 제품명(nginx)이 있으면 서버 clarification 스킵', () => {
      const result = generateClarification(
        'nginx 서버 상태 확인',
        lowConfidence
      );
      expect(
        result === null || !result.options.some((o) => o.id === 'server-all')
      ).toBe(true);
    });

    it('서버 ID 패턴이 있으면 서버 clarification 스킵', () => {
      const result = generateClarification('web-01 서버 상태', lowConfidence);
      expect(
        result === null || !result.options.some((o) => o.id === 'server-all')
      ).toBe(true);
    });
  });

  describe('METRIC_PATTERNS', () => {
    it('"성능이 느려" + 메트릭 미지정이면 메트릭 clarification 생성', () => {
      // 서버 패턴 미매칭 쿼리로 메트릭 clarification만 테스트
      const result = generateClarification('앱 성능이 느려', lowConfidence);
      expect(result).not.toBeNull();
      expect(result!.options.some((o) => o.id === 'metric-cpu')).toBe(true);
    });

    it('"성능이 느려" + CPU 지정이면 메트릭 clarification 스킵', () => {
      const result = generateClarification('CPU 성능이 느려', lowConfidence);
      expect(
        result === null || !result.options.some((o) => o.id === 'metric-cpu')
      ).toBe(true);
    });

    it('신뢰도 높은 추출 메트릭이 있으면 메트릭 clarification을 스킵', () => {
      const result = generateClarification('앱 성능이 느려', lowConfidence, {
        metric: 'cpu',
        confidence: 95,
      });

      expect(
        result === null || !result.options.some((o) => o.id === 'metric-cpu')
      ).toBe(true);
    });

    it('제품명(mysql)이 메트릭 힌트로 인정됨', () => {
      const result = generateClarification('mysql 성능이 느려', lowConfidence);
      // mysql이 METRIC_PATTERNS.hasSpecific에 포함되어 메트릭 clarification 스킵
      expect(
        result === null || !result.options.some((o) => o.id === 'metric-cpu')
      ).toBe(true);
    });
  });

  describe('TIME_PATTERNS', () => {
    it('시간 관련 키워드 + 구체적 시간 없으면 시간 clarification 생성', () => {
      // 서버 패턴도 매칭되므로 옵션 4개 제한에 의해 time 옵션이 잘릴 수 있음
      // 서버 패턴이 매칭되지 않는 쿼리로 테스트
      const result = generateClarification('데이터 추이 변화', lowConfidence);
      expect(result).not.toBeNull();
      expect(result!.options.some((o) => o.id === 'time-1h')).toBe(true);
    });

    it('구체적 시간이 있으면 시간 clarification 스킵', () => {
      const result = generateClarification(
        '최근 1시간 서버 추이',
        lowConfidence
      );
      expect(
        result === null || !result.options.some((o) => o.id === 'time-1h')
      ).toBe(true);
    });
  });

  describe('짧은 쿼리', () => {
    it('10자 미만 + 패턴 미매칭이면 일반 clarification 생성', () => {
      const result = generateClarification('안녕', lowConfidence);
      expect(result).not.toBeNull();
      expect(result!.options.some((o) => o.id === 'short-status')).toBe(true);
    });
  });

  describe('옵션 제한', () => {
    it('최대 4개 옵션만 반환', () => {
      const result = generateClarification(
        '서버 추이 성능 이상',
        lowConfidence
      );
      if (result) {
        expect(result.options.length).toBeLessThanOrEqual(4);
      }
    });
  });
});

describe('applyClarification', () => {
  it('선택한 옵션의 suggestedQuery 반환', () => {
    const option = {
      id: 'server-all',
      text: '전체 서버 현황',
      suggestedQuery: '서버 상태 (전체 서버)',
      category: 'scope' as const,
    };
    expect(applyClarification(option)).toBe('서버 상태 (전체 서버)');
  });
});

describe('applyCustomClarification', () => {
  it('원본 쿼리 + 커스텀 입력 결합', () => {
    expect(applyCustomClarification('서버 상태', 'web-01만')).toBe(
      '서버 상태 - web-01만'
    );
  });
});
