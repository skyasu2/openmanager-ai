// 🎨 Lucide Icon 래퍼 컴포넌트
// Font Awesome → Lucide React 완전 마이그레이션

import type { LucideIcon as LucideIconType } from 'lucide-react';
import { Circle } from 'lucide-react';
import type { CSSProperties, FC } from 'react';
import { getLucideIcon, iconMapping } from '@/lib/utils/icon-mapping';

interface LucideIconProps {
  /** Font Awesome 클래스명 (예: "fas fa-cog") 또는 Lucide 아이콘명 */
  icon: string;
  /** CSS 클래스 */
  className?: string;
  /** 아이콘 크기 */
  size?: number | string;
  /** 색상 */
  color?: string;
  /** 스트로크 굵기 */
  strokeWidth?: number;
  /** 인라인 스타일 */
  style?: CSSProperties;
}

/**
 * Font Awesome 클래스를 Lucide React 아이콘으로 자동 변환하는 컴포넌트
 *
 * @example
 * ```tsx
 * // Font Awesome 클래스 자동 변환
 * <LucideIcon icon="fas fa-cog" className="text-blue-500" />
 *
 * // 직접 Lucide 아이콘명 사용
 * <LucideIcon icon="Settings" className="w-5 h-5" />
 * ```
 */
export const LucideIcon: FC<LucideIconProps> = ({
  icon,
  className = '',
  size = 16,
  color,
  strokeWidth = 2,
  style,
}) => {
  // Font Awesome 클래스인지 확인
  const isFontAwesome =
    icon.startsWith('fas ') ||
    icon.startsWith('far ') ||
    icon.startsWith('fab ');

  let IconComponent: LucideIconType;

  if (isFontAwesome) {
    // Font Awesome → Lucide 매핑
    IconComponent = getLucideIcon(icon);
  } else {
    // 직접 Lucide 아이콘명 사용
    IconComponent = iconMapping[icon] ?? iconMapping['fas fa-circle'] ?? Circle;
  }

  // 최종 안전 체크 - Gemini 제안 반영
  if (!IconComponent) {
    IconComponent = Circle;
  }

  return (
    <IconComponent
      className={className}
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      style={style}
    />
  );
};

/**
 * Font Awesome `<i>` 태그를 Lucide 컴포넌트로 변환하는 유틸리티
 *
 * @example
 * ```tsx
 * // 기존: <i className="fas fa-cog text-blue-500"></i>
 * // 변환: <FontAwesome className="fas fa-cog text-blue-500" />
 * ```
 */
export const FontAwesome: FC<{
  className: string;
  style?: CSSProperties;
}> = ({ className, style }) => {
  // className에서 Font Awesome 클래스 추출
  const faClass =
    className.match(/(fas|far|fab|fal|fad|fat)\s+fa-[\w-]+/)?.[0] || '';
  const otherClasses = className
    .replace(/(fas|far|fab|fal|fad|fat)\s+fa-[\w-]+/, '')
    .trim();

  return <LucideIcon icon={faClass} className={otherClasses} style={style} />;
};

export default LucideIcon;
