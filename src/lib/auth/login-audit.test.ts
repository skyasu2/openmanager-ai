/**
 * @vitest-environment node
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/logging', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./guest-region-policy', () => ({
  getRequestCountryCode: vi.fn(() => 'KR'),
}));

const mockInsert = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({ insert: mockInsert })),
  },
}));

import { normalizeOAuthProvider, recordLoginEvent } from './login-audit';

describe('login-audit', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('normalizeOAuthProvider', () => {
    it('github 문자열을 정규화한다', () => {
      // Given: 대소문자 혼합된 입력

      // When & Then: 소문자 정규화
      expect(normalizeOAuthProvider('GitHub')).toBe('github');
      expect(normalizeOAuthProvider('GITHUB')).toBe('github');
      expect(normalizeOAuthProvider('github')).toBe('github');
    });

    it('google 문자열을 정규화한다', () => {
      // Given & When & Then
      expect(normalizeOAuthProvider('Google')).toBe('google');
      expect(normalizeOAuthProvider('GOOGLE')).toBe('google');
    });

    it('guest 문자열을 정규화한다', () => {
      // Given & When & Then
      expect(normalizeOAuthProvider('Guest')).toBe('guest');
      expect(normalizeOAuthProvider('GUEST')).toBe('guest');
    });

    it('알 수 없는 provider는 unknown을 반환한다', () => {
      // Given: 지원하지 않는 provider

      // When & Then
      expect(normalizeOAuthProvider('facebook')).toBe('unknown');
      expect(normalizeOAuthProvider('')).toBe('unknown');
      expect(normalizeOAuthProvider(null)).toBe('unknown');
      expect(normalizeOAuthProvider(undefined)).toBe('unknown');
    });

    it('공백이 포함된 입력도 정규화한다', () => {
      // Given: 앞뒤 공백 포함

      // When & Then
      expect(normalizeOAuthProvider('  github  ')).toBe('github');
    });
  });

  describe('recordLoginEvent', () => {
    it('Supabase에 로그인 이벤트를 기록한다', async () => {
      // Given: 정상 요청과 Supabase 성공 응답
      mockInsert.mockResolvedValue({ error: null });
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.1',
          'user-agent': 'Mozilla/5.0',
        },
      });

      // When: 로그인 이벤트 기록
      const result = await recordLoginEvent({
        request,
        provider: 'guest',
        success: true,
        sessionId: 'session-abc',
      });

      // Then: 성공 반환
      expect(result).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          resource_type: 'auth',
          action_type: 'login',
          request_method: 'POST',
          ip_address: '203.0.113.1',
        })
      );
    });

    it('Supabase 환경변수가 없으면 기록을 건너뛴다', async () => {
      // Given: 환경변수 없음
      process.env.SUPABASE_SERVICE_ROLE_KEY = '';
      const request = new NextRequest('http://localhost:3000/api/auth/login');

      // When: 이벤트 기록 시도
      const result = await recordLoginEvent({
        request,
        provider: 'guest',
        success: true,
      });

      // Then: false 반환, Supabase 호출 없음
      expect(result).toBe(false);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('Supabase 삽입 실패 시 false를 반환한다', async () => {
      // Given: Supabase 에러 응답
      mockInsert.mockResolvedValue({
        error: { message: 'insert failed' },
      });
      const request = new NextRequest('http://localhost:3000/api/auth/login');

      // When: 이벤트 기록
      const result = await recordLoginEvent({
        request,
        provider: 'github',
        success: true,
        userId: '550e8400-e29b-41d4-a716-446655440000',
        userEmail: 'user@example.com',
      });

      // Then: false 반환 (로그인 플로우는 중단하지 않음)
      expect(result).toBe(false);
    });

    it('login_blocked 액션 타입을 기록한다', async () => {
      // Given: 차단된 로그인 시도
      mockInsert.mockResolvedValue({ error: null });
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        headers: { 'x-real-ip': '10.0.0.1' },
      });

      // When: 차단 이벤트 기록
      await recordLoginEvent({
        request,
        provider: 'guest',
        actionType: 'login_blocked',
        success: false,
        errorMessage: 'PIN brute force detected',
        metadata: { reason: 'pin_locked' },
      });

      // Then: action_type과 에러 메시지 포함
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: 'login_blocked',
          success: false,
          error_message: 'PIN brute force detected',
        })
      );
    });

    it('유효하지 않은 UUID 형식의 userId는 null로 저장한다', async () => {
      // Given: UUID가 아닌 userId
      mockInsert.mockResolvedValue({ error: null });
      const request = new NextRequest('http://localhost:3000/api/auth/login');

      // When: 비-UUID userId로 이벤트 기록
      await recordLoginEvent({
        request,
        provider: 'guest',
        success: true,
        userId: 'not-a-uuid',
      });

      // Then: user_id가 null로 저장
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: null,
        })
      );
    });

    it('예외 발생 시에도 false를 반환한다', async () => {
      // Given: Supabase에서 예외 발생
      mockInsert.mockRejectedValue(new Error('network timeout'));
      const request = new NextRequest('http://localhost:3000/api/auth/login');

      // When: 이벤트 기록 시도
      const result = await recordLoginEvent({
        request,
        provider: 'guest',
        success: true,
      });

      // Then: false 반환 (로그인 플로우 중단 없음)
      expect(result).toBe(false);
    });
  });
});
