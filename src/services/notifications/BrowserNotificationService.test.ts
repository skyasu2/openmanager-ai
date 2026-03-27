/**
 * BrowserNotificationService Unit Tests
 *
 * 서버 상태 알림 로직, 상태 추적, 메시지 생성을 테스트.
 * 브라우저 API는 mock 처리.
 *
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks ---

const { mockShouldSendWebNotification, mockToast, mockLogger } = vi.hoisted(
  () => ({
    mockShouldSendWebNotification: vi.fn(),
    mockToast: vi.fn(),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  })
);

vi.mock('@/config/rules/loader', () => ({
  shouldSendWebNotification: mockShouldSendWebNotification,
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: mockToast,
}));

vi.mock('@/lib/logging', () => ({
  logger: mockLogger,
}));

// Import after mocks
import { browserNotificationService } from './BrowserNotificationService';

// --- Tests ---

describe('BrowserNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browserNotificationService.clearHistory();
  });

  describe('processServerNotification', () => {
    it('should send toast when shouldSendWebNotification returns true', () => {
      mockShouldSendWebNotification.mockReturnValue(true);

      browserNotificationService.processServerNotification(
        'web-01',
        'Web Server 01',
        'critical'
      );

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Web Server 01',
          variant: 'destructive',
        })
      );
    });

    it('should not send toast when shouldSendWebNotification returns false', () => {
      mockShouldSendWebNotification.mockReturnValue(false);

      browserNotificationService.processServerNotification(
        'web-01',
        'Web Server 01',
        'online'
      );

      expect(mockToast).not.toHaveBeenCalled();
    });

    it('should track previous server state', () => {
      mockShouldSendWebNotification.mockReturnValue(false);

      browserNotificationService.processServerNotification(
        'web-01',
        'Web Server 01',
        'online'
      );

      // Second call should pass 'online' as previousStatus
      browserNotificationService.processServerNotification(
        'web-01',
        'Web Server 01',
        'warning'
      );

      expect(mockShouldSendWebNotification).toHaveBeenLastCalledWith(
        'warning',
        'online'
      );
    });

    it('should use warning variant for warning status', () => {
      mockShouldSendWebNotification.mockReturnValue(true);

      browserNotificationService.processServerNotification(
        'web-01',
        'Web Server 01',
        'warning'
      );

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'warning' })
      );
    });

    it('should use success variant for online status', () => {
      mockShouldSendWebNotification.mockReturnValue(true);

      browserNotificationService.processServerNotification(
        'web-01',
        'Web Server 01',
        'online'
      );

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' })
      );
    });

    it('should pass undefined previousStatus on first notification', () => {
      mockShouldSendWebNotification.mockReturnValue(false);

      browserNotificationService.processServerNotification(
        'new-server',
        'New Server',
        'online'
      );

      expect(mockShouldSendWebNotification).toHaveBeenCalledWith(
        'online',
        undefined
      );
    });

    it('should generate critical status message', () => {
      mockShouldSendWebNotification.mockReturnValue(true);

      browserNotificationService.processServerNotification(
        'db-01',
        'DB Server',
        'critical'
      );

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'DB Server 서버가 심각한 상태입니다',
        })
      );
    });

    it('should generate warning message when transitioning from online', () => {
      mockShouldSendWebNotification.mockReturnValue(true);

      // First set previous state to online
      mockShouldSendWebNotification.mockReturnValueOnce(false);
      browserNotificationService.processServerNotification(
        'web-01',
        'Web Server',
        'online'
      );

      // Then transition to warning
      mockShouldSendWebNotification.mockReturnValueOnce(true);
      browserNotificationService.processServerNotification(
        'web-01',
        'Web Server',
        'warning'
      );

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Web Server 서버에 주의가 필요합니다',
        })
      );
    });

    it('should generate recovery message when transitioning from critical', () => {
      mockShouldSendWebNotification.mockReturnValue(true);

      // Set previous state to critical
      browserNotificationService.processServerNotification(
        'web-01',
        'Web Server',
        'critical'
      );
      mockToast.mockClear();

      // Recover to online
      browserNotificationService.processServerNotification(
        'web-01',
        'Web Server',
        'online'
      );

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Web Server 서버가 복구되었습니다',
        })
      );
    });

    it('should track multiple servers independently', () => {
      mockShouldSendWebNotification.mockReturnValue(false);

      browserNotificationService.processServerNotification(
        'web-01',
        'Web 01',
        'online'
      );
      browserNotificationService.processServerNotification(
        'db-01',
        'DB 01',
        'warning'
      );

      // web-01 should have previousStatus 'online'
      browserNotificationService.processServerNotification(
        'web-01',
        'Web 01',
        'warning'
      );
      expect(mockShouldSendWebNotification).toHaveBeenLastCalledWith(
        'warning',
        'online'
      );

      // db-01 should have previousStatus 'warning'
      browserNotificationService.processServerNotification(
        'db-01',
        'DB 01',
        'critical'
      );
      expect(mockShouldSendWebNotification).toHaveBeenLastCalledWith(
        'critical',
        'warning'
      );
    });
  });

  describe('getStatus', () => {
    it('should return status object', () => {
      const status = browserNotificationService.getStatus();

      expect(status).toHaveProperty('isEnabled');
      expect(status).toHaveProperty('permission');
      expect(status).toHaveProperty('historyCount');
      expect(status).toHaveProperty('recentNotifications');
      expect(typeof status.isEnabled).toBe('boolean');
    });
  });

  describe('setEnabled', () => {
    it('should not enable when permission is not granted', () => {
      browserNotificationService.setEnabled(true);
      const status = browserNotificationService.getStatus();

      // In node env, permission is 'default', so isEnabled should stay false
      expect(status.isEnabled).toBe(false);
    });
  });

  describe('clearHistory', () => {
    it('should clear notification history and server states', () => {
      mockShouldSendWebNotification.mockReturnValue(false);

      browserNotificationService.processServerNotification(
        'web-01',
        'Web',
        'critical'
      );
      browserNotificationService.clearHistory();

      // After clear, previous state should be undefined
      browserNotificationService.processServerNotification(
        'web-01',
        'Web',
        'warning'
      );
      expect(mockShouldSendWebNotification).toHaveBeenLastCalledWith(
        'warning',
        undefined
      );
    });
  });
});
