import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSystemRunningFlag } from '@/lib/redis';
import {
  SYSTEM_NOT_RUNNING_ERROR,
  SYSTEM_NOT_RUNNING_MESSAGE,
} from './system-running-contract';

export { SYSTEM_NOT_RUNNING_ERROR, SYSTEM_NOT_RUNNING_MESSAGE };

export function createSystemNotRunningResponse(): NextResponse {
  return NextResponse.json(
    {
      error: SYSTEM_NOT_RUNNING_ERROR,
      message: SYSTEM_NOT_RUNNING_MESSAGE,
    },
    { status: 409 }
  );
}

/**
 * 채팅/Job 생성 등 비용이 발생하는 AI 요청은 시스템 실행 중에만 허용한다.
 * - false: 공용 창이 닫혔거나 미시작 → 409
 * - null: Redis 장애/타임아웃(상태 불명)만 fail-open
 */
export async function rejectIfSystemNotRunning(): Promise<NextResponse | null> {
  const running = await getSystemRunningFlag();
  if (running === false) {
    return createSystemNotRunningResponse();
  }
  return null;
}

/**
 * `withAuth(withRateLimit(..., withSystemRunning(handler)))` 형태로 감싼다.
 * 채팅 한 턴에서 stream보다 **먼저** 호출되는 라우트(entity 추출, artifact intent)까지
 * 덮어야 창이 닫힌 뒤 LLM 호출이 선지불되지 않는다.
 * 부팅 경로인 `/api/ai/wake-up`은 창을 여는 쪽이라 감싸지 않는다.
 */
export function withSystemRunning<TArgs extends unknown[]>(
  handler: (
    request: NextRequest,
    ...args: TArgs
  ) => Promise<NextResponse | Response>
) {
  return async (
    request: NextRequest,
    ...args: TArgs
  ): Promise<NextResponse | Response> => {
    const notRunning = await rejectIfSystemNotRunning();
    if (notRunning) {
      return notRunning;
    }
    return handler(request, ...args);
  };
}
