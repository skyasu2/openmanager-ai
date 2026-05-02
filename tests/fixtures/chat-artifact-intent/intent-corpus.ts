export type ArtifactIntentExpectedKind =
  | 'incident-report'
  | 'monitoring-analysis'
  | 'guidance'
  | 'none';

export interface ArtifactIntentCorpusCase {
  id: string;
  query: string;
  expected: ArtifactIntentExpectedKind;
  note: string;
}

export const artifactIntentCorpus = {
  version: '2026-05-02-v1',
  cases: [
    {
      id: 'ir-001',
      query: '장애 보고서 작성해줘',
      expected: 'incident-report',
      note: '명시적 장애 보고서 작성',
    },
    {
      id: 'ir-002',
      query: '서버 다운됐어. incident report 작성해줘',
      expected: 'incident-report',
      note: '증상 + 영어 보고서 action',
    },
    {
      id: 'ir-003',
      query: '장애보고서',
      expected: 'incident-report',
      note: '짧은 키워드형 실행 요청',
    },
    {
      id: 'ir-004',
      query: '장애 보고서 부탁',
      expected: 'incident-report',
      note: '부탁 action',
    },
    {
      id: 'ir-005',
      query: '현재 장애 리포트를 md 파일로 다운로드하게 만들어줘',
      expected: 'incident-report',
      note: '다운로드 가능한 리포트 생성',
    },
    {
      id: 'ir-006',
      query: '인시던트 리포트 생성해줘',
      expected: 'incident-report',
      note: '인시던트 리포트 생성',
    },
    {
      id: 'ir-007',
      query: 'incident report export',
      expected: 'incident-report',
      note: '영어 export action',
    },
    {
      id: 'ir-008',
      query: '장애 보고 뽑아줘',
      expected: 'incident-report',
      note: '구어체 출력 요청',
    },
    {
      id: 'ir-009',
      query: '결제 API 500 에러가 반복돼. 장애 보고서 만들어줘',
      expected: 'incident-report',
      note: '서비스 증상 + 보고서 action',
    },
    {
      id: 'ir-010',
      query: '웹 서버가 응답 없음 상태야. 인시던트 보고서 요청',
      expected: 'incident-report',
      note: '인시던트 보고서 요청',
    },
    {
      id: 'ir-011',
      query: '어제부터 CPU가 계속 높아. 장애 보고서 작성해줘',
      expected: 'incident-report',
      note: '증상 + 명시적 장애 보고서',
    },
    {
      id: 'ir-012',
      query: 'DB 응답 지연 장애 리포트 생성',
      expected: 'incident-report',
      note: 'DB 증상 + 장애 리포트 생성',
    },
    {
      id: 'ir-013',
      query: '메모리 사용률 95% 장애 보고서 출력',
      expected: 'incident-report',
      note: '메모리 증상 + 보고서 출력',
    },
    {
      id: 'ir-014',
      query: 'checkout 서비스 타임아웃 인시던트 리포트 만들어줘',
      expected: 'incident-report',
      note: '서비스 timeout + 인시던트 리포트',
    },
    {
      id: 'ir-015',
      query: '네트워크 장애 보고서 export',
      expected: 'incident-report',
      note: '네트워크 장애 보고서 export',
    },
    {
      id: 'ir-016',
      query: '503 에러 incident report generate',
      expected: 'incident-report',
      note: '503 에러 + 영어 보고서 생성',
    },
    {
      id: 'ir-017',
      query: '서버 재시작 장애보고서 부탁',
      expected: 'incident-report',
      note: '서버 재시작 + 장애보고서 부탁',
    },
    {
      id: 'ir-018',
      query: 'critical 알림 장애 리포트 다운로드',
      expected: 'incident-report',
      note: 'critical alert + 리포트 다운로드',
    },
    {
      id: 'ma-001',
      query: '최근 추세 기준으로 리스크 분석해줘',
      expected: 'monitoring-analysis',
      note: '추세 기반 리스크 분석',
    },
    {
      id: 'ma-002',
      query: '전체 서버 이상감지 돌려줘',
      expected: 'monitoring-analysis',
      note: '이상감지 실행',
    },
    {
      id: 'ma-003',
      query: '추세 분석',
      expected: 'monitoring-analysis',
      note: '짧은 artifact-shaped 추세 분석',
    },
    {
      id: 'ma-004',
      query: '이상감지',
      expected: 'monitoring-analysis',
      note: '짧은 이상감지 실행',
    },
    {
      id: 'ma-005',
      query: '장애 예측 추세 분석',
      expected: 'monitoring-analysis',
      note: '예측 + 추세 분석',
    },
    {
      id: 'ma-006',
      query: '추세 분석 기능 실행해줘',
      expected: 'monitoring-analysis',
      note: '기능 실행 요청',
    },
    {
      id: 'ma-007',
      query: '트렌드 분석 좀 해줘',
      expected: 'monitoring-analysis',
      note: '트렌드 분석 구어체 action',
    },
    {
      id: 'ma-008',
      query: 'trend analysis',
      expected: 'monitoring-analysis',
      note: '영어 trend analysis',
    },
    {
      id: 'ma-009',
      query: 'forecast report',
      expected: 'monitoring-analysis',
      note: '영어 forecast artifact',
    },
    {
      id: 'ma-010',
      query: '리스크 분석 실행',
      expected: 'monitoring-analysis',
      note: '리스크 분석 실행',
    },
    {
      id: 'ma-011',
      query: '이상 탐지 요약해줘',
      expected: 'monitoring-analysis',
      note: '이상 탐지 요약',
    },
    {
      id: 'ma-012',
      query: '장애 예측 분석해줘',
      expected: 'monitoring-analysis',
      note: '장애 예측 분석',
    },
    {
      id: 'ma-013',
      query: '전체 서버 forecast run',
      expected: 'monitoring-analysis',
      note: '영어 forecast run',
    },
    {
      id: 'ma-014',
      query: '오늘 모니터링 리스크 추세 보고서 만들어줘',
      expected: 'monitoring-analysis',
      note: '모니터링 리스크 보고서 생성',
    },
    {
      id: 'ma-015',
      query: 'CPU/메모리 이상감지 결과 출력',
      expected: 'monitoring-analysis',
      note: '이상감지 결과 출력',
    },
    {
      id: 'ma-016',
      query: '향후 24시간 장애 예상 분석 요청',
      expected: 'monitoring-analysis',
      note: '장애 예상 분석',
    },
    {
      id: 'ma-017',
      query: 'anomaly detection run',
      expected: 'monitoring-analysis',
      note: '영어 anomaly detection 실행',
    },
    {
      id: 'ma-018',
      query: 'trend report download',
      expected: 'monitoring-analysis',
      note: '영어 trend report download',
    },
    {
      id: 'gd-001',
      query: '장애 보고는 어떻게 하면 돼?',
      expected: 'guidance',
      note: '장애 보고 사용 방법 질문',
    },
    {
      id: 'gd-002',
      query: '추세 기능 어디서 봐?',
      expected: 'guidance',
      note: '추세 기능 위치 질문',
    },
    {
      id: 'gd-003',
      query: '추세 분석 기능 설명해줘',
      expected: 'guidance',
      note: '추세 분석 기능 설명',
    },
    {
      id: 'gd-004',
      query: '장애 보고서 기능 설명해줘',
      expected: 'guidance',
      note: '장애 보고서 기능 설명',
    },
    {
      id: 'gd-005',
      query: '장애 보고서 작성 방법 알려줘',
      expected: 'guidance',
      note: '작성 방법 안내',
    },
    {
      id: 'gd-006',
      query: '장애 보고서 파일 형식 설명해줘',
      expected: 'guidance',
      note: '파일 형식 안내',
    },
    {
      id: 'gd-007',
      query: '추세 보고서 기능 설명해줘',
      expected: 'guidance',
      note: '추세 보고서 설명',
    },
    {
      id: 'gd-008',
      query: 'incident report는 무엇을 포함해?',
      expected: 'guidance',
      note: '영어 incident report 설명 질문',
    },
    {
      id: 'gd-009',
      query: '장애 리포트 다운로드 방법 안내해줘',
      expected: 'guidance',
      note: '다운로드 방법 안내',
    },
    {
      id: 'gd-010',
      query: '이상감지 기능 사용법',
      expected: 'guidance',
      note: '이상감지 사용법',
    },
    {
      id: 'gd-011',
      query: 'trend analysis 기능 뭐야',
      expected: 'guidance',
      note: '영어 trend analysis 기능 설명',
    },
    {
      id: 'gd-012',
      query: 'forecast 보고서 지원되나?',
      expected: 'guidance',
      note: 'forecast 지원 여부',
    },
    {
      id: 'gd-013',
      query: '인시던트 보고서 가능한가요?',
      expected: 'guidance',
      note: '인시던트 보고서 지원 질문',
    },
    {
      id: 'gd-014',
      query: '이상 탐지는 어디서 실행해?',
      expected: 'guidance',
      note: '이상 탐지 화면 위치 질문',
    },
    {
      id: 'gd-015',
      query: '리스크 추세 분석은 어떤 데이터 쓰나?',
      expected: 'guidance',
      note: '데이터 출처 질문',
    },
    {
      id: 'gd-016',
      query: '장애 보고서 샘플 보여줄 수 있어?',
      expected: 'guidance',
      note: '샘플 안내 질문',
    },
    {
      id: 'gd-017',
      query: '추세 분석 화면 위치 알려줘',
      expected: 'guidance',
      note: '화면 위치 안내',
    },
    {
      id: 'gd-018',
      query: '장애 보고서 기능 가능한지 알려줘',
      expected: 'guidance',
      note: '기능 가능 여부',
    },
    {
      id: 'no-001',
      query: 'CPU 높은 서버 알려줘',
      expected: 'none',
      note: '일반 운영 상태 질문',
    },
    {
      id: 'no-002',
      query: '추세',
      expected: 'none',
      note: 'bare 추세는 일반 채팅',
    },
    {
      id: 'no-003',
      query: '최근 추세가 어때?',
      expected: 'none',
      note: '질문형 추세',
    },
    {
      id: 'no-004',
      query: '이상감지?',
      expected: 'none',
      note: '물음표만 있는 확인 질문',
    },
    {
      id: 'no-005',
      query: '추세 분석?',
      expected: 'none',
      note: '질문형 추세 분석',
    },
    {
      id: 'no-006',
      query: '장애보고서?',
      expected: 'none',
      note: '질문형 장애보고서',
    },
    {
      id: 'no-007',
      query: '예측',
      expected: 'none',
      note: 'bare 예측은 artifact-shaped 아님',
    },
    {
      id: 'no-008',
      query: '지금 장애 있나?',
      expected: 'none',
      note: '상태 질문',
    },
    {
      id: 'no-009',
      query: 'CPU 사용률 높은 이유가 뭐야?',
      expected: 'none',
      note: '상태 원인 질문이지만 보고서 실행 아님',
    },
    {
      id: 'no-010',
      query: '서버 상태 요약해줘',
      expected: 'none',
      note: '일반 요약 질문',
    },
    {
      id: 'no-011',
      query: '지난 1시간 로그 보여줘',
      expected: 'none',
      note: '로그 조회',
    },
    {
      id: 'no-012',
      query: '메모리 가장 높은 서버는?',
      expected: 'none',
      note: '서버 랭킹 질문',
    },
    {
      id: 'no-013',
      query: '현재 서버 상태 분석해줘',
      expected: 'none',
      note: '일반 서버 분석 요청',
    },
    {
      id: 'no-014',
      query: '서버 분석해줘',
      expected: 'none',
      note: '일반 서버 분석 단문',
    },
    {
      id: 'no-015',
      query: 'CPU 높은 서버 원인 분석해줘',
      expected: 'none',
      note: '보고서 없는 원인 분석 요청',
    },
    {
      id: 'no-016',
      query: '웹 서버 web-01 상세 열어줘',
      expected: 'none',
      note: '대시보드 탐색 요청',
    },
    {
      id: 'no-017',
      query: '어제 사고 정리해줘',
      expected: 'none',
      note: '보고서 없는 모호한 사고 정리',
    },
    {
      id: 'no-018',
      query: '장애 보고서 말고 현재 상태만 알려줘',
      expected: 'none',
      note: 'artifact 명시 배제',
    },
    {
      id: 'no-019',
      query: '이상감지는 말고 로그만 보여줘',
      expected: 'none',
      note: 'monitoring artifact 명시 배제',
    },
    {
      id: 'no-020',
      query: '보고서는 나중에, 지금 CPU만 알려줘',
      expected: 'none',
      note: '보고서 배제 후 상태 질문',
    },
  ],
} as const satisfies {
  version: string;
  cases: readonly ArtifactIntentCorpusCase[];
};
