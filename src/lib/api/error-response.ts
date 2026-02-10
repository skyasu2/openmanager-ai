import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/types/type-utils';

type ApiErrorResponseBody = {
  success: false;
  error: string;
  message?: string;
};

/**
 * 표준 API 에러 응답 생성
 *
 * @example
 * // 단순 에러
 * return apiError('잘못된 요청입니다', 400);
 *
 * // catch 블록에서 unknown error 처리
 * return apiError('서버 처리 실패', 500, error);
 */
export function apiError(
  error: string,
  status: number,
  cause?: unknown
): NextResponse<ApiErrorResponseBody> {
  const body: ApiErrorResponseBody = { success: false, error };
  if (cause !== undefined) {
    body.message = getErrorMessage(cause);
  }
  return NextResponse.json(body, { status });
}

/**
 * 표준 API 성공 응답 생성
 *
 * @example
 * return apiSuccess({ servers: list });
 */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}
