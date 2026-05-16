import { describe, expect, it } from 'vitest';
import { getOffDomainGuardrail } from './off-domain-guard';

// T6: off-domain → 경고 + LLM, 운영 컨텍스트 → 경고 없음

describe('getOffDomainGuardrail', () => {
  describe('T6-1: off-domain queries return warning (not block)', () => {
    it('날씨 질문 → offDomainWarning 반환, shouldShortCircuit 없음', () => {
      const result = getOffDomainGuardrail('오늘 날씨 어때?');
      expect(result).not.toBeNull();
      expect(result?.offDomainWarning).toContain('⚠️');
      expect(result?.category).toBe('live_fact');
      // shouldShortCircuit 필드가 없어야 함
      expect(result).not.toHaveProperty('shouldShortCircuit');
      // response 필드가 없어야 함
      expect(result).not.toHaveProperty('response');
    });

    it('주식 가격 질문 → offDomainWarning 반환', () => {
      const result = getOffDomainGuardrail('삼성전자 주가 알려줘');
      expect(result).not.toBeNull();
      expect(result?.offDomainWarning).toContain('⚠️');
      expect(result?.category).toBe('live_fact');
    });

    it('운세 질문 → offDomainWarning 반환', () => {
      const result = getOffDomainGuardrail('오늘 운세 알려줘');
      expect(result).not.toBeNull();
      expect(result?.offDomainWarning).toContain('⚠️');
      expect(result?.category).toBe('personal_general');
    });

    it('점심 메뉴 질문 → offDomainWarning 반환', () => {
      const result = getOffDomainGuardrail('점심 뭐 먹을까?');
      expect(result).not.toBeNull();
      expect(result?.category).toBe('personal_general');
    });

    it('맛집 추천 → offDomainWarning 반환', () => {
      const result = getOffDomainGuardrail('강남 맛집 추천해줘');
      expect(result).not.toBeNull();
      expect(result?.category).toBe('local_recommendation');
    });

    it('캘린더 등록 → offDomainWarning 반환', () => {
      const result = getOffDomainGuardrail('내일 오후 2시 회의 캘린더에 잡아줘');
      expect(result).not.toBeNull();
      expect(result?.category).toBe('external_action');
    });

    it('메일 발송 → offDomainWarning 반환', () => {
      const result = getOffDomainGuardrail('팀장님한테 이메일 보내줘');
      expect(result).not.toBeNull();
      expect(result?.category).toBe('external_action');
    });

    it('일반 알고리즘 코딩 문제 → offDomainWarning 반환', () => {
      const result = getOffDomainGuardrail('파이썬으로 피보나치 수열 구현해줘');
      expect(result).not.toBeNull();
      expect(result?.category).toBe('general_coding');
    });

    it('비트코인 가격 → offDomainWarning 반환', () => {
      const result = getOffDomainGuardrail('비트코인 현재 가격이 얼마야?');
      expect(result).not.toBeNull();
      expect(result?.category).toBe('live_fact');
    });
  });

  describe('T6-2: 운영 컨텍스트 포함 쿼리 → null (경고 없이 정상 라우팅)', () => {
    it('"CPU 사용률 높은 서버 알려줘" → null (경고 없음)', () => {
      const result = getOffDomainGuardrail('CPU 사용률 높은 서버 알려줘');
      expect(result).toBeNull();
    });

    it('"서버 상태 요약해줘" → null', () => {
      const result = getOffDomainGuardrail('서버 상태 요약해줘');
      expect(result).toBeNull();
    });

    it('"web-01 서버 메모리 상태 어때?" → null (서버 ID 포함)', () => {
      const result = getOffDomainGuardrail('web-01 서버 메모리 상태 어때?');
      expect(result).toBeNull();
    });

    it('"장애 발생 이유 분석해줘" → null', () => {
      const result = getOffDomainGuardrail('장애 발생 이유 분석해줘');
      expect(result).toBeNull();
    });

    it('"PromQL 쿼리 도와줘" → null (모니터링 컨텍스트)', () => {
      const result = getOffDomainGuardrail('PromQL 쿼리 작성 도와줘');
      expect(result).toBeNull();
    });

    it('"nginx 로그 파싱 스크립트 만들어줘" → null (운영 코딩)', () => {
      const result = getOffDomainGuardrail('nginx 로그 파싱 스크립트 만들어줘');
      expect(result).toBeNull();
    });

    it('빈 쿼리 → null', () => {
      expect(getOffDomainGuardrail('')).toBeNull();
      expect(getOffDomainGuardrail('   ')).toBeNull();
    });
  });

  describe('off-domain warning format', () => {
    it('경고 문구는 ⚠️ 로 시작해야 함', () => {
      const result = getOffDomainGuardrail('오늘 날씨 알려줘');
      expect(result?.offDomainWarning).toMatch(/^⚠️/);
    });

    it('경고 문구는 "서버 모니터링" 언급 포함', () => {
      const result = getOffDomainGuardrail('운세 알려줘');
      expect(result?.offDomainWarning).toContain('서버 모니터링');
    });
  });
});
