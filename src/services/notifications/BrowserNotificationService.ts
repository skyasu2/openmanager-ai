/**
 * 🔔 브라우저 웹 알림 서비스 (Vercel 최적화)
 *
 * 특징:
 * - 서버 데이터 생성기의 심각/경고 상태 알림만 처리
 * - 통합 상태 판별 기준 사용
 * - 과도한 타이머 제거, 단순한 로직
 * - 30분 세션 기반 전역 상태 관리와 연동
 */

'use client';

import { shouldSendWebNotification } from '@/config/rules/loader';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logging';

interface NotificationOptions {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  serverId?: string;
  type: 'server_alert' | 'system_alert' | 'user_action';
  icon?: string;
  tag?: string;
  silent?: boolean;
}

class BrowserNotificationService {
  private isEnabled: boolean = false;
  private permission: NotificationPermission = 'default';
  private notificationHistory: NotificationOptions[] = [];

  // 서버별 이전 상태 추적 (상태 변화 감지용)
  private previousServerStates = new Map<
    string,
    'online' | 'warning' | 'critical'
  >();

  constructor() {
    void this._initializePermission();
  }

  /**
   * 🔔 권한 초기화 (SSR 최적화)
   */
  private async _initializePermission(): Promise<void> {
    // 🚀 서버사이드 렌더링 환경 체크 (로그 스팸 완전 제거)
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      // SSR 환경에서는 조용히 비활성화 (로그 없음)
      this.isEnabled = false;
      this.permission = 'default';
      return;
    }

    if (!('Notification' in window)) {
      logger.warn('⚠️ 이 브라우저는 웹 알림을 지원하지 않습니다');
      return;
    }

    this.permission = Notification.permission;

    if (this.permission === 'default') {
      try {
        this.permission = await Notification.requestPermission();
        this.isEnabled = this.permission === 'granted';

        if (this.isEnabled) {
          logger.info('✅ 웹 알림 권한이 허용되었습니다');
        }
      } catch (error) {
        logger.error('❌ 웹 알림 권한 요청 실패:', error);
      }
    } else {
      this.isEnabled = this.permission === 'granted';
    }
  }

  /**
   * 🚨 서버 상태 알림 처리 (통합 기준 사용)
   */
  processServerNotification(
    serverId: string,
    serverName: string,
    currentStatus: 'online' | 'warning' | 'critical'
  ): void {
    const previousStatus = this.previousServerStates.get(serverId);

    // 통합 기준으로 알림 발송 여부 결정
    if (shouldSendWebNotification(currentStatus, previousStatus)) {
      const message = this.getStatusMessage(
        serverName,
        currentStatus,
        previousStatus
      );
      const variant =
        currentStatus === 'critical'
          ? 'destructive'
          : currentStatus === 'warning'
            ? 'warning'
            : 'success';

      // 🔔 서버 알림은 이제 Toast로 표시 (좌측 하단)
      toast({
        title: serverName,
        description: message,
        variant: variant,
      });

      logger.info(`💬 Toast 알림 발송: ${message}`);
    }

    // 현재 상태 저장
    this.previousServerStates.set(serverId, currentStatus);
  }

  /**
   * 📝 상태별 메시지 생성
   */
  private getStatusMessage(
    serverName: string,
    currentStatus: 'online' | 'warning' | 'critical',
    previousStatus?: 'online' | 'warning' | 'critical'
  ): string {
    if (currentStatus === 'critical') {
      return `${serverName} 서버가 심각한 상태입니다`;
    }

    if (currentStatus === 'warning' && previousStatus === 'online') {
      return `${serverName} 서버에 주의가 필요합니다`;
    }

    if (
      previousStatus === 'critical' &&
      (currentStatus === 'warning' || currentStatus === 'online')
    ) {
      return `${serverName} 서버가 복구되었습니다`;
    }

    return `${serverName} 서버 상태가 변경되었습니다`;
  }

  /**
   * 🔔 웹 알림 발송 (System Alert Only)
   * 이제 서버 알림에는 사용되지 않고, 시스템 알림(예: 30분 종료)에만 사용됨
   */
  private sendNotification(
    message: string,
    _type: 'critical' | 'warning' | 'info',
    _serverId?: string
  ): void {
    // 🚀 브라우저 환경 체크 (로그 스팸 제거)
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return; // SSR에서는 조용히 무시
    }

    if (!this.isEnabled) return;

    try {
      const notification = new Notification('OpenManager 시스템 알림', {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'system-alert',
        requireInteraction: true, // 시스템 알림은 중요하므로 상호작용 필요
        silent: false,
      });

      // 알림 클릭 이벤트
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      logger.info(`🔔 웹 알림 발송: ${message}`);
    } catch (error) {
      logger.error('❌ 웹 알림 발송 실패:', error);
    }
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      permission: this.permission,
      historyCount: this.notificationHistory.length,
      recentNotifications: this.notificationHistory.slice(0, 5),
    };
  }

  /**
   * 🔧 서비스 활성화/비활성화
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled && this.permission === 'granted';
  }

  /**
   * 🧹 히스토리 정리 (수동 호출용)
   */
  clearHistory(): void {
    this.notificationHistory = [];
    this.previousServerStates.clear();
    logger.info('🧹 서버 알림 히스토리 초기화 완료');
  }

  /**
   * 🛑 시스템 중지 알림 (새로 추가)
   */
  sendSystemShutdownNotification(reason: string = '30분 자동 종료'): void {
    if (!this.isEnabled) return;

    const _title = '🛑 OpenManager 시스템 중지';
    const message = `시스템이 중지되었습니다. (${reason})`;

    this.sendNotification(message, 'warning', 'system-shutdown');

    // 추가: 브라우저 확인 팝업 (선택사항)
    if (typeof window !== 'undefined' && reason === '30분 자동 종료') {
      setTimeout(() => {
        const userConfirm = confirm(
          '⏰ 30분 세션이 종료되었습니다.\n\n새로운 세션을 시작하시겠습니까?'
        );
        if (userConfirm) {
          // 페이지 새로고침으로 새 세션 준비
          window.location.reload();
        }
      }, 2000); // 2초 후 확인 팝업
    }
  }

  /**
   * 🚨 시스템 강제 종료 알림 (새로 추가)
   */
  sendSystemForceShutdownNotification(message: string): void {
    if (!this.isEnabled) return;

    // 브라우저 네이티브 알림
    this.sendNotification(`🚨 ${message}`, 'critical', 'force-shutdown');

    // 즉시 브라우저 알림 팝업
    if (typeof window !== 'undefined') {
      alert(
        `🚨 ${message}\n\n페이지를 새로고침하여 시스템을 다시 시작해주세요.`
      );
    }
  }
}

// 싱글톤 인스턴스
export const browserNotificationService = new BrowserNotificationService();
