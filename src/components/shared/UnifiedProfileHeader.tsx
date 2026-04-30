'use client';

import { BarChart3, ChevronDown, LogIn, LogOut, User } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
// 프로필 컴포넌트 임포트
import {
  ProfileAvatar,
  UserTypeIcon,
} from '@/components/unified-profile/components/ProfileAvatar';
import { ProfileDropdownMenu } from '@/components/unified-profile/components/ProfileDropdownMenu';
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
    isLoading: isProfileLoading,
    handleLogout,
    navigateToLogin,
    navigateToDashboard,
  } = useProfileAuth();

  const { menuState, dropdownRef, toggleMenu, closeMenu } = useProfileMenu();
  const [isHydrated, setIsHydrated] = useState(false);
  const isAuthResolving = status === 'loading' || isProfileLoading;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const { status: systemStatus } = useSystemStatus({
    enabled: !isAuthResolving && status === 'authenticated',
  });
  // 🎯 Zustand selector 패턴 사용 - 불필요한 리렌더 방지
  const isSystemStarted = useUnifiedAdminStore(
    (state) => state.isSystemStarted
  );
  const stopSystem = useUnifiedAdminStore((state) => state.stopSystem);
  const startSystem = useUnifiedAdminStore((state) => state.startSystem);

  // 시스템 시작 핸들러
  const handleSystemStart = useCallback(() => {
    try {
      logger.info('🚀 시스템 시작 요청 (프로필에서)');
      startSystem();
      logger.info('✅ 시스템 시작 성공');
    } catch (error) {
      logger.error('❌ 시스템 시작 오류:', error);
      alert('❌ 시스템 시작 중 오류가 발생했습니다.');
    }
  }, [startSystem]);

  // 시스템 종료 핸들러 - useUnifiedAdminStore.stopSystem 직접 사용
  const handleSystemStop = useCallback(() => {
    const confirmed = confirm(
      '⚠️ 시스템을 종료하시겠습니까?\n\n종료 후 메인 페이지에서 다시 시작할 수 있습니다.'
    );

    if (!confirmed) return;

    try {
      logger.info('🛑 시스템 종료 요청 (프로필에서)');

      // useUnifiedAdminStore.stopSystem() 직접 호출
      stopSystem();
      logger.info('✅ 시스템 종료 성공 (Unified Store 직접 사용)');
      localStorage.removeItem('system_auto_shutdown');
    } catch (error) {
      logger.error('❌ 시스템 종료 오류:', error);
      alert('❌ 시스템 종료 중 오류가 발생했습니다.');
    }
  }, [stopSystem]);

  // 관리자 인증 핸들러
  const handleLogoutClick = useCallback(async () => {
    const success = await handleLogout();
    if (success) {
      closeMenu();
    }
  }, [closeMenu, handleLogout]);

  // 메뉴 아이템 구성 (시스템 시작/종료는 드롭다운 전용 섹션으로 이동)
  const menuItems = useMemo<MenuItem[]>(() => {
    const items: MenuItem[] = [];

    // 대시보드 열기 (시스템 실행 중일 때만)
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
    }

    // 로그인 메뉴
    if (userType === 'guest') {
      // 게스트: "로그인" → /login 페이지로 이동
      items.push({
        id: 'login',
        label: '로그인',
        icon: LogIn,
        action: () => {
          closeMenu();
          setTimeout(() => navigateToLogin(), 100);
        },
        visible: true,
        badge: '로그인 페이지',
        dividerBefore: items.length > 0,
      });
    } else if (userType === 'github' || userType === 'google') {
      // 인증 사용자: "다른 방법으로 로그인" → 현재 방식 쿼리 전달
      items.push({
        id: 'switch-login',
        label: '다른 방법으로 로그인',
        icon: LogIn,
        action: () => {
          closeMenu();
          setTimeout(
            () => window.location.assign(`/login?current=${userType}`),
            100
          );
        },
        visible: true,
        badge: '계정 전환',
        dividerBefore: items.length > 0,
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
            : '세션 종료',
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
    handleLogoutClick,
  ]);

  // 사용자 정보 가져오기
  const getUserName = () => {
    if (userInfo) {
      const normalizedName = userInfo.name?.trim();
      // 레거시 세션('Guest User')이 남아 있어도 UI 표기는 한국어로 통일
      if (
        userType === 'guest' &&
        normalizedName?.toLowerCase() === 'guest user'
      ) {
        return '게스트 사용자';
      }

      return (
        normalizedName ||
        userInfo.email ||
        (userType === 'github'
          ? 'GitHub 사용자'
          : userType === 'google'
            ? 'Google 사용자'
            : '게스트 사용자')
      );
    }
    return '사용자';
  };

  const getAvatarText = () => {
    if (userType === 'guest') return 'GU';
    if (userType === 'github') return 'GH';
    if (userType === 'google') return 'G';

    if (userInfo?.name) {
      const words = userInfo.name.split(' ');
      if (words.length >= 2 && words[0]?.[0] && words[1]?.[0]) {
        return (words[0][0] + words[1][0]).toUpperCase();
      }
      return userInfo.name.substring(0, 2).toUpperCase();
    }

    if (userInfo?.email) {
      return userInfo.email.substring(0, 2).toUpperCase();
    }

    return '?';
  };

  const getLoginStateLabel = () => {
    if (userType === 'github') return 'GitHub 로그인';
    if (userType === 'google') return 'Google 로그인';
    if (userType === 'guest') return '게스트 로그인';
    return '로그인 필요';
  };

  const userName = getUserName();
  const loginStateLabel = getLoginStateLabel();
  const profileButtonLabel = isAuthResolving
    ? '프로필 메뉴, 권한 확인 중'
    : `${getAvatarText()} ${userName} ${loginStateLabel}`;

  if (!isHydrated) {
    return (
      <div
        suppressHydrationWarning
        ref={dropdownRef}
        className={`relative z-50 ${className}`}
        aria-hidden="true"
      >
        <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 sm:h-12 sm:w-32" />
      </div>
    );
  }

  // 비로그인 상태: 로그인 버튼만 표시
  if (userType === 'unknown' && !isAuthResolving) {
    return (
      <div ref={dropdownRef} className={`relative z-50 ${className}`}>
        <button
          type="button"
          onClick={navigateToLogin}
          aria-label="로그인"
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-700 sm:w-auto sm:gap-2 sm:px-4"
          data-testid="login-button"
        >
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">로그인</span>
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
          if (isAuthResolving) {
            return;
          }
          logger.info('👤 프로필 버튼 클릭됨');
          toggleMenu();
        }}
        disabled={isAuthResolving}
        className="group pointer-events-auto relative z-50 flex h-10 w-10 items-center justify-center rounded-lg p-0 transition-all duration-200 hover:bg-gray-100 disabled:cursor-wait disabled:hover:bg-transparent sm:h-auto sm:w-auto sm:justify-start sm:space-x-3 sm:p-3"
        aria-label={profileButtonLabel}
        aria-expanded={menuState.showProfileMenu}
        aria-haspopup="true"
        aria-busy={isAuthResolving}
        id="profile-menu-button"
        data-testid="profile-dropdown-trigger"
      >
        {isAuthResolving ? (
          <>
            <div
              aria-hidden="true"
              className="h-8 w-8 animate-pulse rounded-full bg-gray-200"
            />
            <div aria-hidden="true" className="hidden space-y-1 sm:block">
              <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
              <div className="h-2.5 w-16 animate-pulse rounded bg-gray-100" />
            </div>
            <ChevronDown className="hidden h-4 w-4 text-gray-300 sm:block" />
          </>
        ) : (
          <>
            {/* 프로필 아바타 */}
            <ProfileAvatar
              userInfo={userInfo}
              userType={userType}
              size="medium"
            />

            {/* 사용자 정보 */}
            <div className="hidden text-left sm:block">
              <div className="flex items-center gap-1 text-sm font-medium text-gray-900">
                {userName}
                <UserTypeIcon userType={userType} className="h-3 w-3" />
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                {loginStateLabel}
              </div>
            </div>

            {/* 드롭다운 화살표 */}
            <ChevronDown
              className={`hidden h-4 w-4 text-gray-400 transition-transform duration-200 sm:block ${
                menuState.showProfileMenu ? 'rotate-180' : ''
              }`}
            />
          </>
        )}
      </button>

      {/* 프로필 드롭다운 메뉴 */}
      <ProfileDropdownMenu
        isOpen={menuState.showProfileMenu}
        menuItems={menuItems}
        userInfo={userInfo}
        userType={userType}
        onClose={closeMenu}
        isSystemStarted={isSystemStarted || (systemStatus?.isRunning ?? false)}
        isSystemStarting={systemStatus?.isStarting}
        onSystemStart={handleSystemStart}
        onSystemStop={handleSystemStop}
        systemVersion={systemStatus?.version}
        systemEnvironment={systemStatus?.environment}
      />
    </div>
  );
}
