/**
 * 서버 데이터 슬롯 정책 (SSOT)
 *
 * 서버 데이터는 10분 슬롯(:00/:10/:20/:30/:40/:50)으로 사전 생성된다.
 * 클라이언트는 접속 시각 슬롯을 세션 내 고정으로 사용하며 자동 갱신하지 않는다.
 * 아래 상수는 serverConfig 등에서 슬롯 단위 참조 목적으로만 사용한다.
 */

export const SERVER_DATA_SLOT_MINUTES = 10;
export const SERVER_DATA_INTERVAL_MS = SERVER_DATA_SLOT_MINUTES * 60 * 1000;
