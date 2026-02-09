'use client';

// framer-motion 제거 - CSS 애니메이션 사용
import {
  BarChart3,
  ChevronDown,
  LogOut,
  Power,
  Shield,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
// 프로필 컴포넌트 임포트
import {
  ProfileAvatar,
  UserTypeIcon,
} from '@/components/unified-profile/components/ProfileAvatar';
import { ProfileDropdownMenu } from '@/components/unified-profile/components/ProfileDropdownMenu';
import { EnhancedProfileStatusDisplay } from '@/components/unified-profile/EnhancedProfileStatusDisplay';
// 프로필 훅 임포트
import { useProfileAuth } from '@/components/unified-profile/hooks/useProfileAuth';
import { useProfileMenu } from '@/components/unified-profile/hooks/useProfileMenu';
// 타입 임포트
import type {
  MenuItem,
  UnifiedProfileHeaderProps,
} from '@/components/unified-profile/types/profile.types';
import { useSystemStatus } from '@/hooks/useSystemStatus';
import { logger } from '@/lib/logging';
import { useUnifiedAdminStore } from '@/stores/useUnifiedAdminStore';

/**
 * 통합 프로필 헤더 컴포넌트 (리팩토링 버전)
 * 모든 페이지에서 일관된 프로필 UI 제공
 */
export default function UnifiedProfileHeader({
  className = '',
}: Omit<UnifiedProfileHeaderProps, 'onSystemStop' | 'parentSystemActive'>) {
  // 훅 사용
  const {
    userInfo,
    userType,
    status,
    handleLogout,
    navigateToLogin,
    navigateToDashboard,
  } = useProfileAuth();

  const { menuState, dropdownRef, toggleMenu, closeMenu } = useProfileMenu();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const { status: systemStatus } = useSystemStatus();
  // 🎯 Zustand selector 패턴 사용 - 불필요한 리렌더 방지
  const isSystemStarted = useUnifiedAdminStore(
    (state) => state.isSystemStarted
  );
  const stopSystem = useUnifiedAdminStore((state) => state.stopSystem);

  // 시스템 종료 핸들러 - useUnifiedAdminStore.stopSystem 직접 사용
  const handleSystemStop = useCallback(async () => {
    const confirmed = confirm(
      '⚠️ 시스템을 종료하시겠습니까?\n\n종료 후 메인 페이지에서 다시 시작할 수 있습니다.'
    );

    if (!confirmed) return;

    try {
      closeMenu();
      logger.info('🛑 시스템 종료 요청 (프로필에서)');

      // useUnifiedAdminStore.stopSystem() 직접 호출
      stopSystem();
      logger.info('✅ 시스템 종료 성공 (Unified Store 직접 사용)');
      localStorage.removeItem('system_auto_shutdown');
    } catch (error) {
      logger.error('❌ 시스템 종료 오류:', error);
      alert('❌ 시스템 종료 중 오류가 발생했습니다.');
    }
  }, [closeMenu, stopSystem]);

  // 관리자 인증 핸들러
  const handleLogoutClick = useCallback(async () => {
    const success = await handleLogout();
    if (success) {
      closeMenu();
    }
  }, [closeMenu, handleLogout]);

  // 메뉴 아이템 구성
  const menuItems = useMemo<MenuItem[]>(() => {
    const items: MenuItem[] = [];

    // 🎯 시스템 관리 메뉴 (GitHub + 게스트 공통 - 게스트도 모든 기능 사용 가능)
    // 로컬 상태 우선 + 서버 상태 보조로 즉시 반영 (논리합 사용)
    if (isSystemStarted || systemStatus?.isRunning) {
      items.push({
        id: 'dashboard',
        label: '대시보드 열기',
        icon: BarChart3,
        action: () => {
          closeMenu();
          setTimeout(() => navigateToDashboard(), 100);
        },
        visible: true,
        badge: '모니터링',
      });

      items.push({
        id: 'system-stop',
        label: `시스템 종료 (${systemStatus?.userCount || 1}명 접속 중)`,
        icon: Power,
        action: handleSystemStop,
        visible: true,
        danger: true,
        badge: '확인 후 종료',
      });
    }

    // 게스트 사용자 전용 메뉴 (GitHub 계정 연동 안내)
    if (userType === 'guest') {
      items.push({
        id: 'github-login',
        label: 'GitHub로 로그인',
        icon: Shield,
        action: () => {
          closeMenu();
          setTimeout(() => navigateToLogin(), 100);
        },
        visible: true,
        badge: '계정 연동',
        dividerBefore: items.length > 0, // 시스템 메뉴가 있을 때만 구분선
      });
    }

    // 로그아웃 메뉴
    items.push({
      id: 'logout',
      label:
        userType === 'github'
          ? 'GitHub 로그아웃'
          : userType === 'google'
            ? 'Google 로그아웃'
            : '게스트 세션 종료',
      icon: LogOut,
      action: handleLogoutClick,
      visible: true,
      danger: true,
      badge: '확인 후 종료',
      dividerBefore: true,
    });

    return items;
  }, [
    userType,
    systemStatus,
    isSystemStarted,
    closeMenu,
    navigateToDashboard,
    navigateToLogin,
    handleSystemStop,
    handleLogoutClick,
  ]);

  // 사용자 정보 가져오기
  const getUserName = () => {
    if (userInfo) {
      return (
        userInfo.name ||
        userInfo.email ||
        (userType === 'github'
          ? 'GitHub 사용자'
          : userType === 'google'
            ? 'Google 사용자'
            : '게스트 사용자')
      );
    }
    return status === 'loading' ? '로딩 중...' : '사용자';
  };

  if (!isHydrated) {
    return (
      <div
        suppressHydrationWarning
        ref={dropdownRef}
        className={`relative z-50 ${className}`}
        aria-hidden="true"
      >
        <div className="h-12 w-32 animate-pulse rounded-full bg-gray-200" />
      </div>
    );
  }

  // 비로그인 상태: 로그인 버튼만 표시
  if (userType === 'unknown' && status !== 'loading') {
    return (
      <div ref={dropdownRef} className={`relative z-50 ${className}`}>
        <button
          type="button"
          onClick={navigateToLogin}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          data-testid="login-button"
        >
          <User className="h-4 w-4" />
          로그인
        </button>
      </div>
    );
  }

  return (
    <div
      suppressHydrationWarning
      ref={dropdownRef}
      className={`relative z-50 ${className}`}
    >
      {/* 프로필 버튼 */}
      <button
        type="button"
        onClick={() => {
          logger.info('👤 프로필 버튼 클릭됨');
          toggleMenu();
        }}
        className="group pointer-events-auto relative z-50 flex cursor-pointer items-center space-x-3 rounded-lg p-3 transition-all duration-200 hover:bg-gray-100"
        aria-label="프로필 메뉴"
        aria-expanded={menuState.showProfileMenu}
        aria-haspopup="true"
        id="profile-menu-button"
        data-testid="profile-dropdown-trigger"
      >
        {/* 프로필 아바타 */}
        <ProfileAvatar userInfo={userInfo} userType={userType} size="medium" />

        {/* 사용자 정보 */}
        <div className="hidden text-left sm:block">
          <div className="flex items-center gap-1 text-sm font-medium text-gray-900">
            {getUserName()}
            <UserTypeIcon userType={userType} className="h-3 w-3" />
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            {userType === 'github'
              ? 'GitHub 로그인'
              : userType === 'google'
                ? 'Google 로그인'
                : userType === 'guest'
                  ? '게스트 로그인'
                  : status === 'loading'
                    ? '확인 중...'
                    : '로그인 필요'}
            {status === 'loading' && (
              <div className="animate-pulse h-2 w-2 rounded-full bg-gray-400" />
            )}
          </div>
        </div>

        {/* 드롭다운 화살표 */}
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
            menuState.showProfileMenu ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 프로필 드롭다운 메뉴 */}
      <ProfileDropdownMenu
        isOpen={menuState.showProfileMenu}
        menuItems={menuItems}
        userInfo={userInfo}
        userType={userType}
        onClose={closeMenu}
      />

      {/* 시스템 상태 표시 (GitHub + 게스트 공통 - 드롭다운 내부에 위치) */}
      {menuState.showProfileMenu && (
        <div className="absolute right-0 z-9998 mt-[280px] w-64">
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
            <EnhancedProfileStatusDisplay compact={false} />
          </div>
        </div>
      )}
    </div>
  );
}
