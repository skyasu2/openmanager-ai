/**
 * Query Classifier - 로컬 규칙 기반 쿼리 분류
 *
 * v3.0.0 (2026-01-13): 로컬 분류로 전환
 * - /api/ai/classify 제거 (Dead Code 정리)
 * - 로컬 키워드 매칭 방식 사용
 * - Cloud Run Supervisor가 고급 분류 담당
 */

export interface QueryClassification {
  complexity: number; // 1-5
  intent: 'general' | 'monitoring' | 'analysis' | 'guide' | 'coding';
  reasoning: string;
  confidence: number; // 0-100
  source?: 'llm' | 'fallback';
  latency?: number;
}

/**
 * 명확화가 필요한 쿼리인지 확인
 * @param confidence 신뢰도 (0-100)
 * @param complexity 복잡도 (1-5)
 * @returns 명확화 필요 여부
 */
export function needsClarification(
  confidence: number,
  complexity: number
): boolean {
  // 신뢰도 85% 미만이고 복잡도가 2 이상인 경우 명확화 필요
  return confidence < 85 && complexity >= 2;
}

export class QueryClassifier {
  private static instance: QueryClassifier;

  private constructor() {}

  static getInstance(): QueryClassifier {
    if (!QueryClassifier.instance) {
      QueryClassifier.instance = new QueryClassifier();
    }
    return QueryClassifier.instance;
  }

  /**
   * Classifies a user query using local keyword matching.
   * v3.0: API 호출 제거, 로컬 분류만 사용
   */
  async classify(query: string): Promise<QueryClassification> {
    return this.fallbackClassify(query);
  }

  /**
   * Fallback classification using regex (Zero latency, low intelligence)
   * 신뢰도는 쿼리의 구체성에 따라 계산
   */
  private fallbackClassify(query: string): QueryClassification {
    const q = query.toLowerCase();
    let confidence = 70; // 기본 신뢰도

    // 쿼리 길이에 따른 신뢰도 조정
    if (query.length > 50) confidence += 10; // 긴 쿼리는 더 구체적
    if (query.length < 10) confidence -= 20; // 짧은 쿼리는 모호

    // 서버 이름이 명시된 경우 신뢰도 상승
    if (
      /[a-z]+-[a-z]+-\d+|server-?\d+|mysql|nginx|redis|haproxy|postgres|mariadb|apache|kafka|elasticsearch|mongo|tomcat/i.test(
        query
      )
    ) {
      confidence += 15;
    }

    // 시간 범위가 명시된 경우 신뢰도 상승
    if (/\d+시간|\d+일|지난|최근|어제|오늘/i.test(query)) {
      confidence += 10;
    }

    // 스코프 명시 ("모든 서버", "전체 서버" 등) → 신뢰도 상승
    if (/모든|전체|전부|all\s*(서버|server)|전원/i.test(query)) {
      confidence += 15;
    }

    // 비교/필터 키워드 → 구체적 의도가 있으므로 신뢰도 상승
    if (
      /높[은아으]|낮[은아으]|많[은아으]|적[은어으]|이상|이하|초과|미만/i.test(
        query
      )
    ) {
      confidence += 15;
    }

    // 의도 명확 ("요약", "현황" 등) → 신뢰도 상승
    if (/요약|summary|현황|개요|overview/i.test(query)) {
      confidence += 10;
    }

    // Coding/Analysis -> High complexity
    if (
      q.includes('code') ||
      q.includes('script') ||
      q.includes('analysis') ||
      q.includes('why') ||
      q.includes('fix') ||
      q.includes('분석') ||
      q.includes('원인')
    ) {
      return {
        complexity: 4,
        intent: 'analysis',
        reasoning: 'Keyword match: Analysis/Coding',
        confidence: Math.min(100, Math.max(0, confidence - 5)), // 복잡한 쿼리는 더 모호할 수 있음
      };
    }

    // Monitoring -> Medium complexity
    if (
      q.includes('status') ||
      q.includes('cpu') ||
      q.includes('memory') ||
      q.includes('server') ||
      q.includes('상태') ||
      q.includes('서버') ||
      q.includes('확인') ||
      q.includes('체크') ||
      q.includes('check')
    ) {
      return {
        complexity: 2,
        intent: 'monitoring',
        reasoning: 'Keyword match: Monitoring',
        confidence: Math.min(100, Math.max(0, confidence)),
      };
    }

    // Problem/Issue detection -> Medium complexity (명확화 트리거 대상)
    if (
      q.includes('문제') ||
      q.includes('이상') ||
      q.includes('오류') ||
      q.includes('에러') ||
      q.includes('error') ||
      q.includes('issue') ||
      q.includes('problem')
    ) {
      return {
        complexity: 2,
        intent: 'monitoring',
        reasoning: 'Keyword match: Problem detection',
        confidence: Math.min(100, Math.max(0, confidence - 10)), // 문제 관련은 더 모호할 수 있음
      };
    }

    // Default -> Simple (낮은 신뢰도)
    return {
      complexity: 1,
      intent: 'general',
      reasoning: 'Fallback default',
      confidence: Math.min(100, Math.max(0, confidence - 15)),
    };
  }
}

export const classifyQuery = (query: string) =>
  QueryClassifier.getInstance().classify(query);
