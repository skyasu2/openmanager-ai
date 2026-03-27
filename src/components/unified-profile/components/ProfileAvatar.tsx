'use client';

import { Shield, UserCheck } from 'lucide-react';
import Image from 'next/image';
import { memo } from 'react';
import type { ProfileAvatarProps } from '../types/profile.types';

/**
 * 프로필 아바타 컴포넌트
 * 사용자 아바타 이미지 또는 이니셜 표시
 */
export const ProfileAvatar = memo(function ProfileAvatar({
  userInfo,
  userType,
  size = 'medium',
  showBadge = true,
  onClick,
}: ProfileAvatarProps) {
  // 사이즈별 클래스
  const sizeClasses = {
    small: 'w-6 h-6 text-xs',
    medium: 'w-8 h-8 text-xs',
    large: 'w-10 h-10 text-sm',
  };

  const badgeSizeClasses = {
    small: 'w-2 h-2',
    medium: 'w-3 h-3',
    large: 'w-4 h-4',
  };

  // 사용자 이름 가져오기
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

  // 사용자 이니셜 가져오기
  const getUserInitials = () => {
    // Provider/guest 계정은 고정 이니셜로 의미를 유지
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

  // 배경색 클래스 결정
  const getBackgroundClass = () => {
    if (userType === 'github')
      return 'bg-linear-to-r from-purple-500 to-pink-500';
    if (userType === 'google')
      return 'bg-linear-to-r from-red-500 to-yellow-500';
    if (userType === 'guest') return 'bg-linear-to-r from-blue-500 to-cyan-500';
    return 'bg-gray-500';
  };

  // 배지 색상 결정
  const getBadgeColor = () => {
    if (userType === 'github') return 'bg-green-500';
    if (userType === 'google') return 'bg-red-500';
    if (userType === 'guest') return 'bg-blue-500';
    return 'bg-gray-400';
  };

  // 사용자 타입 타이틀
  const getUserTypeTitle = () => {
    if (userType === 'github') return 'GitHub 사용자';
    if (userType === 'google') return 'Google 사용자';
    if (userType === 'guest') return '게스트 사용자';
    return '알 수 없음';
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Interactive role is conditionally applied
    <div
      className="relative"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {userInfo?.avatar ? (
        <Image
          src={userInfo.avatar}
          alt={getUserName()}
          width={size === 'large' ? 40 : size === 'medium' ? 32 : 24}
          height={size === 'large' ? 40 : size === 'medium' ? 32 : 24}
          className={`${sizeClasses[size]} rounded-full border-2 border-gray-200 object-cover`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} flex items-center justify-center rounded-full font-semibold text-white ${getBackgroundClass()}`}
        >
          {getUserInitials()}
        </div>
      )}

      {/* 사용자 타입 표시 배지 */}
      {showBadge && (
        <div
          className={`absolute -bottom-1 -right-1 ${badgeSizeClasses[size]} rounded-full border-2 border-white ${getBadgeColor()}`}
          title={getUserTypeTitle()}
        />
      )}
    </div>
  );
});

/**
 * 사용자 타입 아이콘 컴포넌트
 */
export const UserTypeIcon = memo(function UserTypeIcon({
  userType,
  className = 'w-4 h-4',
}: {
  userType: 'github' | 'google' | 'guest' | 'unknown';
  className?: string;
}) {
  if (userType === 'github') {
    return (
      <span title="GitHub 인증">
        <Shield className={`${className} text-green-600`} />
      </span>
    );
  }

  if (userType === 'google') {
    return (
      <span title="Google 인증">
        <Shield className={`${className} text-red-600`} />
      </span>
    );
  }

  if (userType === 'guest') {
    return (
      <span title="게스트 모드">
        <UserCheck className={`${className} text-blue-600`} />
      </span>
    );
  }

  return null;
});
