import type { TechItem } from '@/types/feature-card.types';

export const TECH_STACK_ITEMS: TechItem[] = [
  {
    name: 'React 19',
    category: 'framework',
    importance: 'critical',
    description:
      'Meta의 UI 라이브러리. Concurrent Rendering, Server Components, Suspense, Transitions 등 최신 렌더링 패턴 제공',
    implementation: '→ Concurrent 기능과 Server Components로 성능 최적화 적용',
    version: '19.2.3',
    status: 'active',
    icon: '⚛️',
    tags: ['프레임워크', '오픈소스', 'React'],
    type: 'opensource',
  },
  {
    name: 'Next.js 16',
    category: 'framework',
    importance: 'critical',
    description:
      'Vercel의 React 풀스택 프레임워크. App Router, Server Actions, Partial Prerendering, Edge Runtime, 자동 코드 분할 제공',
    implementation:
      '→ App Router + Server Actions + PPR로 최적화된 렌더링 구현',
    version: '16.1.6',
    status: 'active',
    icon: '▲',
    tags: ['프레임워크', '오픈소스', 'SSR'],
    type: 'opensource',
  },
  {
    name: 'TypeScript 6.0',
    category: 'language',
    importance: 'critical',
    description:
      'Microsoft의 정적 타입 언어. JavaScript 슈퍼셋으로 컴파일 타임 타입 검사, IDE 자동완성, 리팩토링 안전성 제공',
    implementation: '→ strict 모드로 컴파일 타임 오류 방지 및 개발 생산성 향상',
    version: '6.0.2',
    status: 'active',
    icon: '🔷',
    tags: ['언어', '오픈소스', '타입안전'],
    type: 'opensource',
  },
  {
    name: 'Node.js 24 + Hono',
    category: 'language',
    importance: 'critical',
    description:
      'Node.js: V8 기반 서버사이드 JS 런타임. Hono: Web Standards API 기반 초경량 웹 프레임워크로 Express 대비 10배 빠른 성능',
    implementation: '→ Cloud Run에서 AI Engine 백엔드로 운영. TypeScript 기반',
    version: '24.x',
    status: 'active',
    icon: '🚀',
    tags: ['백엔드', 'TypeScript', 'Hono'],
    type: 'opensource',
  },
  {
    name: 'Recharts 3.7',
    category: 'ui',
    importance: 'high',
    description:
      'React 기반 선언적 차트 라이브러리. D3.js 위에 구축, SVG 렌더링, 반응형 컨테이너, 애니메이션 지원. 예측선, 이상치 영역, Brush 줌 등 풍부한 인터랙션 제공',
    implementation:
      '→ TimeSeriesChart(예측+이상치), MiniLineChart(서버카드 스파크라인) 구현. 수백 포인트 규모 데이터에 최적',
    version: '3.7.0',
    status: 'active',
    icon: '📊',
    tags: ['차트', 'SVG', '인터랙티브'],
    type: 'opensource',
  },
  {
    name: 'uPlot',
    category: 'ui',
    importance: 'high',
    description:
      'Canvas 기반 초고성능 시계열 차트 라이브러리. Grafana가 채택한 렌더링 엔진으로, 10,000+ 데이터 포인트도 60fps 유지. SVG 대비 10배 빠른 렌더링',
    implementation:
      '→ RealtimeChart에서 사용. pre-computed JSON → prometheus-to-uplot 변환 → Canvas 렌더링. 다크모드, 드래그 줌, auto-resize 지원',
    version: '1.6.32',
    status: 'active',
    icon: '📈',
    tags: ['Canvas', '고성능', 'Grafana급'],
    type: 'opensource',
  },
  {
    name: 'Prometheus Format',
    category: 'framework',
    importance: 'high',
    description:
      'CNCF 표준 모니터링 데이터 포맷. 라벨 기반 다차원 시계열 모델. hourly-data SSOT의 기본 네이밍으로, OTel Standard로 빌드 타임 변환되어 2-Tier 데이터 아키텍처 구성',
    implementation:
      '→ otel-data/hourly/hour-XX.json(24개, OTel-native SSOT) → MetricsProvider가 직접 소비. Resource Catalog + Timeseries로 서버 메타데이터 표준화',
    version: 'OpenMetrics',
    status: 'active',
    icon: '🔥',
    tags: ['CNCF', '시계열', 'SSOT', 'Metrics'],
    type: 'opensource',
  },
  {
    name: 'OpenTelemetry',
    category: 'framework',
    importance: 'high',
    description:
      'CNCF 관측성 표준. Prometheus 메트릭을 OTel Semantic Convention으로 변환하여 시스템 전체 데이터 일관성 확보. Resource Catalog로 서버 메타데이터 표준화',
    implementation:
      '→ otel-data/가 OTel-native SSOT. MetricsProvider(Vercel)와 precomputed-state(Cloud Run) 모두 OTel 포맷 직접 소비. Resource Catalog로 서버 메타데이터 표준화',
    version: 'Semantic Conv. 1.x',
    status: 'active',
    icon: '🔭',
    tags: ['CNCF', 'Observability', 'Semantic Convention', 'Metrics'],
    type: 'opensource',
  },
  {
    name: 'Loki-Compatible Log Format',
    category: 'framework',
    importance: 'medium',
    description:
      'Grafana Loki Push API와 호환되는 로그 구조. 실제 Loki 서버를 내장한 것은 아니며, 라벨 기반 스트림 모델(job, hostname, level)로 구조화된 로그를 다루기 위한 형식',
    implementation:
      '→ OTel hourly JSON에 로그가 내장(slot.logs[]), 나노초 타임스탬프 + severityText + resource 속성 지원. LogsTab에서 severity 필터링 UI 제공',
    version: 'Loki 3.0+ API',
    status: 'active',
    icon: '📋',
    tags: ['Grafana', 'Logs', 'PLG Stack', 'Structured'],
    type: 'opensource',
  },
  {
    name: 'TanStack Query v5',
    category: 'framework',
    importance: 'high',
    description:
      '비동기 상태 관리 라이브러리. 서버 데이터 캐싱, 자동 리패칭, 낙관적 업데이트, 무한 스크롤, 오프라인 지원',
    implementation: '→ 서버 데이터 캐싱 및 자동 리패칭으로 API 호출 최적화',
    version: '5.x',
    status: 'active',
    icon: '🔄',
    tags: ['상태관리', '캐싱', '비동기'],
    type: 'opensource',
  },
  {
    name: 'Supabase Auth',
    category: 'framework',
    importance: 'critical',
    description:
      'Supabase 인증 서비스. OAuth, Magic Link, 이메일/비밀번호 인증 제공. Row Level Security(RLS)와 통합되어 DB 수준 보안',
    implementation: '→ SSR 패키지로 쿠키 기반 세션 관리. RLS 정책 연동',
    version: 'Auth v2',
    status: 'active',
    icon: '🔒',
    tags: ['인증', '보안', 'Supabase'],
    type: 'commercial',
  },
  {
    name: 'Tailwind CSS 4.1',
    category: 'ui',
    importance: 'high',
    description:
      '유틸리티 퍼스트 CSS 프레임워크. v4 Oxides 엔진으로 빌드 10배 향상, CSS-first 설정, 클래스 기반 스타일링',
    implementation: '→ 컴포넌트 스타일링 전체 적용. 다크 모드, 반응형 지원',
    version: '4.1.18',
    status: 'active',
    icon: '🎨',
    tags: ['UI', 'CSS', '스타일링'],
    type: 'opensource',
  },
  {
    name: 'Radix UI',
    category: 'ui',
    importance: 'high',
    description:
      '접근성 우선 Headless UI 라이브러리. 스타일 없는 프리미티브 컴포넌트로 완전한 커스터마이징 가능. WAI-ARIA 준수',
    implementation: '→ Dialog, Tooltip, Dropdown 등 복잡한 UI 패턴에 사용',
    status: 'active',
    icon: '🏬',
    tags: ['UI', '접근성', '컴포넌트'],
    type: 'opensource',
  },
  {
    name: 'Zustand 5.0',
    category: 'framework',
    importance: 'medium',
    description:
      '경량 상태 관리 라이브러리. Redux 대비 간결한 API, 미들웨어 지원, React 외부에서도 사용 가능. 번들 사이즈 1KB',
    implementation: '→ 글로벌 UI 상태 및 Admin 설정 관리에 사용',
    version: '5.0.11',
    status: 'active',
    icon: '🧰',
    tags: ['상태관리', 'Store', 'React'],
    type: 'opensource',
  },
  {
    name: 'Zod 4',
    category: 'framework',
    importance: 'high',
    description:
      'TypeScript-first 스키마 선언 및 검증 라이브러리. 런타임 타입 검증, 자동 타입 추론, 파서 조합, 커스텀 에러 메시지 지원',
    implementation:
      '→ API 응답/요청 검증, 환경변수 검증, 폼 유효성 검사에 전역 사용',
    version: '4.0',
    status: 'active',
    icon: '🛡️',
    tags: ['검증', 'TypeScript', '스키마'],
    type: 'opensource',
  },
];
