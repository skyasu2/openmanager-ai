/**
 * Feature Card 관련 타입 정의
 * 메인 페이지의 4개 카드와 모달에서 사용되는 모든 타입을 중앙 집중화
 */

import type { LucideIcon } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';

/**
 * 메인 Feature Card 인터페이스
 */
export interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  detailedContent: {
    overview: string;
    features: string[];
    technologies: string[];
  };
  subSections?: {
    title: string;
    description: string;
    icon: LucideIcon;
    features: string[];
    gradient: string;
  }[];
  requiresAI: boolean;
  isAICard?: boolean;
  isSpecial?: boolean;
  isVibeCard?: boolean;
}

/**
 * Feature Card 컴포넌트 Props
 */
export interface FeatureCardProps {
  card: FeatureCard;
  index: number;
  onCardClick: (cardId: string) => void;
  isAIDisabled: boolean;
}

/**
 * 기술 스택 카테고리
 */
export type TechCategory =
  | 'framework'
  | 'language'
  | 'database'
  | 'ai'
  | 'opensource'
  | 'custom'
  | 'deployment'
  | 'ui'
  | 'utility' // clsx, date-fns 등 유틸리티 라이브러리용
  | 'cache' // Redis, Memcached 등 캐시 시스템
  | 'testing' // Playwright, Vitest 등 테스트 도구
  | 'tooling'; // Biome, ESLint 등 개발 도구

/**
 * 중요도 레벨
 */
export type ImportanceLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * 제품 타입
 * - custom: 우리가 직접 처음부터 만든 기능
 * - opensource: 오픈소스 라이브러리/프레임워크 사용
 * - commercial: 기존 업체의 무료 티어 또는 유료 서비스
 */
export type ProductType = 'custom' | 'opensource' | 'commercial';

/**
 * AI 엔진 타입
 */
export type AIEngineType = 'cloud-ai' | 'local-ai' | 'hybrid';

/**
 * 기술 스택 아이템
 */
export interface TechItem {
  name: string;
  category: TechCategory;
  importance: ImportanceLevel;
  description: string;
  implementation: string;
  version?: string;
  status: 'active' | 'ready' | 'planned' | 'history';
  icon: string;
  tags: string[];
  type?: ProductType; // 커스텀 개발인지 상용 제품인지 구분
  aiType?: AIEngineType; // AI 관련 항목인 경우 엔진 타입
}

/**
 * Feature Card Modal Props
 */
export interface FeatureCardModalProps {
  selectedCard: FeatureCard | null;
  onClose: () => void;
  renderTextWithAIGradient: (text: string) => ReactNode;
  modalRef: RefObject<HTMLDivElement>;
  variant?: 'home' | 'landing';
  isVisible: boolean; // Portal 기반 모달 가시성 제어 (AI 교차검증 기반 개선)
}

/**
 * 중요도별 스타일 설정
 */
export interface ImportanceStyle {
  bg: string;
  text: string;
  badge: string;
  label: string;
}

/**
 * 카테고리별 스타일 설정
 */
export interface CategoryStyle {
  color: string;
  bg: string;
}
