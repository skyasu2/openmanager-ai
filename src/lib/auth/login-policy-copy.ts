/**
 * 로그인 정책 카피 (UI/테스트 공통 단일 출처)
 *
 * 목적:
 * - GitHub/Google/이메일 기반 정책 문구를 화면 간에 동일하게 유지
 * - "특정 provider만 가능" 같은 구문 편차를 방지
 */

export const AUTH_PROVIDER_NAMES = ['GitHub', 'Google', '이메일'] as const;

export const AUTH_PROVIDER_COPY = {
  listWithConjunction: `${AUTH_PROVIDER_NAMES[0]}, ${AUTH_PROVIDER_NAMES[1]}, 또는 ${AUTH_PROVIDER_NAMES[2]}`,
  listInline: `${AUTH_PROVIDER_NAMES[0]}, ${AUTH_PROVIDER_NAMES[1]}, ${AUTH_PROVIDER_NAMES[2]}`,
  withBr: `${AUTH_PROVIDER_NAMES[0]}·${AUTH_PROVIDER_NAMES[1]}·${AUTH_PROVIDER_NAMES[2]}`,
  listWithOr: `${AUTH_PROVIDER_NAMES[0]}, ${AUTH_PROVIDER_NAMES[1]} 또는 ${AUTH_PROVIDER_NAMES[2]}`,
} as const;

export const LOGIN_POLICY_COPY = {
  loginModalTitle: '로그인 필요',
  systemStartGateDescription:
    '현재 로그인 상태가 아니어도 시스템 시작 버튼은 보이지만, 시작하려면 로그인해야 합니다.',
  authPrompt: `${AUTH_PROVIDER_COPY.listWithConjunction} 인증 계정으로 로그인해 주세요.`,
  aiFeatureAuthPrompt: `${AUTH_PROVIDER_COPY.listWithConjunction} 인증으로 로그인해 주세요.`,
  aiFeatureInfo:
    'AI 기반 서버 상태 분석과 실시간 모니터링 인사이트 기능은 인증 사용자에게 제공됩니다.',
  dashboardAccess:
    '대시보드 접근을 위해 GitHub, Google, 이메일 인증 사용자 또는 관리자 PIN이 필요합니다.',
  authFailureFallback:
    '이메일 인증 또는 OAuth 로그인이 어려운 경우 게스트 PIN으로 테스트를 진행할 수 있습니다.',
  guestSystemStartBlocked:
    '현재 게스트 모드에서는 시스템 시작이 제한되어 있습니다.',
  guestRegionBlockedPrompt:
    '게스트 로그인이 제한됩니다. GitHub, Google 또는 이메일 로그인으로 이용해주세요.',
  adminPinAuthText: '관리자 PIN 인증',
  landingCapabilities:
    '시스템 운영 기능은 GitHub, Google, 이메일 인증 사용자와 게스트 테스트 모드를 지원합니다.',
} as const;
