/**
 * Feature Cards 데이터
 * 메인 페이지에 표시되는 4개의 주요 기능 카드 데이터
 * @updated 2026-08-16 - visitor-facing copy names the monitoring execution path
 */

import {
  Activity,
  BookOpen,
  Bot,
  Database,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { FeatureCard } from '@/types/feature-card.types';

export const FEATURE_CARDS_DATA: FeatureCard[] = [
  {
    id: 'ai-assistant',
    title: '💬 AI 어시스턴트',
    description:
      '서버 모니터링 데이터를 자연어로 조회하고, 장애 분석 보고서와 임계값·추세 정보를 한 화면에서 확인할 수 있습니다.',
    icon: Bot,
    gradient: 'from-indigo-500 via-purple-500 to-pink-500',
    detailedContent: {
      overview: `서버 모니터링 질문을 조회, 분석, 보고서 작성 경로로 나누어 처리합니다. 가드와 정해진 계산을 LLM보다 먼저 적용하고, 대시보드와 같은 시뮬레이션 OTel 관측 데이터로 수치와 상태를 판정합니다. 복잡한 원인 분석과 보고서는 필요할 때만 전문 에이전트가 처리하며, 서버 명령은 제안만 하고 실행하지 않습니다.`,
    },
    subSections: [
      {
        title: '질문별 처리 경로',
        description:
          '질문 유형에 따라 입력 가드, 라우팅, 데이터 조회와 응답 스트리밍을 연결합니다.',
        icon: Bot,
        gradient: 'from-indigo-500 to-purple-500',
        features: [
          '단순 조회는 모델 없이 결정론 경로로 종료',
          '복잡한 질의만 전문 에이전트로 확대',
          '범위 밖 요청과 실제 서버 실행은 거절',
        ],
      },
      {
        title: '관측 데이터 기반 분석',
        description:
          '대시보드와 AI가 같은 관측 데이터를 사용해 화면의 수치와 답변의 근거를 일치시킵니다.',
        icon: Activity,
        gradient: 'from-sky-500 to-cyan-500',
        features: [
          'CPU·메모리·응답 시간·로그를 함께 확인',
          '수치와 상태 판정은 정해진 계산 규칙으로 처리',
          'AI는 계산된 근거를 바탕으로 원인과 조치안을 설명',
        ],
      },
      {
        title: '운영 지식 활용',
        description:
          '운영 절차서, 장애 이력, 서버 연결 정보를 질문과 관련된 내용만 찾아 답변에 활용합니다.',
        icon: BookOpen,
        gradient: 'from-emerald-500 to-teal-500',
        features: [
          '저장소 문서와 기준 데이터를 원본으로 유지',
          '서버와 장애 유형에 맞는 운영 지식을 우선 검색',
          '별도 검색 서비스 없이 프로젝트 내부에서 구성',
        ],
      },
      {
        title: '답변 근거 구분',
        description:
          '답변에 사용한 운영 데이터, 내부 문서, 웹 정보, 도구 결과를 출처별로 구분해 보여줍니다.',
        icon: Search,
        gradient: 'from-violet-500 to-fuchsia-500',
        features: [
          '운영 데이터와 내부 문서를 서로 다른 근거로 표시',
          '최신 외부 정보는 웹 출처와 함께 표시',
          '도구 실행 결과와 대화 맥락을 구분해 추적',
        ],
      },
    ],

    requiresAI: true,
    isAICard: true,
  },
  {
    id: 'cloud-platform',
    title: '🏗️ 클라우드 구성',
    description:
      'Vercel 프론트엔드와 Cloud Run AI Engine을 나누고, Supabase·Upstash·Cloud Tasks를 데이터와 비동기 처리에 연결했습니다.',
    icon: Database,
    gradient: 'from-emerald-500 to-teal-600',
    detailedContent: {
      overview: `화면과 AI 분석 런타임을 분리한 클라우드 구성입니다. Vercel은 프론트엔드, Cloud Run은 AI 분석을 담당하고 Supabase·Upstash·Cloud Tasks가 데이터 저장, 요청 제한과 비동기 작업을 나눠 맡습니다. 무료 티어 범위에 맞춰 자원과 호출량을 제한합니다.`,
    },
    requiresAI: false,
  },
  {
    id: 'tech-stack',
    title: '💻 기술 스택',
    description:
      'Next.js 16, React 19, TypeScript 6.0, Nivo Line, SVG Sparkline으로 시계열 차트와 AI 스트리밍 UI를 처리합니다.',
    icon: Sparkles,
    gradient: 'from-blue-500 to-purple-600',
    detailedContent: {
      overview: `대시보드, 자연어 질의와 AI 응답 스트리밍을 구현한 프로젝트 기술 구성입니다. Next.js 16, React 19, TypeScript 6.0을 중심으로 시계열 렌더링과 타입 검사를 적용했습니다.`,
    },
    requiresAI: false,
  },
  {
    id: 'vibe-coding',
    title: '🤖 AI 개발 워크플로우',
    description:
      'Claude Code·Codex·Gemini를 필요에 따라 활용하고, GitLab CI로 테스트와 배포 단계를 확인합니다.',
    icon: Zap,
    gradient: 'from-amber-600 via-orange-600 to-amber-700',
    detailedContent: {
      overview: `AI 개발 도구를 계획, 구현, 검토에 선택적으로 활용하고 GitLab CI로 검증과 배포를 진행하는 개발 흐름입니다. 로컬 검증, 프로덕션 배포와 공개 코드 스냅샷 단계를 구분해 관리합니다.`,
    },
    requiresAI: false,
    isVibeCard: true,
    isSpecial: true,
  },
];
