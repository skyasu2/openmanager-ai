/**
 * 🔗 Keyword Extractor Integration Test
 *
 * RAG 시스템의 키워드 추출 로직 통합 테스트
 *
 * Vercel 무료 티어 안전:
 * - ✅ 순수 함수 테스트
 * - ✅ 외부 API 호출 없음
 * - ✅ 10초 이내 실행
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { extractKeywords } from '@/services/rag/keyword-extractor';

describe('extractKeywords Integration', () => {
  describe('한국어 처리', () => {
    it('한국어 불용어 단독 제거 (은/는/이/가 등)', () => {
      // Given - 불용어가 단독 토큰으로 있는 경우
      const query = '이 서버 는 메모리 가 부족합니다';

      // When
      const keywords = extractKeywords(query);

      // Then - 단독 불용어는 제거됨
      expect(keywords).not.toContain('이');
      expect(keywords).not.toContain('는');
      expect(keywords).not.toContain('가');
      // 실제 키워드는 유지
      expect(keywords).toContain('서버');
      expect(keywords).toContain('메모리');
      expect(keywords).toContain('부족합니다');
    });

    it('한국어 키워드 추출', () => {
      // Given
      const query = '데이터베이스 연결 오류 발생';

      // When
      const keywords = extractKeywords(query);

      // Then
      expect(keywords).toContain('데이터베이스');
      expect(keywords).toContain('연결');
      expect(keywords).toContain('오류');
      expect(keywords).toContain('발생');
    });

    it('한국어+영어 혼합 쿼리', () => {
      // Given
      const query = 'CPU 사용량이 높은 서버 확인';

      // When
      const keywords = extractKeywords(query);

      // Then
      expect(keywords).toContain('cpu');
      expect(keywords).toContain('사용량이');
      expect(keywords).toContain('서버');
      expect(keywords).toContain('확인');
    });
  });

  describe('영어 처리', () => {
    it('영어 불용어 제거 (the/is/at 등)', () => {
      // Given
      const query = 'The server is running at high capacity';

      // When
      const keywords = extractKeywords(query);

      // Then
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('is');
      expect(keywords).not.toContain('at');
      expect(keywords).toContain('server');
      expect(keywords).toContain('running');
      expect(keywords).toContain('high');
      expect(keywords).toContain('capacity');
    });

    it('영어 키워드 추출', () => {
      // Given
      const query = 'memory usage critical alert';

      // When
      const keywords = extractKeywords(query);

      // Then
      expect(keywords).toContain('memory');
      expect(keywords).toContain('usage');
      expect(keywords).toContain('critical');
      expect(keywords).toContain('alert');
    });
  });

  describe('특수 케이스', () => {
    it('특수문자 필터링', () => {
      // Given
      const query = 'server-01: CPU@90%, memory=80%';

      // When
      const keywords = extractKeywords(query);

      // Then
      // 특수문자가 공백으로 대체되어 분리됨
      expect(keywords.some((k) => k.includes('server'))).toBe(true);
      expect(keywords.some((k) => k.includes('cpu'))).toBe(true);
      expect(keywords.some((k) => k.includes('memory'))).toBe(true);
    });

    it('숫자만 있는 토큰 제외', () => {
      // Given
      const query = 'server 01 has 100 connections';

      // When
      const keywords = extractKeywords(query);

      // Then
      expect(keywords).not.toContain('01');
      expect(keywords).not.toContain('100');
      expect(keywords).toContain('server');
      expect(keywords).toContain('connections');
    });

    it('최대 10개 키워드 제한', () => {
      // Given
      const query =
        'one two three four five six seven eight nine ten eleven twelve thirteen';

      // When
      const keywords = extractKeywords(query);

      // Then
      expect(keywords.length).toBeLessThanOrEqual(10);
    });

    it('중복 키워드 제거', () => {
      // Given
      const query = 'server server memory memory cpu cpu';

      // When
      const keywords = extractKeywords(query);

      // Then
      const uniqueKeywords = [...new Set(keywords)];
      expect(keywords.length).toBe(uniqueKeywords.length);
    });

    it('빈 쿼리 → 빈 배열', () => {
      // Given
      const query = '';

      // When
      const keywords = extractKeywords(query);

      // Then
      expect(keywords).toEqual([]);
    });

    it('불용어만 있는 쿼리 → 빈 배열', () => {
      // Given
      const query = 'the is at which on and';

      // When
      const keywords = extractKeywords(query);

      // Then
      expect(keywords).toEqual([]);
    });
  });
});
