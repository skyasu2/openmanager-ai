/**
 * 시스템 실행 창 가드의 응답 계약.
 *
 * 서버(가드)와 클라이언트(스트림 에러 표시)가 같은 문자열을 봐야 하므로
 * `next/server`를 import하지 않는 중립 모듈에 둔다. 가드 쪽에 두면
 * NextResponse가 클라이언트 번들로 딸려 들어간다.
 */
export const SYSTEM_NOT_RUNNING_ERROR = 'System is not running';
export const SYSTEM_NOT_RUNNING_MESSAGE = '시스템 시작 후 다시 시도해주세요.';
