import type { APIAuthContext } from '@/lib/auth/api-auth';

export type SupervisorInternalDisclosureMode = 'developer';

export function resolveSupervisorInternalDisclosureMode(
  authContext: APIAuthContext | null
): SupervisorInternalDisclosureMode | undefined {
  if (!authContext) {
    return undefined;
  }

  if (
    authContext.authType === 'development' ||
    authContext.authType === 'test' ||
    authContext.authType === 'test-secret'
  ) {
    return 'developer';
  }

  // PIN 인증 완료된 guest 세션은 서버가 발급한 userId를 가진다.
  // userId 없는 익명 guest는 내부 구현 disclosure 모드로 승격하지 않는다.
  if (authContext.authType === 'guest' && authContext.userId) {
    return 'developer';
  }

  return undefined;
}
