'use client';

import { type KeyboardEvent, type MouseEvent, memo } from 'react';
import { logger } from '@/lib/logging';
import type { MenuItem } from '../types/profile.types';

interface ProfileMenuItemProps extends MenuItem {
  onClick?: (e: MouseEvent) => void;
}

/**
 * 프로필 메뉴 아이템 컴포넌트
 * 일관된 메뉴 아이템 UI 제공
 */
export const ProfileMenuItem = memo(function ProfileMenuItem({
  id,
  label,
  icon: Icon,
  action,
  visible,
  danger = false,
  description,
  badge,
  disabled = false,
  dividerBefore = false,
  onClick,
}: ProfileMenuItemProps) {
  if (!visible) return null;

  const handleClick = async (e: MouseEvent) => {
    e.stopPropagation();

    if (onClick) {
      onClick(e);
    }

    if (!disabled && action) {
      logger.info(`🔘 메뉴 클릭: ${label}`);
      await action();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      if (action) {
        logger.info(`🔘 메뉴 클릭: ${label}`);
        void action();
      }
    }
  };

  // 색상 클래스 결정
  const getColorClasses = () => {
    if (disabled) {
      return 'text-gray-400 cursor-not-allowed';
    }
    if (danger) {
      return 'text-red-700 hover:bg-red-50';
    }
    return 'text-gray-700 hover:bg-gray-50';
  };

  // 아이콘 색상 클래스
  const getIconColorClasses = () => {
    if (disabled) return 'text-gray-300';
    if (danger) return 'text-red-500';
    return 'text-gray-400';
  };

  return (
    <>
      {dividerBefore && <div className="my-1 border-t border-gray-100" />}
      <button
        type="button"
        id={id}
        data-testid={id}
        onClick={(e) => {
          void handleClick(e);
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`flex w-full cursor-pointer items-center px-4 py-2 text-sm transition-colors ${getColorClasses()}`}
        role="menuitem"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
      >
        <Icon className={`mr-3 h-4 w-4 shrink-0 ${getIconColorClasses()}`} />

        <div className="flex-1 text-left">
          <span className="block">{label}</span>
          {description && (
            <span className="mt-0.5 block text-xs text-gray-500">
              {description}
            </span>
          )}
        </div>

        {badge && (
          <span
            className={`ml-auto shrink-0 text-xs ${
              danger ? 'text-red-500' : 'text-gray-500'
            }`}
          >
            {badge}
          </span>
        )}
      </button>
    </>
  );
});

/**
 * 메뉴 구분선 컴포넌트
 */
const _MenuDivider = memo(function MenuDivider() {
  return <div className="my-1 border-t border-gray-100" />;
});

/**
 * 메뉴 섹션 헤더 컴포넌트
 */
const _MenuSectionHeader = memo(function MenuSectionHeader({
  title,
}: {
  title: string;
}) {
  return (
    <div className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">
      {title}
    </div>
  );
});
