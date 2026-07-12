import { createHmac } from 'node:crypto';
import type { APIAuthContext } from '@/lib/auth/api-auth';

export type SupervisorInternalDisclosureMode = 'developer';
export type InternalDisclosureAudience = 'supervisor' | 'job';
export interface InternalDisclosureFields {
  internalDisclosureMode?: SupervisorInternalDisclosureMode;
  internalDisclosureProof?: string;
}

const INTERNAL_DISCLOSURE_PROOF_DOMAIN = 'openmanager:internal-disclosure:v1';

export function createInternalDisclosureFields(params: {
  mode?: SupervisorInternalDisclosureMode;
  audience: InternalDisclosureAudience;
  subject: string;
}): InternalDisclosureFields {
  const secret = process.env.CLOUD_RUN_API_SECRET?.trim();
  if (!params.mode || !secret || !params.subject) {
    return {};
  }

  const internalDisclosureProof = createHmac('sha256', secret)
    .update(
      [
        INTERNAL_DISCLOSURE_PROOF_DOMAIN,
        params.audience,
        params.subject,
        params.mode,
      ].join('\0')
    )
    .digest('hex');

  return {
    internalDisclosureMode: params.mode,
    internalDisclosureProof,
  };
}

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
