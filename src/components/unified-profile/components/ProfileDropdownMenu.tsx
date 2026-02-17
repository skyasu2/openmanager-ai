'use client';

import {
  type KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import type { ProfileDropdownMenuProps } from '../types/profile.types';
import { ProfileAvatar, UserTypeIcon } from './ProfileAvatar';
import { ProfileMenuItem } from './ProfileMenuItem';

/**
 * 프로필 드롭다운 메뉴 컴포넌트
 * 사용자 정보와 메뉴 아이템들을 표시
 */
export const ProfileDropdownMenu = memo(function ProfileDropdownMenu({
  isOpen,
  menuItems,
  userInfo,
  userType,
  onClose,
  statusContent,
}: ProfileDropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const visibleItems = menuItems.filter((item) => item.visible);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = menuRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]:not([disabled])'
        );
        if (!items?.length) return;

        const currentIndex = Array.from(items).indexOf(
          document.activeElement as HTMLButtonElement
        );
        let nextIndex: number;
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        }
        items[nextIndex]?.focus();
      }
    },
    [onClose]
  );

  // Auto-focus first menu item when opened
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      const firstItem = menuRef.current?.querySelector<HTMLButtonElement>(
        '[role="menuitem"]:not([disabled])'
      );
      firstItem?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen]);

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
    return '사용자';
  };

  const getUserEmail = () => {
    return userInfo?.email || null;
  };

  const getUserTypeLabel = () => {
    if (userType === 'github') return 'GitHub';
    if (userType === 'google') return 'Google';
    if (userType === 'guest') return '게스트';
    return '알 수 없음';
  };

  const getUserTypeClass = () => {
    if (userType === 'github') return 'bg-green-100 text-green-700';
    if (userType === 'google') return 'bg-red-100 text-red-700';
    if (userType === 'guest') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <>
      {isOpen && (
        <div className="absolute right-0 z-9999 mt-2 w-64 space-y-2">
          <div
            ref={menuRef}
            className="rounded-xl border border-gray-200 bg-white py-2 shadow-lg"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="profile-menu-button"
            onKeyDown={handleKeyDown}
          >
            {/* 사용자 정보 헤더 */}
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <ProfileAvatar
                  userInfo={userInfo}
                  userType={userType}
                  size="large"
                  showBadge={false}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate font-medium text-gray-900">
                    {getUserName()}
                    <UserTypeIcon
                      userType={userType}
                      className="h-4 w-4 shrink-0"
                    />
                  </div>

                  {getUserEmail() && (
                    <div className="truncate text-sm text-gray-500">
                      {getUserEmail()}
                    </div>
                  )}

                  <div
                    className={`mt-1 inline-block rounded-full px-2 py-1 text-xs ${getUserTypeClass()}`}
                  >
                    {getUserTypeLabel()} 계정
                  </div>
                </div>
              </div>
            </div>

            {/* 메뉴 아이템들 */}
            <div className="py-1">
              {/* 메뉴 아이템 렌더링 */}
              {visibleItems.map((item) => (
                <ProfileMenuItem
                  key={item.id}
                  {...item}
                  onClick={() => {
                    if (!item.disabled) {
                      onClose();
                    }
                  }}
                />
              ))}
            </div>

            {/* 하단 정보 */}
            <div className="border-t border-gray-100 px-4 py-2">
              <p className="text-center text-xs text-gray-400">🛡️ 보안 연결됨</p>
            </div>
          </div>

          {statusContent && (
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
              {statusContent}
            </div>
          )}
        </div>
      )}
    </>
  );
});
