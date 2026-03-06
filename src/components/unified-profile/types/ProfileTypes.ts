/**
 * 🎯 Unified Profile Component Types
 *
 * 통합 프로필 컴포넌트의 모든 타입 정의
 *
 * @created 2025-06-09
 * @author AI Assistant
 */

import type { ReactNode, RefObject } from 'react';

// 기본 컴포넌트 Props
export interface UnifiedProfileComponentProps {
  userName?: string;
  userAvatar?: string;
}

// 드롭다운 위치 정보
export interface DropdownPosition {
  top: number;
  left: number;
  transformOrigin: string;
}

// 설정 데이터 구조
export interface SettingsData {
  metrics: {
    interval: number;
    realistic: boolean;
  };
  scenarios: {
    active: number;
    total: number;
  };
  thresholds: {
    cpu: number;
    memory: number;
    disk: number;
  };
  dashboard: {
    layout: string;
    widgets: number;
  };
  notifications: {
    email: boolean;
    webhook: boolean;
  };
  backup: {
    lastBackup: string;
    autoBackup: boolean;
  };
  theme: string;
}

// 제너레이터 설정
export interface GeneratorConfig {
  serverCount: number;
  architecture: string;
  isActive: boolean;
  lastUpdate: string;
}

// 설정 탭 타입
export type SettingsTab =
  | 'ai'
  | 'generator'
  | 'monitor'
  | 'optimization'
  | 'general';

// 설정 패널 Props
export interface UnifiedSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}

// 인증 관련 인터페이스
export interface AuthenticationState {
  attempts: number;
  isLocked: boolean;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  showPassword: boolean;
}

export interface ProfileApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 설정 액션 타입
export interface SettingsAction {
  type: 'LOAD' | 'UPDATE' | 'RESET' | 'ERROR';
  payload?: unknown;
  error?: string;
}

// 프로필 버튼 Props
export interface ProfileButtonProps {
  userName: string;
  userAvatar?: string;
  isOpen: boolean;
  onClick: (e: MouseEvent) => void;
  buttonRef: RefObject<HTMLButtonElement>;
}

// 드롭다운 메뉴 Props
export interface DropdownMenuProps {
  isOpen: boolean;
  position: DropdownPosition;
  onClose: () => void;
  onSystemToggle: () => void;
  onSettingsClick: () => void;
  onLogout: () => void;
  onAIDisable: () => void;
}

// 설정 탭 내용 Props
export interface SettingsTabContentProps {
  activeTab: SettingsTab;
  settingsData: SettingsData;
  isLoadingSettings: boolean;
  generatorConfig: GeneratorConfig | null;
  isGeneratorLoading: boolean;
  authState: AuthenticationState;
  onTabChange: (tab: SettingsTab) => void;
  onQuickActivation: () => void;
  onAIAuthentication: (password?: string) => Promise<void>;
  onAIDisable: () => void;
  onGeneratorCheck: () => void;
  onServerCountChange: (count: number) => Promise<void>;
  onArchitectureChange: (arch: string) => Promise<void>;
}

// 토스트 메시지 타입
export interface ToastMessage {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

// 유틸리티 타입
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}

export type SettingsAPIResponse = ProfileApiResponse;

export interface SystemStatus {
  isRunning: boolean;
  isLocked: boolean;
  aiAgentEnabled: boolean;
  aiAgentAuthenticated: boolean;
}

export interface MenuItemProps {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  variant?: 'default' | 'warning' | 'danger';
  disabled?: boolean;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  // Slack 설정 제거됨 (포트폴리오용)
}
