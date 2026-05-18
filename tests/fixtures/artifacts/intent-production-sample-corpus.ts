import type {
  ArtifactIntentCorpusCase,
  ArtifactIntentCorpusCategory,
  ArtifactIntentExpectedKind,
} from './intent-corpus';

export type ArtifactIntentProductionSampleSource =
  | 'production-qa'
  | 'anonymized-operator-pattern';

export interface ArtifactIntentProductionSampleCase
  extends ArtifactIntentCorpusCase {
  source: ArtifactIntentProductionSampleSource;
  sourceRef: string;
}

export const artifactIntentProductionSampleCorpus = {
  sourceVersion: '2026-05-05-v1',
  classifierRuleVersion: '2026-05-15-v1',
  cases: [
    {
      id: 'prod-qa-ir-001',
      query: '장애 보고서 작성해줘',
      expected: 'incident-report',
      category: 'explicit-action',
      source: 'production-qa',
      sourceRef: 'QA-20260502-0390',
      note: 'production QA incident report artifact execution query',
    },
    {
      id: 'prod-pattern-ir-002',
      query: 'checkout API 500 에러 반복돼. 장애 보고서 만들어줘',
      expected: 'incident-report',
      category: 'mixed-language',
      source: 'anonymized-operator-pattern',
      sourceRef: 'operator-incident-report-action',
      note: 'service symptom plus explicit report generation',
    },
    {
      id: 'prod-pattern-ir-003',
      query: 'cache-redis-dc1-01 메모리 95%. 인시던트 리포트 생성',
      expected: 'incident-report',
      category: 'explicit-action',
      source: 'anonymized-operator-pattern',
      sourceRef: 'operator-high-memory-incident-report',
      note: 'server metric symptom plus incident report action',
    },
    {
      id: 'prod-pattern-ir-004',
      query: 'network timeout incident report export',
      expected: 'incident-report',
      category: 'mixed-language',
      source: 'anonymized-operator-pattern',
      sourceRef: 'operator-network-incident-export',
      note: 'mixed-language incident report export action',
    },
    {
      id: 'prod-qa-ma-001',
      query: '추세 분석',
      expected: 'monitoring-analysis',
      category: 'implicit-artifact',
      source: 'production-qa',
      sourceRef: 'QA-20260502-0391',
      note: 'production QA short trend artifact execution query',
    },
    {
      id: 'prod-qa-ma-002',
      query: '장애 예측 추세 분석',
      expected: 'monitoring-analysis',
      category: 'implicit-artifact',
      source: 'production-qa',
      sourceRef: 'QA-20260502-0392',
      note: 'production QA failure prediction trend artifact query',
    },
    {
      id: 'prod-pattern-ma-003',
      query: '전체 서버 이상감지 돌려줘',
      expected: 'monitoring-analysis',
      category: 'explicit-action',
      source: 'anonymized-operator-pattern',
      sourceRef: 'operator-anomaly-run',
      note: 'explicit anomaly detection execution',
    },
    {
      id: 'prod-pattern-ma-004',
      query: 'CPU/메모리 리스크 추세 분석해줘',
      expected: 'monitoring-analysis',
      category: 'mixed-language',
      source: 'anonymized-operator-pattern',
      sourceRef: 'operator-risk-trend-analysis',
      note: 'metric risk trend analysis action',
    },
    {
      id: 'prod-pattern-ma-005',
      query: 'trend report download',
      expected: 'monitoring-analysis',
      category: 'mixed-language',
      source: 'anonymized-operator-pattern',
      sourceRef: 'operator-trend-report-download',
      note: 'English trend report download action',
    },
    {
      id: 'prod-qa-ss-001',
      query: '서버 상태 스냅샷',
      expected: 'server-snapshot',
      category: 'snapshot-artifact',
      source: 'production-qa',
      sourceRef: 'QA-20260503-0395',
      note: 'production QA server snapshot artifact query',
    },
    {
      id: 'prod-pattern-ss-002',
      query: '전체 인프라 상태 카드로 보여줘',
      expected: 'server-snapshot',
      category: 'snapshot-artifact',
      source: 'anonymized-operator-pattern',
      sourceRef: 'operator-infra-status-card',
      note: 'infrastructure status card execution',
    },
    {
      id: 'prod-pattern-ss-003',
      query: 'server status report download',
      expected: 'server-snapshot',
      category: 'snapshot-artifact',
      source: 'anonymized-operator-pattern',
      sourceRef: 'operator-server-status-download',
      note: 'English server status report download action',
    },
    {
      id: 'prod-qa-gd-001',
      query: '추세 분석 기능 설명해줘',
      expected: 'guidance',
      category: 'guidance-question',
      source: 'production-qa',
      sourceRef: 'QA-20260502-0390',
      note: 'production QA trend feature guidance query',
    },
    {
      id: 'prod-pattern-gd-002',
      query: '장애 보고서 작성 방법 알려줘',
      expected: 'guidance',
      category: 'guidance-question',
      source: 'anonymized-operator-pattern',
      sourceRef: 'operator-incident-report-guidance',
      note: 'incident report method question, not execution',
    },
    {
      id: 'prod-pattern-gd-003',
      query: 'forecast report는 어떤 데이터를 쓰나?',
      expected: 'guidance',
      category: 'mixed-language',
      source: 'anonymized-operator-pattern',
      sourceRef: 'operator-forecast-data-guidance',
      note: 'forecast report data-source question',
    },
    {
      id: 'prod-qa-no-001',
      query:
        '위 답변을 운영 보고서용 2문장으로 다시 작성해줘. 서버 ID와 수치는 보존해.',
      expected: 'none',
      category: 'operational-chat',
      source: 'production-qa',
      sourceRef: 'QA-20260505-0406',
      note: 'production QA formatting-only rewrite must not execute artifact',
    },
    {
      id: 'prod-pattern-no-002',
      query: '장애 보고서 말고 현재 상태만 알려줘',
      expected: 'none',
      category: 'negation',
      source: 'anonymized-operator-pattern',
      sourceRef: 'operator-report-negation-status-only',
      note: 'explicit incident report negation',
    },
    {
      id: 'prod-pattern-no-003',
      query: 'CPU 높은 서버 알려줘',
      expected: 'none',
      category: 'operational-chat',
      source: 'anonymized-operator-pattern',
      sourceRef: 'operator-metric-ranking-chat',
      note: 'plain metric ranking chat query',
    },
    {
      id: 'prod-pattern-no-004',
      query: 'server status?',
      expected: 'none',
      category: 'operational-chat',
      source: 'anonymized-operator-pattern',
      sourceRef: 'operator-server-status-question',
      note: 'server status question without artifact shape',
    },
  ],
} as const satisfies {
  sourceVersion: string;
  classifierRuleVersion: string;
  cases: readonly ArtifactIntentProductionSampleCase[];
};

export type ArtifactIntentProductionSampleCategory =
  (typeof artifactIntentProductionSampleCorpus.cases)[number]['category'] &
    ArtifactIntentCorpusCategory;

export type ArtifactIntentProductionSampleExpectedKind =
  (typeof artifactIntentProductionSampleCorpus.cases)[number]['expected'] &
    ArtifactIntentExpectedKind;
