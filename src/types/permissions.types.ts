/**
 * 🔐 Permission Types
 *
 * 사용자 권한 관련 TypeScript 타입 정의
 */

export type UserType = 'github' | 'guest' | 'loading' | 'anonymous';

export interface UserPermissions {
  // 시스템 제어 권한
  canControlSystem: boolean;
  canAccessSettings: boolean;
  canToggleAdminMode: boolean;
  canLogout: boolean;

  // 페이지 접근 권한 (새로운 3단계 시스템)
  canAccessMainPage: boolean;
  canAccessDashboard: boolean;
  canAccessAdminPage: boolean;

  // 사용자 유형
  isGeneralUser: boolean;
  isAdmin: boolean;
  isGitHubAuthenticated: boolean;
  isPinAuthenticated: boolean; // PIN 인증 상태

  // AI 관련 권한 (모든 사용자 가능)
  canToggleAI: boolean;

  // 사용자 정보
  userType: UserType;
  userName: string;
  userAvatar?: string;
}

export interface PermissionConfig {
  // 권한별 기능 매핑
  systemControl: {
    requiredPermission: keyof UserPermissions;
    fallbackBehavior: 'hide' | 'disable' | 'redirect';
  };
  settings: {
    requiredPermission: keyof UserPermissions;
    fallbackBehavior: 'hide' | 'disable' | 'redirect';
  };
  adminMode: {
    requiredPermission: keyof UserPermissions;
    fallbackBehavior: 'hide' | 'disable' | 'redirect';
  };
  logout: {
    requiredPermission: keyof UserPermissions;
    fallbackBehavior: 'hide' | 'disable' | 'redirect';
  };
  // 새로운 페이지 접근 권한
  mainPage: {
    requiredPermission: keyof UserPermissions;
    fallbackBehavior: 'hide' | 'disable' | 'redirect';
  };
  dashboard: {
    requiredPermission: keyof UserPermissions;
    fallbackBehavior: 'hide' | 'disable' | 'redirect';
  };
  adminPage: {
    requiredPermission: keyof UserPermissions;
    fallbackBehavior: 'hide' | 'disable' | 'redirect';
  };
}

// 기본 권한 설정
const _DEFAULT_PERMISSION_CONFIG: PermissionConfig = {
  systemControl: {
    requiredPermission: 'canControlSystem',
    fallbackBehavior: 'hide',
  },
  settings: {
    requiredPermission: 'canAccessSettings',
    fallbackBehavior: 'hide',
  },
  adminMode: {
    requiredPermission: 'canToggleAdminMode',
    fallbackBehavior: 'hide',
  },
  logout: {
    requiredPermission: 'canLogout',
    fallbackBehavior: 'hide',
  },
  // 새로운 페이지 접근 권한 설정
  mainPage: {
    requiredPermission: 'canAccessMainPage',
    fallbackBehavior: 'redirect',
  },
  dashboard: {
    requiredPermission: 'canAccessDashboard',
    fallbackBehavior: 'redirect',
  },
  adminPage: {
    requiredPermission: 'canAccessAdminPage',
    fallbackBehavior: 'redirect',
  },
};
