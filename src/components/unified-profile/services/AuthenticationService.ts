/**
 * 🔐 Authentication Service
 *
 * AI 에이전트 인증 및 보안 관리 서비스
 *
 * @created 2025-06-09
 * @author AI Assistant
 */

import { logger } from '@/lib/logging';
import type {
  AuthenticationState,
  ProfileApiResponse,
} from '../types/ProfileTypes';

interface ProfileStore {
  authenticateAIAgent(
    password: string
  ): Promise<{ success: boolean; data?: AuthenticationState }>;
  updateAuthState(auth: AuthenticationState): void;
  agentLocked: boolean;
  apiKey?: string;
  isLocked: boolean;
  getRemainingLockTime(): number;
  attempts: number;
  disableAIAgent(): Promise<{
    success: boolean;
    error?: string;
    data?: AuthenticationState;
  }>;
  adminMode?: {
    isAuthenticated: boolean;
  };
}

// 개발 환경 설정
const DEVELOPMENT_MODE =
  process.env.NEXT_PUBLIC_NODE_ENV === 'development' ||
  process.env.NODE_ENV === 'development' ||
  typeof window !== 'undefined';
const BYPASS_PASSWORD = true; // 항상 비밀번호 우회 허용

export class AuthenticationService {
  private static instance: AuthenticationService;
  private lockTimeouts: Map<string, NodeJS.Timeout> = new Map();

  public static getInstance(): AuthenticationService {
    if (!AuthenticationService.instance) {
      AuthenticationService.instance = new AuthenticationService();
    }
    return AuthenticationService.instance;
  }

  /**
   * 빠른 활성화 (개발 모드용)
   */
  quickActivation(): Promise<ProfileApiResponse> {
    if (!DEVELOPMENT_MODE || !BYPASS_PASSWORD) {
      return Promise.resolve({
        success: false,
        error: '빠른 활성화는 개발 모드에서만 사용 가능합니다.',
      });
    }

    try {
      // 개발 모드에서는 즉시 인증 성공 처리
      return Promise.resolve({
        success: true,
        message: '🚀 AI 에이전트가 빠르게 활성화되었습니다!',
        data: { mode: 'quick-activation', timestamp: new Date().toISOString() },
      });
    } catch {
      return Promise.resolve({
        success: false,
        error: '빠른 활성화 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * AI 에이전트 인증
   */
  async authenticateAIAgent(
    password: string,
    store: ProfileStore
  ): Promise<ProfileApiResponse> {
    try {
      // 개발 모드에서 비밀번호 우회
      if (DEVELOPMENT_MODE && BYPASS_PASSWORD) {
        const result = await store.authenticateAIAgent('dev-mode');

        if (result.success) {
          return {
            success: true,
            message: '🔓 개발 모드: AI 에이전트 인증 성공',
            data: result.data,
          };
        }
      }

      // 일반 인증 로직
      if (!password || password.trim().length === 0) {
        return {
          success: false,
          error: '비밀번호를 입력해주세요.',
        };
      }

      const result = await store.authenticateAIAgent(password);

      if (result.success) {
        return {
          success: true,
          message: '✅ AI 에이전트 인증 성공',
          data: result.data,
        };
      } else {
        // 실패 시 잠금 확인
        if (store.isLocked) {
          const remainingTime = store.getRemainingLockTime();
          return {
            success: false,
            error: `🔒 너무 많은 실패로 잠금됨 (${Math.ceil(remainingTime / 1000)}초 남음)`,
          };
        } else {
          const attemptsLeft = Math.max(0, 3 - store.attempts);
          return {
            success: false,
            error: `❌ 인증 실패 (${attemptsLeft}회 남음)`,
          };
        }
      }
    } catch (error) {
      logger.error('AI 에이전트 인증 오류:', error);
      return {
        success: false,
        error: '인증 중 오류가 발생했습니다.',
      };
    }
  }

  /**
   * AI 에이전트 비활성화
   */
  async disableAIAgent(store: ProfileStore): Promise<ProfileApiResponse> {
    try {
      const result = await store.disableAIAgent();

      if (result.success) {
        return {
          success: true,
          message: '🛑 AI 에이전트가 비활성화되었습니다.',
          data: result.data,
        };
      } else {
        return {
          success: false,
          error: result.error || 'AI 에이전트 비활성화에 실패했습니다.',
        };
      }
    } catch (error) {
      logger.error('AI 에이전트 비활성화 오류:', error);
      return {
        success: false,
        error: '비활성화 중 오류가 발생했습니다.',
      };
    }
  }

  /**
   * 인증 상태 확인
   */
  getAuthenticationState(store: ProfileStore): AuthenticationState {
    return {
      attempts: store.attempts || 0,
      isLocked: store.isLocked || false,
      isAuthenticated: store.adminMode?.isAuthenticated || false,
      isAuthenticating: false, // 컴포넌트에서 관리
      showPassword: false, // 컴포넌트에서 관리
    };
  }

  /**
   * 남은 잠금 시간 계산
   */
  getRemainingLockTime(store: ProfileStore): number {
    if (!store.isLocked) return 0;
    return store.getRemainingLockTime();
  }

  /**
   * 비밀번호 검증
   */
  validatePassword(password: string): { isValid: boolean; message?: string } {
    if (!password || password.trim().length === 0) {
      return { isValid: false, message: '비밀번호를 입력해주세요.' };
    }

    if (password.length < 4) {
      return {
        isValid: false,
        message: '비밀번호는 최소 4자 이상이어야 합니다.',
      };
    }

    return { isValid: true };
  }

  /**
   * 개발 모드 확인
   */
  isDevelopmentMode(): boolean {
    return DEVELOPMENT_MODE;
  }

  /**
   * 비밀번호 우회 가능 여부
   */
  canBypassPassword(): boolean {
    return BYPASS_PASSWORD && DEVELOPMENT_MODE;
  }

  /**
   * 자동 잠금 해제 타이머 설정
   */
  setAutoUnlockTimer(
    userId: string,
    duration: number,
    callback: () => void
  ): void {
    // 기존 타이머가 있다면 제거
    if (this.lockTimeouts.has(userId)) {
      clearTimeout(this.lockTimeouts.get(userId));
    }

    // 새 타이머 설정
    const timeoutId = setTimeout(() => {
      callback();
      this.lockTimeouts.delete(userId);
    }, duration);

    this.lockTimeouts.set(userId, timeoutId);
  }

  /**
   * 잠금 해제 타이머 제거
   */
  clearAutoUnlockTimer(userId: string): void {
    if (this.lockTimeouts.has(userId)) {
      clearTimeout(this.lockTimeouts.get(userId));
      this.lockTimeouts.delete(userId);
    }
  }

  /**
   * 모든 타이머 정리
   */
  clearAllTimers(): void {
    this.lockTimeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    this.lockTimeouts.clear();
  }

  /**
   * 보안 이벤트 로깅
   */
  logSecurityEvent(event: string, details: unknown): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      userAgent:
        typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      ip: 'local', // 실제 구현에서는 IP 추적 가능
    };

    logger.info('🔒 보안 이벤트:', logEntry);

    // 필요시 서버로 보안 로그 전송
    if (event === 'auth_failure' || event === 'account_locked') {
      void this.sendSecurityLog(logEntry);
    }
  }

  /**
   * 보안 로그 서버 전송
   */
  private async sendSecurityLog(logEntry: unknown): Promise<void> {
    try {
      await fetch('/api/security/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      logger.warn('보안 로그 전송 실패:', error);
    }
  }
}
