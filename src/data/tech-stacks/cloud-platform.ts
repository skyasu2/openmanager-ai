import type { TechItem } from '@/types/feature-card.types';

export const CLOUD_PLATFORM_TECH_STACK: TechItem[] = [
  {
    name: 'Vercel Platform',
    category: 'deployment',
    importance: 'critical',
    description:
      '프론트엔드 배포에 최적화된 클라우드 플랫폼. 글로벌 Edge Network, 자동 HTTPS, Preview Deployments, 서버리스 Functions 제공',
    implementation:
      '→ GitLab canonical push 이후 GitLab CI가 배포 게이트를 거쳐 Vercel production으로 반영',
    status: 'active',
    icon: '▲',
    tags: ['배포', '클라우드 호스팅', '전역 CDN'],
    type: 'commercial',
  },
  {
    name: 'Supabase PostgreSQL',
    category: 'database',
    importance: 'critical',
    description:
      '오픈소스 Firebase 대안 BaaS. PostgreSQL 기반으로 인증, 스토리지, 실시간 구독, Row Level Security를 통합 제공',
    implementation:
      '→ 운영 지식/사용자 상태 저장, search_knowledge_text RPC, Auth/RLS 기반 접근 제어에 사용. 지식 검색은 Postgres FTS serving index로 단순화',
    status: 'active',
    icon: '🐘',
    tags: ['데이터베이스', 'PostgreSQL', 'RLS', 'BaaS'],
    type: 'commercial',
  },
  {
    name: 'GCP Cloud Run',
    category: 'deployment',
    importance: 'high',
    description:
      'Google Cloud 서버리스 컨테이너 플랫폼. Scale to Zero로 유휴 비용 제로, 트래픽 증가 시 자동 확장, 콜드 스타트 최소화',
    implementation:
      '→ Node.js 24 + Hono AI Engine 운영. asia-northeast1(서울) 배포',
    status: 'active',
    icon: '☁️',
    tags: ['CloudRun', 'Container', 'Serverless'],
    type: 'commercial',
  },
  {
    name: 'Google Cloud Tasks',
    category: 'deployment',
    importance: 'high',
    description:
      'HTTP 작업을 큐잉하고 재시도/dispatch 속도를 제어하는 GCP managed queue. 주기 실행기가 아니라 사용자 요청에서 파생된 비동기 AI job delivery에 사용',
    implementation:
      '→ /api/ai/jobs 생성 후 Cloud Run /api/jobs/dispatch가 /api/jobs/process HTTP task를 생성. pending task가 없으면 비용과 실행이 발생하지 않음',
    status: 'active',
    icon: '📬',
    tags: ['CloudTasks', 'Queue', 'Async Jobs'],
    type: 'commercial',
  },
  {
    name: 'Docker Compose + Preflight',
    category: 'deployment',
    importance: 'high',
    description:
      'Cloud Run AI Engine을 로컬에서 Compose로 실행하고 build-only preflight로 컨테이너 빌드 실패를 먼저 잡는 검증 경로',
    implementation:
      '→ 운영 이미지는 Cloud Build가 생성하고, 로컬 Docker는 WSL 개발 환경의 AI Engine 실행과 배포 전 사전 검증에 집중',
    version: '24.0.x',
    status: 'active',
    icon: '🐋',
    tags: ['Docker', 'Compose', 'Preflight'],
    type: 'opensource',
  },
  {
    name: 'GitLab + ci:local',
    category: 'deployment',
    importance: 'medium',
    description:
      'GitLab canonical 저장소와 로컬 shell 직접 검증을 결합한 운영 워크플로우. 외부 SaaS CI 의존을 줄이고 배포 권위와 공개 저장소를 분리',
    implementation:
      '→ git push gitlab main 이후 GitLab CI(shell executor)가 배포를 이어받고, npm run ci:local 로 로컬 사전 검증 수행 (동일 WSL2 환경 직접 실행)',
    status: 'active',
    icon: '🦊',
    tags: ['GitLab', 'Local CI', 'Vercel'],
    type: 'commercial',
  },
  {
    name: 'Upstash Redis',
    category: 'cache',
    importance: 'critical',
    description:
      'Serverless Redis 서비스. 글로벌 복제, 초저지연 상태 저장, 사용량 기반 과금. REST API로 Edge 환경에서도 접근 가능',
    implementation:
      '→ 요청 제한, AI 제공자별 쿼터/쿨다운, AI job 중복 방지, Langfuse 사용량 카운터, 단기 cache/session 상태로 호출 폭주와 중복 실행 제어',
    status: 'active',
    icon: '⚡',
    tags: ['Redis', 'Serverless', 'Rate-Limit', 'Quota'],
    type: 'commercial',
  },
  {
    name: 'Pino',
    category: 'deployment',
    importance: 'medium',
    description:
      'Node.js 초고속 JSON 로깅 라이브러리. 낮은 오버헤드, 구조화된 로그, Child Logger 지원. Bunyan/Winston 대비 5배 빠른 성능',
    implementation:
      '→ 서버/브라우저 통합 로거 구현. Cloud Run에서 GCP Cloud Logging 호환 포맷 출력',
    version: '10.3',
    status: 'active',
    icon: '📋',
    tags: ['Logging', 'JSON', 'Performance'],
    type: 'opensource',
  },
];
