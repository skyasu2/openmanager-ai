export const APP_NAME = 'OpenManager AI';

// Client-visible version should be consistent across pages. If the public env
// is absent, prefer a neutral placeholder over stale hardcoded values.
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0';

export const PORTFOLIO_PROJECT_SUMMARY =
  '개인 학습 및 포트폴리오 목적의 프로젝트로, 외부에서 접속 가능한 서버 모니터링 UI와 멀티 에이전트 AI 보조 기능을 함께 검증합니다.';

export const PROJECT_STACK_LABELS = [
  'Next.js 16',
  'React 19',
  'Vercel',
  'Cloud Run',
  'Supabase',
  'Redis',
  'Multi-Agent AI',
] as const;

export const PROJECT_VALIDATION_POINTS = [
  {
    title: '1인 바이브 코딩',
    description: '아이디어 정의부터 구현, QA, 배포까지 단독으로 정리',
  },
  {
    title: '웹 앱 구축',
    description: '반응형 모니터링 UI와 인증 흐름을 Next.js로 구성',
  },
  {
    title: '서버 모니터링',
    description: '상태 요약, 자원 지표, 경보/장애 흐름을 한 화면에 통합',
  },
  {
    title: '멀티 에이전트 AI',
    description: 'AI Chat, Reporter, Analyst 기능을 분리된 AI 엔진으로 제공',
  },
  {
    title: '외부 배포 아키텍처',
    description: 'Vercel + Cloud Run + Supabase + Redis를 무료 티어 중심으로 운영',
  },
] as const;

export const PROJECT_EXPECTATION_NOTES = [
  '일부 모니터링 데이터와 장애 흐름은 학습/데모 시나리오를 포함합니다.',
  '게스트 모드는 체험용이며 일부 제어 기능은 제한될 수 있습니다.',
  '프론트엔드와 AI 백엔드는 분리 배포되어 실제 외부 접속 환경을 검증합니다.',
] as const;

export function getGuestModeDisplayLabel(isFullAccessMode: boolean) {
  return isFullAccessMode ? '확장 체험' : '제한형 체험';
}
