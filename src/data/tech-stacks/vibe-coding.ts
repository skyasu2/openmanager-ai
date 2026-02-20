import { MCP_SERVERS } from '@/config/constants';
import type { VibeCodeData } from '../tech-stacks.types';

export const VIBE_CODING_DATA: VibeCodeData = {
  current: [
    {
      name: 'Google Antigravity',
      category: 'ai',
      importance: 'critical',
      description:
        'Agent-first AI-powered IDE - AI 에이전트가 계획, 실행, 검증까지 자율 수행 (Google)',
      implementation:
        'Gemini 3와 함께 출시. VS Code 포크 기반으로 개발자는 아키텍트로, AI 에이전트가 실제 구현을 담당하는 새로운 패러다임. Multi-Agent 협업 지원',
      version: 'v1.0.0 (Gemini 3 Pro)',
      status: 'active',
      icon: '🌌',
      tags: ['Google', 'Agent-First', 'Gemini3', 'IDE'],
      type: 'commercial',
    },
    {
      name: 'MCP 서버',
      category: 'ai',
      importance: 'high',
      description:
        'Anthropic의 Model Context Protocol. AI가 외부 도구, 데이터 소스, API에 표준화된 방식으로 접근하는 오픈 프로토콜. 다양한 MCP 서버로 AI 기능 확장',
      implementation: `→ ${MCP_SERVERS.TOTAL_ACTIVE}개 서버 연동: vercel(배포), supabase(DB), context7(문서), playwright(E2E), next-devtools(Next.js진단), github(저장소), sequential-thinking(추론), stitch(UI디자인)`,
      status: 'active',
      icon: '🔌',
      tags: ['MCP', 'Protocol', '확장기능'],
      type: 'opensource',
    },
    {
      name: 'Claude Code',
      category: 'ai',
      importance: 'critical',
      description:
        'An agentic coding tool that lives in your terminal, understands your codebase (Anthropic)',
      implementation:
        'Helps you code faster by executing routine tasks, explaining complex code, and handling git workflows - all through natural language commands. MCP 서버로 외부 시스템 직접 제어',
      version: 'claude-opus-4-6',
      status: 'active',
      icon: '🤖',
      tags: ['Anthropic', 'Agentic', 'MCP'],
      type: 'commercial',
    },
    {
      name: 'Cross-Model AI Review',
      category: 'ai',
      importance: 'critical',
      description:
        'AI가 작성한 코드는 다른 AI 모델이 리뷰 - Single Point of Failure 방지',
      implementation:
        'Claude가 작성한 코드를 Codex/Gemini가 검토. 동일 모델의 편향(bias)과 blind spot을 다른 모델이 보완. 커밋 시 자동 트리거',
      version: 'v5.0',
      status: 'active',
      icon: '🔄',
      tags: ['Cross-Model', 'Bias방지', '자동검증'],
      type: 'custom',
    },
    {
      name: 'Codex CLI',
      category: 'ai',
      importance: 'high',
      description:
        'A lightweight coding agent that runs in your terminal (OpenAI)',
      implementation:
        'Generate, edit, and run code using natural language. ChatGPT Plus/Pro 플랜으로 사용. Claude 작성 코드의 Cross-Model 리뷰어',
      version: 'v0.63.0',
      status: 'active',
      icon: '💎',
      tags: ['OpenAI', 'Lightweight', 'ChatGPT'],
      type: 'commercial',
    },
    {
      name: 'Gemini CLI',
      category: 'ai',
      importance: 'high',
      description:
        'An open-source AI agent that brings the power of Gemini directly into your terminal (Google)',
      implementation:
        'Lightweight access to Gemini - the most direct path from prompt to model. 1M 토큰 컨텍스트로 대규모 분석. Cross-Model 리뷰어',
      version: 'v0.18.4',
      status: 'active',
      icon: '✨',
      tags: ['Google', 'OpenSource', '1M-Context'],
      type: 'opensource',
      aiType: 'google-api',
    },
    {
      name: 'Git + GitHub 통합',
      category: 'custom',
      importance: 'high',
      description: '버전 관리부터 PR까지 모든 Git 작업 자동화',
      implementation:
        'MCP GitHub 서버로 커밋, 푸시, PR 생성, 이슈 관리를 Claude Code에서 직접 자동화',
      status: 'active',
      icon: '📝',
      tags: ['Git자동화', 'CI/CD', 'GitHub통합'],
      type: 'custom',
    },
    {
      name: 'Vitest 4.0',
      category: 'testing',
      importance: 'high',
      description:
        'Vite 기반 차세대 테스트 프레임워크. Jest 호환 API, 네이티브 ESM, HMR 지원으로 초고속 테스트 실행. 워치 모드에서 변경 파일만 재실행',
      implementation:
        '→ 유닛/통합 테스트 전체 적용. Coverage 리포트 및 실시간 피드백',
      version: '4.0.16',
      status: 'active',
      icon: '🧪',
      tags: ['테스트', 'Vite', 'Jest호환'],
      type: 'opensource',
    },
    {
      name: 'Biome 2.3',
      category: 'tooling',
      importance: 'high',
      description:
        'Rust 기반 초고속 Linter + Formatter. ESLint/Prettier 통합 대체, 단일 도구로 린트와 포맷팅 동시 수행. 10배 빠른 속도',
      implementation:
        '→ 코드 스타일 자동 적용. PostToolUse hook으로 저장 시 자동 포맷',
      version: '2.3.10',
      status: 'active',
      icon: '🔧',
      tags: ['Linter', 'Formatter', 'Rust'],
      type: 'opensource',
    },
    {
      name: 'Playwright 1.57',
      category: 'testing',
      importance: 'high',
      description:
        'Microsoft의 E2E 테스트 프레임워크. Chromium/Firefox/WebKit 크로스 브라우저, 자동 대기, 트레이싱, 스크린샷 캡처 지원',
      implementation:
        '→ 크리티컬 플로우 E2E 테스트. MCP 서버로 Claude Code에서 직접 제어',
      version: '1.57.0',
      status: 'active',
      icon: '🎭',
      tags: ['E2E', 'Microsoft', '크로스브라우저'],
      type: 'opensource',
    },
  ],
  history: {
    // 1단계: 초기 - ChatGPT 기반 개별 페이지 생성
    stage1: [
      {
        name: 'ChatGPT',
        category: 'ai',
        importance: 'critical',
        description: '프로젝트 최초 시작 도구 - AI로 개별 페이지 생성',
        implementation:
          'GPT-3.5/4.0으로 HTML/CSS/JS 페이지를 개별적으로 생성. 프롬프트 기반으로 모니터링 웹 인터페이스의 기초를 구축. 각 페이지를 독립적으로 개발',
        version: 'GPT-3.5/4.0',
        status: 'history',
        icon: '🤖',
        tags: ['최초도구', '개별페이지', 'AI생성'],
        type: 'commercial',
      },
      {
        name: 'GitHub Web Interface',
        category: 'custom',
        importance: 'high',
        description: 'Git CLI 없이 웹 인터페이스로 파일 수동 업로드',
        implementation:
          '로컬에서 ChatGPT로 생성한 파일들을 GitHub 웹사이트에서 직접 업로드. 체계적인 버전 관리 없이 파일 기반 관리',
        status: 'history',
        icon: '🌐',
        tags: ['수동업로드', 'Git없음', '웹기반'],
        type: 'commercial',
      },
      {
        name: 'Netlify',
        category: 'deployment',
        importance: 'high',
        description: '최초 배포 플랫폼 - 정적 사이트 & 목업 호스팅',
        implementation:
          'GitHub 저장소와 연동하여 정적 사이트 자동 배포. 복잡한 서버 로직 없이 HTML/JS 수준의 목업을 빠르게 띄우던 용도',
        status: 'history',
        icon: '🌍',
        tags: ['정적배포', '첫배포', 'Mockup', '단순호스팅'],
        type: 'commercial',
      },
      {
        name: '기본 텍스트 에디터',
        category: 'utility',
        importance: 'medium',
        description: '로컬 개발을 위한 기본 에디터',
        implementation:
          'AI 통합 없는 기본 텍스트 에디터로 ChatGPT 생성 코드 수정. VSCode 없이 메모장 수준 편집',
        status: 'history',
        icon: '📝',
        tags: ['1단계', '수동개발', 'Copy&Paste', 'Netlify'],
        type: 'commercial',
      },
    ],

    // 2단계: 중기 - Cursor 자동 개발 시대
    stage2: [
      {
        name: 'Cursor AI (Auto Dev)',
        category: 'ai',
        importance: 'critical',
        description: '2단계 - "자동 개발"의 시작',
        implementation:
          'IDE 안에서 AI가 파일을 수정해주는 "Vibe Coding"의 탄생. 수동 복붙에서 벗어나 생산성이 비약적으로 향상된 시기',
        version: '0.42+',
        status: 'history',
        icon: '🚀',
        tags: ['2단계', '자동개발', 'Cursor', 'IDE중심'],
        type: 'commercial',
      },
      {
        name: 'Vercel + Supabase',
        category: 'deployment',
        importance: 'high',
        description: '현재까지 이어지는 인프라 표준 정립',
        implementation:
          'Cursor 시기에 도입된 이 조합(Next.js+Vercel+Supabase)은 현재 4단계 Agentic Era까지 변함없이 우리 서비스의 단단한 뼈대가 되어주고 있음',
        status: 'history',
        icon: '⚡',
        tags: ['FullStack', '핵심기반', '현재도사용중'],
        type: 'commercial',
      },
    ],

    // 3단계: 후기 - 분기점 (Pivot Point)
    stage3: [
      {
        name: 'WSL + Claude Code (Main)',
        category: 'ai',
        importance: 'critical',
        description: '3단계 핵심 - 메인 개발 환경의 이동 (IDE → WSL)',
        implementation:
          '이 시점부터 WSL 터미널이 메인 개발 스테이지가 됨. Claude Code가 등장하여 실질적인 개발을 주도하기 시작함',
        status: 'history',
        icon: '🐧',
        tags: ['3단계', 'WSL-Main', 'Claude-Code', '분기점'],
        type: 'custom',
      },
      {
        name: 'Visual Aux (Windsurf/VSCode)',
        category: 'ai',
        importance: 'medium',
        description: 'IDE의 역할 축소 - 보조 및 시각적 분석',
        implementation:
          'Windsurf와 VSCode를 사용하지만, 역할은 "보조"로 축소됨. 주로 프론트엔드 스크린샷 분석이나 단순 뷰어 역할을 담당',
        status: 'history',
        icon: '👁️',
        tags: ['IDE-Secondary', '시각분석', '보조역할'],
        type: 'commercial',
      },
    ],
  },
};
