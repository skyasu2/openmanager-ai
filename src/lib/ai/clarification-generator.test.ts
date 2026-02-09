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
