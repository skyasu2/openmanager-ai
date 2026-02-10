/**
 * Authentication & Authorization System
 *
 * 🔐 관리자 페이지 인증 및 권한 관리
 * - 다단계 인증 시스템
 * - 세션 관리 및 만료 처리
 * - 권한 레벨 관리
 * - 보안 로깅
 */

import { createHmac, randomUUID } from 'crypto';
import { logger } from '@/lib/logging';

/** HMAC 서명용 서버 비밀키 (환경변수에서 로드) */
const TOKEN_SECRET =
  process.env.AUTH_TOKEN_SECRET || process.env.CLOUD_RUN_API_SECRET || '';
export interface AuthSession {
  sessionId: string;
  userId: string;
  userRole: 'admin' | 'viewer' | 'demo';
  permissions: string[];
  createdAt: number;
  expiresAt: number;
  lastActivity: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthAttempt {
  id: string;
  timestamp: number;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
  userId?: string;
}

export class AuthManager {
  private sessions: Map<string, AuthSession> = new Map();
  private authAttempts: AuthAttempt[] = [];
  private blockedIPs: Map<string, number> = new Map(); // IP -> 차단 해제 시간
  private readonly SESSION_DURATION = 60 * 60 * 1000; // 1시간

  /**
   * 데모 사용자 인증 (간소화된 인증)
   */
  async authenticateDemo(clientInfo: {
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    const { ipAddress, userAgent } = clientInfo;

    // IP 차단 확인
    if (this.isIPBlocked(ipAddress)) {
      return {
        success: false,
        error: 'IP가 일시적으로 차단되었습니다.',
      };
    }

    // 데모 세션 생성
    const sessionId = this.generateSessionId();
    const session: AuthSession = {
      sessionId,
      userId: `demo_${Date.now()}`,
      userRole: 'demo',
      permissions: ['ai_agent:read', 'dashboard:view', 'demo:access'],
      createdAt: Date.now(),
      expiresAt: Date.now() + this.SESSION_DURATION,
      lastActivity: Date.now(),
      ipAddress,
      userAgent,
    };

    this.sessions.set(sessionId, session);

    logger.info(`🎮 Demo user authenticated: ${session.userId} (${sessionId})`);
    return { success: true, sessionId };
  }

  /**
   * 세션 검증
   */
  validateSession(sessionId: string): AuthSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // 세션 만료 확인
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      logger.info(`⏰ Session expired: ${sessionId}`);
      return null;
    }

    // 활동 시간 업데이트
    session.lastActivity = Date.now();
    return session;
  }

  /**
   * 권한 확인
   */
  hasPermission(sessionId: string, permission: string): boolean {
    const session = this.validateSession(sessionId);
    if (!session) return false;

    return (
      session.permissions.includes(permission) ||
      session.permissions.includes('system:admin')
    );
  }

  /**
   * 세션 무효화
   */
  invalidateSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.sessions.delete(sessionId);
    logger.info(`🚪 Session invalidated: ${sessionId}`);
    return true;
  }

  /**
   * 모든 세션 무효화 (보안 사고 시)
   */
  invalidateAllSessions(userId?: string): number {
    let count = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (!userId || session.userId === userId) {
        this.sessions.delete(sessionId);
        count++;
      }
    }

    logger.info(
      `🚨 Invalidated ${count} sessions${userId ? ` for user: ${userId}` : ''}`
    );
    return count;
  }

  /**
   * 활성 세션 조회
   */
  getActiveSessions(): AuthSession[] {
    const now = Date.now();
    const activeSessions: AuthSession[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt > now) {
        activeSessions.push(session);
      } else {
        this.sessions.delete(sessionId);
      }
    }

    return activeSessions;
  }

  /**
   * 인증 통계
   */
  getAuthStats() {
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;

    const recent24hAttempts = this.authAttempts.filter(
      (a) => a.timestamp >= last24h
    );
    const successfulAttempts = recent24hAttempts.filter((a) => a.success);
    const failedAttempts = recent24hAttempts.filter((a) => !a.success);

    const activeSessions = this.getActiveSessions();

    return {
      activeSessions: activeSessions.length,
      adminSessions: activeSessions.filter((s) => s.userRole === 'admin')
        .length,
      demoSessions: activeSessions.filter((s) => s.userRole === 'demo').length,

      last24h: {
        totalAttempts: recent24hAttempts.length,
        successfulAttempts: successfulAttempts.length,
        failedAttempts: failedAttempts.length,
        successRate:
          recent24hAttempts.length > 0
            ? (successfulAttempts.length / recent24hAttempts.length) * 100
            : 0,
      },

      blockedIPs: Array.from(this.blockedIPs.entries()).map(
        ([ip, unblockTime]) => ({
          ip,
          unblockTime,
          remainingTime: Math.max(0, unblockTime - now),
        })
      ),

      recentFailures: failedAttempts.slice(-10),
    };
  }

  /**
   * 브라우저 기반 인증 토큰 생성 (HMAC 서명)
   */
  generateBrowserToken(sessionId: string): string {
    const session = this.validateSession(sessionId);
    if (!session) throw new Error('Invalid session');

    const tokenData = {
      sessionId,
      userId: session.userId,
      role: session.userRole,
      expiresAt: session.expiresAt,
      timestamp: Date.now(),
    };

    const payloadB64 = Buffer.from(JSON.stringify(tokenData)).toString(
      'base64url'
    );
    const signature = createHmac('sha256', TOKEN_SECRET)
      .update(payloadB64)
      .digest('base64url');

    return `${payloadB64}.${signature}`;
  }

  /**
   * 브라우저 토큰 검증 (HMAC 서명 확인)
   */
  validateBrowserToken(token: string): AuthSession | null {
    try {
      const dotIndex = token.indexOf('.');
      if (dotIndex === -1) return null;

      const payloadB64 = token.substring(0, dotIndex);
      const signature = token.substring(dotIndex + 1);

      // HMAC 서명 검증
      const expectedSignature = createHmac('sha256', TOKEN_SECRET)
        .update(payloadB64)
        .digest('base64url');

      if (signature !== expectedSignature) {
        logger.warn('[Auth] Browser token signature mismatch');
        return null;
      }

      const tokenData = JSON.parse(
        Buffer.from(payloadB64, 'base64url').toString()
      );
      return this.validateSession(tokenData.sessionId);
    } catch {
      return null;
    }
  }

  private isIPBlocked(ipAddress?: string): boolean {
    if (!ipAddress) return false;

    const blockUntil = this.blockedIPs.get(ipAddress);
    if (!blockUntil) return false;

    if (Date.now() > blockUntil) {
      this.blockedIPs.delete(ipAddress);
      return false;
    }

    return true;
  }

  private generateSessionId(): string {
    return `session_${randomUUID()}`;
  }

  /**
   * 정리 작업
   */
  cleanup(): void {
    // 만료된 세션 정리
    const now = Date.now();
    let cleanedSessions = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
        cleanedSessions++;
      }
    }

    // 만료된 IP 차단 정리
    let cleanedBlocks = 0;
    for (const [ip, unblockTime] of this.blockedIPs.entries()) {
      if (unblockTime < now) {
        this.blockedIPs.delete(ip);
        cleanedBlocks++;
      }
    }

    // 오래된 인증 시도 기록 정리 (7일 이상)
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    const originalLength = this.authAttempts.length;
    this.authAttempts = this.authAttempts.filter((a) => a.timestamp >= cutoff);
    const cleanedAttempts = originalLength - this.authAttempts.length;

    if (cleanedSessions > 0 || cleanedBlocks > 0 || cleanedAttempts > 0) {
      logger.info(
        `🧹 Auth cleanup: ${cleanedSessions} sessions, ${cleanedBlocks} IP blocks, ${cleanedAttempts} auth attempts`
      );
    }
  }
}

// 싱글톤 인스턴스
export const authManager = new AuthManager();

/**
 * 미들웨어 헬퍼 함수들
 */
export function requireAuth(requiredPermission?: string) {
  return (sessionId: string): boolean => {
    const session = authManager.validateSession(sessionId);
    if (!session) return false;

    if (requiredPermission) {
      return authManager.hasPermission(sessionId, requiredPermission);
    }

    return true;
  };
}

export function requireAdminAuth() {
  return requireAuth('system:admin');
}

export function requireAIAgentAccess() {
  return requireAuth('ai_agent:read');
}
