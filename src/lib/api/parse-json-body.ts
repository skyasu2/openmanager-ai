/**
 * 안전한 JSON 요청 바디 파싱 유틸리티
 *
 * Content-Type 검증 + JSON 파싱 에러 처리를 한 곳에서 수행
 */

import { NextResponse } from 'next/server';

type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

/**
 * Request body를 안전하게 JSON 파싱
 *
 * - Content-Type 헤더 검증 (application/json)
 * - JSON 파싱 실패 시 400 응답 반환
 * - 타입 가드로 결과 사용 가능
 *
 * @example
 * const result = await parseJsonBody<{ action: string }>(request);
 * if (!result.success) return result.response;
 * const { action } = result.data;
 */
export async function parseJsonBody<T = Record<string, unknown>>(
  request: Request
): Promise<ParseResult<T>> {
  const contentType = request.headers.get('content-type');

  if (!contentType?.includes('application/json')) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 415 }
      ),
    };
  }

  try {
    const data = (await request.json()) as T;
    return { success: true, data };
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      ),
    };
  }
}
