/**
 * 텍스트 렌더링 유틸리티
 *
 * AI 텍스트 그라데이션 등 공통 텍스트 렌더링 함수 제공
 */

import type React from 'react';

import {
  AI_GRADIENT_CLASSES,
  AI_ICON_GRADIENT_ANIMATED_STYLE,
  AI_ICON_GRADIENT_CLASSES,
  AI_ICON_GRADIENT_COLORS,
  AI_ICON_GRADIENT_ID,
} from '../styles/design-constants';

/**
 * AI 단어에 그라데이션 애니메이션 적용
 *
 * @param text - 변환할 텍스트 (AI 포함)
 * @param isMounted - SSR 안전성을 위한 클라이언트 마운트 여부 (기본값: false)
 *                    Hydration 불일치 방지를 위해 기본값이 false로 설정됨
 *                    클라이언트 마운트 후 true로 전달하면 애니메이션 스타일 활성화
 * @returns React 엘리먼트 배열
 *
 * @example
 * // 컴포넌트 내에서 사용
 * const [isMounted, setIsMounted] = useState(false);
 * useEffect(() => setIsMounted(true), []);
 * renderTextWithAIGradient('AI 기반 모니터링', isMounted)
 */
export function renderTextWithAIGradient(
  text: string,
  isMounted: boolean = false
): React.ReactNode {
  if (!text.includes('AI')) return text;

  return text.split(/(AI)/g).map((part, index) => {
    if (part === 'AI') {
      return (
        <span
          key={index}
          className={`${AI_GRADIENT_CLASSES} bg-clip-text font-bold text-transparent`}
          style={
            isMounted
              ? {
                  backgroundSize: '200% 200%',
                }
              : undefined
          }
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

/**
 * 애니메이션이 포함된 AI 그라데이션 (FeatureCard용)
 *
 * @param text - 변환할 텍스트
 * @param variant - 카드 컨텍스트 ('default' | 'vibe')
 *   - 'default': blue→purple→pink 그라데이션 애니메이션 (AI/일반 카드용)
 *   - 'vibe': 고대비 화이트 bold + text-shadow (따뜻한 배경과 가독성 보장)
 * @returns React 엘리먼트 배열
 *
 * ⚠️ Tailwind v4 호환: 인라인 스타일로 gradient + animation 적용
 * Tailwind gradient 클래스와 background-position 애니메이션이 충돌하므로 인라인 스타일 사용
 */
export function renderAIGradientWithAnimation(
  text: string,
  variant: 'default' | 'vibe' = 'default'
): React.ReactNode {
  if (!text.includes('AI')) return text;

  return text.split(/(AI)/g).map((part, index) => {
    if (part === 'AI') {
      // 모든 AI 텍스트를 Vibe 스타일(흰색 + 앰버 글로우)로 통일
      // 사용자의 요청: "그라데이션 적용하지말고 대신 바이브 코딩 카드의 ai 단서 표시 로 통일 해줘"
      return (
        <span
          key={index}
          className="font-extrabold text-white"
          style={{
            textShadow:
              '0 0 8px rgba(251, 191, 36, 0.6), 0 1px 2px rgba(0,0,0,0.3)',
            letterSpacing: '0.05em',
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

/**
 * SVG 그라데이션 정의 컴포넌트
 *
 * SVG 아이콘에 그라데이션을 적용하기 위한 defs 요소
 * 중복 마운트 시 ID 충돌 방지를 위해 scoped ID 사용 권장
 *
 * @param id - 그라데이션 ID (useId()로 생성 권장, 미지정시 기본값 사용)
 *
 * @example
 * const gradientId = useId();
 * <AIIconGradientDefs id={gradientId} />
 * <Icon style={{ stroke: `url(#${gradientId})` }} />
 */
export function AIIconGradientDefs({
  id = AI_ICON_GRADIENT_ID,
}: {
  id?: string;
} = {}): React.ReactElement {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={AI_ICON_GRADIENT_COLORS.start} />
          <stop offset="50%" stopColor={AI_ICON_GRADIENT_COLORS.mid} />
          <stop offset="100%" stopColor={AI_ICON_GRADIENT_COLORS.end} />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * 아이콘에 그라데이션 적용을 위한 래퍼 컴포넌트
 *
 * Lucide React 아이콘 등에 AI 그라데이션 효과 적용
 * CSS mask-image 기법 사용 (크로스 브라우저 호환 - CSS.supports 체크)
 *
 * ⚠️ Tailwind v4 호환: 인라인 스타일로 gradient + animation 적용
 *
 * @param children - 아이콘 컴포넌트
 * @param className - 추가 클래스
 * @param animate - 애니메이션 적용 여부 (기본: true)
 *
 * @example
 * <GradientIconWrapper>
 *   <Sparkles className="h-8 w-8" />
 * </GradientIconWrapper>
 */
export function GradientIconWrapper({
  children,
  className = '',
  animate = true,
}: {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
}): React.ReactElement {
  // 크로스브라우저 호환성: mask-composite 지원 여부 체크
  const supportsMaskComposite =
    typeof CSS !== 'undefined' && CSS.supports?.('mask-composite', 'intersect');

  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      style={{
        // ⚠️ Tailwind v4 호환: 인라인 스타일로 gradient + animation 적용
        ...(animate
          ? AI_ICON_GRADIENT_ANIMATED_STYLE
          : {
              background: 'linear-gradient(135deg, #60a5fa, #6366f1, #9333ea)',
            }),
        // mask 속성은 지원되는 브라우저에서만 적용
        ...(supportsMaskComposite && {
          WebkitMaskImage: 'linear-gradient(white, white)',
          maskImage: 'linear-gradient(white, white)',
          WebkitMaskComposite: 'destination-in',
          maskComposite: 'intersect',
        }),
      }}
    >
      <div
        className="[&>svg]:text-transparent"
        style={{
          background: `linear-gradient(135deg, ${AI_ICON_GRADIENT_COLORS.start}, ${AI_ICON_GRADIENT_COLORS.mid}, ${AI_ICON_GRADIENT_COLORS.end})`,
          backgroundSize: animate ? '200% 200%' : undefined,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * 아이콘 그라데이션 클래스 반환 (간단한 경우)
 *
 * @returns Tailwind 클래스 문자열
 */
export function getIconGradientClasses(): string {
  return `${AI_ICON_GRADIENT_CLASSES} bg-clip-text text-transparent`;
}
