/**
 * Trend Prediction Schema Mapper (Anti-Corruption Layer)
 *
 * Cloud Run AI Engine과 프론트 UI는 **의도적으로 다른 어휘**를 씁니다.
 * - 엔진(Analyst tools): `projectedValue` / `signalStrength`
 *   - `signalStrength`는 "장애 발생 확률"이 아니라 근거 강도/모델 적합도를 뜻하는
 *     anti-hallucination 가드레일입니다. 계약: `analyst-tools-shared.ts`의
 *     `signalStrengthMeaning: 'evidence_strength_not_incident_probability'`,
 *     지침: `agents/config/instructions/analyst.ts`.
 * - UI(TrendCard 등): `predictedValue` / `confidence` (표시용)
 *
 * 두 bounded context를 잇는 번역 계약을 이 모듈 한 곳에 명시적으로 고정합니다.
 * 엔진 필드는 제거하지 않고 UI-canonical 필드를 **가산(additive)** 합니다.
 * 엔진에 필드가 추가되어도 매핑이 조용히 깨지지 않도록 이 매핑을 SSOT로 둡니다.
 */

/**
 * 엔진 필드 → UI-canonical 필드 번역 계약(SSOT).
 * key = UI 필드, value = 우선순위 순서의 엔진 소스 필드 목록.
 * 앞 항목이 이미 존재하면 그대로 두고, 없을 때만 뒤 항목에서 파생합니다.
 */
export const TREND_FIELD_ALIAS_CONTRACT = {
  predictedValue: ['predictedValue', 'projectedValue'],
  confidence: ['confidence', 'signalStrength'],
} as const satisfies Record<string, readonly string[]>;

type UiCanonicalField = keyof typeof TREND_FIELD_ALIAS_CONTRACT;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function resolveNumericAlias(
  source: Record<string, unknown>,
  candidates: readonly string[]
): number | undefined {
  for (const field of candidates) {
    const candidate = source[field];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * 단일 metric 결과에 UI-canonical 필드를 가산한다.
 * 엔진 원본 필드는 보존한다.
 */
export function mapTrendMetricResult(rawResult: unknown): unknown {
  if (!isRecord(rawResult)) {
    return rawResult;
  }

  const derived: Partial<Record<UiCanonicalField, number>> = {};
  for (const uiField of Object.keys(
    TREND_FIELD_ALIAS_CONTRACT
  ) as UiCanonicalField[]) {
    const value = resolveNumericAlias(
      rawResult,
      TREND_FIELD_ALIAS_CONTRACT[uiField]
    );
    if (typeof value === 'number') {
      derived[uiField] = value;
    }
  }

  return { ...rawResult, ...derived };
}

/**
 * trendPrediction payload의 `results[metric]` 각각에 UI-canonical 필드를 가산한다.
 * `results`가 record가 아니거나(배열/누락) payload 형태가 아니면 원본을 그대로 반환한다.
 */
export function mapTrendPredictionPayload(value: unknown): unknown {
  if (
    !isRecord(value) ||
    !isRecord(value.results) ||
    Array.isArray(value.results)
  ) {
    return value;
  }

  const results = Object.fromEntries(
    Object.entries(value.results).map(([metric, rawResult]) => [
      metric,
      mapTrendMetricResult(rawResult),
    ])
  );

  return { ...value, results };
}
