import { describe, expect, it } from 'vitest';
import { getOffDomainGuardrail } from './off-domain-guard';

describe('getOffDomainGuardrail', () => {
  it.each([
    ['비트코인 지금 가격 알려줘', 'live_fact'],
    ['오늘 서울 날씨 알려줘', 'live_fact'],
    ['테슬라 주가 지금 얼마야?', 'live_fact'],
    ['USD 환율 알려줘', 'live_fact'],
    ['오늘 뉴스 보고서 만들어줘', 'live_fact'],
  ])('blocks live external fact query "%s"', (query, category) => {
    const result = getOffDomainGuardrail(query);

    expect(result).toMatchObject({
      category,
      action: 'block',
      shouldShortCircuit: true,
    });
    expect(result?.response).toContain('실시간');
    expect(result?.response).toContain('확인할 수 없습니다');
  });

  it.each([
    '내일 오후 3시에 팀 회의 일정 잡아줘',
    '오늘 저녁 7시 식당 예약해줘',
    '행사 안내를 팀에 메일로 보내줘',
  ])('warns external action claim query "%s"', (query) => {
    const result = getOffDomainGuardrail(query);

    expect(result).toMatchObject({
      category: 'external_action',
      action: 'warn',
    });
    expect(result?.warning).toContain('정확도');
    expect(result?.response).toBeUndefined();
  });

  it('limits local recommendations instead of inventing current venue facts', () => {
    const result = getOffDomainGuardrail('강남역 근처 맛집 추천해줘');

    expect(result).toMatchObject({
      category: 'local_recommendation',
      action: 'block',
      shouldShortCircuit: true,
    });
    expect(result?.response).toContain('최신 영업 여부');
    expect(result?.response).toContain('리뷰');
  });

  it.each([
    '오늘 점심 뭐 먹지?',
    '오늘 운세 알려줘',
  ])('limits personal general query "%s"', (query) => {
    const result = getOffDomainGuardrail(query);

    expect(result).toMatchObject({
      category: 'personal_general',
      action: 'block',
      shouldShortCircuit: true,
    });
    expect(result?.response).toContain('서버 운영');
  });

  it.each([
    '서버 점검 일정 알려줘',
    'Redis 공식 문서 번역해줘',
    'api-was-dc1-01 CPU 상태 분석해줘',
    'db-mysql-dc1-primary 디스크 용량 확보 명령어 알려줘',
    '오늘 시스템 요약 보고서 만들어줘',
    '장애 대응 runbook 알려줘',
    '서버 장애 알림 Slack으로 공유해줘',
    'CPU 80% 이상 서버를 팀에 메일로 보내는 초안 만들어줘',
  ])('does not block infra-scoped query "%s"', (query) => {
    expect(getOffDomainGuardrail(query)).toBeNull();
  });

  it.each([
    '파이썬 피보나치 코드 짜줘',
    'leetcode two sum 풀어줘',
  ])('warns general coding query "%s"', (query) => {
    const result = getOffDomainGuardrail(query);

    expect(result).toMatchObject({
      category: 'general_coding',
      action: 'warn',
    });
    expect(result?.warning).toContain('정확도');
    expect(result?.response).toBeUndefined();
  });

  it.each([
    'Python으로 nginx access log 에러율 집계 스크립트 만들어줘',
    'CPU 사용률 점검 bash 스크립트 알려줘',
    'PromQL로 CPU 80% 이상 서버 찾는 쿼리 알려줘',
  ])('does not block ops-scoped coding query "%s"', (query) => {
    expect(getOffDomainGuardrail(query)).toBeNull();
  });
});
