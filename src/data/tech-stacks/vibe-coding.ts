import { MCP_SERVERS } from '@/config/constants';
import type { VibeCodeData } from '../tech-stacks.types';

const ACTIVE_MCP_SERVER_NAMES = MCP_SERVERS.ACTIVE.join(', ');

export const VIBE_CODING_DATA: VibeCodeData = {
  current: [
    {
      name: 'Google Antigravity',
      category: 'ai',
      importance: 'low',
      description: 'Google의 에이전트 중심 AI IDE (VS Code 포크)',
      implementation:
        '→ CLI 도구를 띄우는 작업 환경. 터미널 분할과 프론트엔드 시각 확인용',
      status: 'active',
      icon: '🌌',
      tags: ['Google', 'Agent-First', 'IDE'],
      type: 'commercial',
    },
    {
      name: 'MCP 서버',
      category: 'ai',
      importance: 'high',
      description:
        'AI가 외부 도구·데이터에 표준 방식으로 접근하는 프로토콜 (Anthropic)',
      implementation: `→ ${MCP_SERVERS.TOTAL_ACTIVE}개 서버 설정: ${ACTIVE_MCP_SERVER_NAMES}. 필요할 때 브라우저·DB·배포 상태를 직접 조회`,
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
        '터미널에서 코드베이스를 이해하고 작업하는 AI 에이전트 (Anthropic)',
      implementation: '→ 메인 개발 도구. 아키텍처 설계, 구현, 코드 리뷰를 담당',
      status: 'active',
      icon: '🤖',
      tags: ['Anthropic', 'Agentic', 'MCP'],
      type: 'commercial',
    },
    {
      name: 'Cross-Model AI Review',
      category: 'ai',
      importance: 'critical',
      description: '중요 변경을 다른 AI 모델로 교차 검토하는 방식',
      implementation:
        '→ Claude Code로 만든 결과를 Codex/Gemini에 수동으로 검토 요청. 커밋 시 자동 실행은 하지 않음',
      status: 'active',
      icon: '🔄',
      tags: ['Cross-Model', 'Bias방지', '수동검증'],
      type: 'custom',
    },
    {
      name: 'Codex CLI',
      category: 'ai',
      importance: 'high',
      description: '터미널에서 동작하는 경량 코딩 에이전트 (OpenAI)',
      implementation: '→ 구현, 리팩토링, 테스트 보완을 주로 담당',
      status: 'active',
      icon: '💎',
      tags: ['OpenAI', 'Lightweight', 'ChatGPT'],
      type: 'commercial',
    },
    {
      name: 'Gemini CLI',
      category: 'ai',
      importance: 'high',
      description: 'Gemini를 터미널에서 쓰는 오픈소스 AI 에이전트 (Google)',
      implementation: '→ 리서치와 대규모 코드 분석, 교차 검토',
      status: 'active',
      icon: '✨',
      tags: ['Google', 'OpenSource', 'Research'],
      type: 'opensource',
      aiType: 'cloud-ai',
    },
    {
      name: 'GitLab + Dual Remote',
      category: 'custom',
      importance: 'high',
      description: 'GitLab canonical 저장소와 GitHub 공개 스냅샷을 분리 운영',
      implementation:
        '→ GitHub에는 코드 전용 스냅샷만 반영하고 내부 문서·QA 자산은 GitLab에만 유지',
      status: 'active',
      icon: '🦊',
      tags: ['GitLab', 'Dual-Remote', 'Vercel배포'],
      type: 'custom',
    },
    {
      name: 'Vitest 4.1',
      category: 'testing',
      importance: 'high',
      description: 'Vite 기반 테스트 프레임워크',
      implementation: '→ 단위·통합·계약 테스트. 로컬용과 CI용 설정을 분리',
      version: '4.1.11',
      status: 'active',
      icon: '🧪',
      tags: ['테스트', 'Vite', 'Jest호환'],
      type: 'opensource',
    },
    {
      name: 'Biome 2.4',
      category: 'tooling',
      importance: 'high',
      description:
        'Rust 기반 Linter + Formatter. ESLint/Prettier를 한 도구로 대체',
      implementation:
        '→ 로컬·CI·git 훅을 같은 명령으로 통일. 대신 ESLint 플러그인 생태계는 포기',
      version: '2.4.9',
      status: 'active',
      icon: '🔧',
      tags: ['Linter', 'Formatter', 'Rust'],
      type: 'opensource',
    },
    {
      name: 'Knip 6.0',
      category: 'tooling',
      importance: 'medium',
      description: '쓰이지 않는 파일·export·의존성을 찾아내는 정적 분석 도구',
      implementation:
        '→ 릴리스 전 정리와 리팩토링 전후에 실행. AI가 남기기 쉬운 잔재를 걷어내는 용도',
      version: '6.0.5',
      status: 'active',
      icon: '🧹',
      tags: ['DeadCode', 'StaticAnalysis', 'Hygiene'],
      type: 'opensource',
    },
    {
      name: 'Storybook 10',
      category: 'testing',
      importance: 'medium',
      description: 'UI 컴포넌트를 앱 밖에서 따로 개발·확인하는 도구',
      implementation:
        '→ 컴포넌트를 정상·경고·에러 상태별로 시각 확인. addon-mcp로 AI가 컴포넌트 문서를 직접 조회',
      version: '10.2.10',
      status: 'active',
      icon: '📖',
      tags: ['컴포넌트문서', 'Visual Testing', 'MCP'],
      type: 'opensource',
    },
    {
      name: 'Playwright 1.58',
      category: 'testing',
      importance: 'high',
      description: 'Microsoft의 브라우저 E2E 테스트 프레임워크',
      implementation:
        '→ 로컬 회귀와 배포 후 QA. MCP 서버로 브라우저를 직접 조작하며 증거 스크린샷을 남김',
      version: '1.58.2',
      status: 'active',
      icon: '🎭',
      tags: ['E2E', 'Microsoft', '크로스브라우저'],
      type: 'opensource',
    },
    {
      name: 'Context-Aware Git Hooks',
      category: 'custom',
      importance: 'medium',
      description: '변경 종류에 따라 필요한 검증만 실행하는 직접 만든 git 훅',
      implementation:
        '→ 문서 변경과 코드 변경을 구분해 검증 강도를 나눔. 유지보수는 번거롭지만 불필요한 전체 검증을 줄임',
      version: 'pre-push.js',
      status: 'active',
      icon: '🪝',
      tags: ['Husky', 'PrePush', 'ShiftLeft'],
      type: 'custom',
    },
  ],
  history: {
    // 1단계: 초기 - ChatGPT 기반 개별 페이지 생성
    stage1: [
      {
        name: 'ChatGPT',
        category: 'ai',
        importance: 'critical',
        description: '프로젝트 최초 시작 도구',
        implementation:
          '→ HTML/CSS/JS 페이지를 하나씩 생성해 모니터링 화면의 기초를 만듦',
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
        description: 'Git CLI 없이 웹에서 파일을 직접 업로드',
        implementation: '→ 생성한 파일을 웹 UI로 올리던 시기. 버전 관리 없음',
        status: 'history',
        icon: '🌐',
        tags: ['수동업로드', 'Git없음', '웹기반'],
        type: 'commercial',
      },
      {
        name: 'Netlify',
        category: 'deployment',
        importance: 'high',
        description: '최초 배포 플랫폼',
        implementation: '→ 정적 목업을 빠르게 띄우던 용도',
        status: 'history',
        icon: '🌍',
        tags: ['정적배포', '첫배포', 'Mockup', '단순호스팅'],
        type: 'commercial',
      },
      {
        name: '기본 텍스트 에디터',
        category: 'utility',
        importance: 'medium',
        description: 'AI 연동이 없는 기본 에디터',
        implementation: '→ 생성된 코드를 손으로 고치던 단계',
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
        description: 'IDE 안에서 AI가 파일을 직접 고치기 시작한 단계',
        implementation: '→ 수동 복붙에서 벗어난 시기',
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
        description: '지금까지 이어지는 인프라 조합',
        implementation:
          '→ 이 시기에 정한 Next.js + Vercel + Supabase 조합을 현재까지 유지',
        status: 'history',
        icon: '⚡',
        tags: ['FullStack', '핵심기반', '현재도사용중'],
        type: 'commercial',
      },
    ],

    stageMeta: {
      stage1: {
        title: '초기 단계',
        description:
          'ChatGPT로 개별 페이지 생성 → GitHub 수동 업로드 → Netlify 배포 → 데모용 목업 수준',
        link: {
          href: 'https://openmanager-vibe-v2.netlify.app/',
          label: 'v2 버전 확인하기',
        },
      },
      stage2: {
        title: '중기 단계',
        description:
          'Cursor 도입 → GitHub 연동 → Vercel 배포 → Supabase CRUD 웹앱 완성',
      },
      stage3: {
        title: '후기 단계',
        description:
          'Claude Code 전환 → WSL 최적화 → 멀티 AI CLI 협업 → GitHub Actions 기반 검증',
      },
      stage4: {
        title: '현재 단계',
        description:
          'GitLab canonical 전환 → Claude Code 메인 + 구현·리팩토링 단계 Codex 비중 증가 → GitLab CI + ci:local 직접 검증 → Cloud Run AI Engine 운영',
      },
    },

    // 3단계: 후기 - 분기점 (Pivot Point)
    stage3: [
      {
        name: 'WSL + Claude Code (Main)',
        category: 'ai',
        importance: 'critical',
        description: '메인 개발 환경이 IDE에서 WSL 터미널로 옮겨간 분기점',
        implementation: '→ Claude Code가 실제 개발을 주도하기 시작',
        status: 'history',
        icon: '🐧',
        tags: ['3단계', 'WSL-Main', 'Claude-Code', '분기점'],
        type: 'custom',
      },
      {
        name: 'Visual Aux (Windsurf/VSCode)',
        category: 'ai',
        importance: 'medium',
        description: 'IDE 역할이 보조로 축소된 시기',
        implementation: '→ 스크린샷 확인과 뷰어 용도로만 사용',
        status: 'history',
        icon: '👁️',
        tags: ['IDE-Secondary', '시각분석', '보조역할'],
        type: 'commercial',
      },
      {
        name: 'GitHub + GitHub Actions',
        category: 'custom',
        importance: 'high',
        description: 'GitLab 도입 전 canonical 저장소와 CI',
        implementation:
          '→ GitHub Actions로 lint·type·test를 돌리던 단계. 이후 canonical은 GitLab으로 옮기고 GitHub는 공개 스냅샷 전용이 됨',
        status: 'history',
        icon: '🐙',
        tags: ['GitHub', 'Actions', 'Dependabot', 'CI/CD'],
        type: 'commercial',
      },
    ],

    // 4단계: 현재 - GitLab canonical + Multi-AI 운영 체계
    stage4: [
      {
        name: 'GitLab (Canonical)',
        category: 'custom',
        importance: 'critical',
        description: 'canonical 저장소를 GitLab으로 전환',
        implementation:
          '→ 배포 권한을 GitLab CI로 모으고 GitHub는 공개 코드 스냅샷 전용으로 분리',
        status: 'active',
        icon: '🦊',
        tags: ['4단계', 'GitLab', 'canonical', 'Vercel연동'],
        type: 'commercial',
      },
      {
        name: 'Multi-AI CLI (Manual Cross-Use)',
        category: 'ai',
        importance: 'critical',
        description: 'Claude Code 중심으로 여러 AI CLI를 수동 교차 사용',
        implementation:
          '→ Claude Code(설계·구현), Codex(구현·리팩토링), Gemini(리서치)를 사람이 골라 씀. 자동 라우팅은 쓰지 않음',
        status: 'active',
        icon: '🤝',
        tags: ['Multi-AI', 'Manual-Cross-Use', 'Codex', 'Gemini'],
        type: 'commercial',
      },
      {
        name: 'ci:local (Shell CI)',
        category: 'tooling',
        importance: 'high',
        description: 'GitLab CI와 같은 검증을 로컬에서 먼저 돌리는 경로',
        implementation:
          '→ GitLab CI가 WSL2 shell executor로 돌아 로컬 환경과 동일. 태그를 밀기 전에 같은 검증을 통과시킴',
        status: 'active',
        icon: '🖥️',
        tags: ['로컬CI', 'pre-push', 'GitLab-CI-Active'],
        type: 'custom',
      },
      {
        name: 'Cloud Run AI Engine',
        category: 'ai',
        importance: 'high',
        description: 'Vercel과 분리해 운영하는 AI 엔진',
        implementation:
          '→ Metrics Query·Analyst·Reporter·Advisor·Vision 에이전트와 지식 검색을 담당',
        status: 'active',
        icon: '☁️',
        tags: ['Cloud-Run', 'AI-Engine', 'Tool-Calling'],
        type: 'commercial',
      },
    ],
  },
};
