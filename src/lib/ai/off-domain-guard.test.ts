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
      shouldShortCircuit: true,
    });
    expect(result?.response).toContain('실시간');
    expect(result?.response).toContain('확인할 수 없습니다');
  });

  it.each([
    '내일 오후 3시에 팀 회의 일정 잡아줘',
    '오늘 저녁 7시 식당 예약해줘',
    '장애 보고서를 팀에 메일로 보내줘',
  ])('blocks external action claim query "%s"', (query) => {
    const result = getOffDomainGuardrail(query);

    expect(result).toMatchObject({
      category: 'external_action',
      shouldShortCircuit: true,
    });
    expect(result?.response).toContain('직접 실행할 수 없습니다');
    expect(result?.response).toContain('초안');
  });

  it('limits local recommendations instead of inventing current venue facts', () => {
    const result = getOffDomainGuardrail('강남역 근처 맛집 추천해줘');

    expect(result).toMatchObject({
      category: 'local_recommendation',
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
  ])('does not block infra-scoped query "%s"', (query) => {
    expect(getOffDomainGuardrail(query)).toBeNull();
  });
});
