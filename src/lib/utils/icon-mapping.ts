// 🎨 Font Awesome → Lucide React 아이콘 매핑
// Vercel CSP 최적화를 위한 완전한 아이콘 마이그레이션

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  Brain,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Database,
  Eye,
  HelpCircle,
  History,
  Info,
  Lightbulb,
  Loader,
  type LucideIcon,
  PenTool,
  Search,
  Send,
  Settings,
  X,
  Zap,
} from 'lucide-react';

// Font Awesome → Lucide React 매핑 테이블
export const iconMapping: Record<string, LucideIcon> = {
  // === 시스템 관련 ===
  'fas fa-cog': Settings,
  'fas fa-cogs': Settings,
  'fas fa-robot': Bot,
  'fas fa-brain': Brain,
  'fas fa-database': Database,
  'fas fa-bolt': Zap,

  // === 상태 아이콘 ===
  'fas fa-exclamation-triangle': AlertTriangle,
  'fas fa-exclamation-circle': AlertCircle,
  'fas fa-check-circle': CheckCircle,
  'fas fa-lightbulb': Lightbulb,
  'fas fa-info-circle': Info,
  'fas fa-check': Check,

  // === 네비게이션 아이콘 ===
  'fas fa-chevron-up': ChevronUp,
  'fas fa-chevron-down': ChevronDown,
  'fas fa-chevron-left': ChevronLeft,
  'fas fa-chevron-right': ChevronRight,
  'fas fa-arrow-up': ArrowUp,
  'fas fa-arrow-down': ArrowDown,
  'fas fa-arrow-right': ArrowRight,
  'fas fa-arrow-left': ArrowLeft,

  // === 일반 UI ===
  'fas fa-times': X,
  'fas fa-paper-plane': Send,
  'fas fa-history': History,
  'fas fa-search': Search,
  'fas fa-eye': Eye,
  'fas fa-question': HelpCircle,
  'fas fa-question-circle': HelpCircle,
  'fas fa-circle': Circle,
  'fas fa-spinner': Loader,

  // === 프로젝트 관련 ===
  'fas fa-project-diagram': Activity,
  'fas fa-pen': PenTool,
};

// Font Awesome 클래스명에서 Lucide 아이콘 추출
export const getLucideIcon = (faClass: string): LucideIcon => {
  return iconMapping[faClass] || Circle;
};
