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

  if (authContext.authType === 'guest' && authContext.userId) {
    return 'developer';
  }

  return undefined;
}
