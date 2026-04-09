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
      '오픈소스 Firebase 대안 BaaS. PostgreSQL 기반으로 인증, 스토리지, 실시간 구독, Edge Functions, 벡터 검색(pgVector) 통합 제공',
    implementation: '→ pgVector로 AI 벡터 검색, RLS로 행 수준 보안 적용',
    status: 'active',
    icon: '🐘',
    tags: ['데이터베이스', 'pgVector', 'BaaS'],
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
    name: 'Docker',
    category: 'deployment',
    importance: 'high',
    description:
      '컨테이너 기반 가상화 플랫폼. 애플리케이션과 의존성을 패키징하여 어디서든 동일하게 실행. 개발-프로덕션 환경 일관성 보장',
    implementation:
      '→ WSL + Docker로 Cloud Run 로컬 에뮬레이션. 환경 불일치 원천 차단',
    version: '24.0.x',
    status: 'active',
    icon: '🐋',
    tags: ['Docker', 'Container', 'DevOps'],
    type: 'opensource',
  },
  {
    name: 'GitLab + Local Docker CI',
    category: 'deployment',
    importance: 'medium',
    description:
      'GitLab canonical 저장소와 로컬 Docker 기반 검증 경로를 결합한 운영 워크플로우. 외부 SaaS CI 의존을 줄이고 배포 권위와 공개 저장소를 분리',
    implementation:
      '→ git push gitlab main 이후 GitLab CI가 배포를 이어받고, npm run ci:local:docker 로 로컬 사전 검증 수행',
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
      'Serverless Redis 서비스. 글로벌 복제, 초저지연 캐싱, 사용량 기반 과금. REST API로 Edge 환경에서도 접근 가능',
    implementation:
      '→ AI 응답 캐싱(3시간 TTL), API Rate Limiting으로 할당량 보호',
    status: 'active',
    icon: '⚡',
    tags: ['Redis', 'Serverless', 'Cache', 'Rate-Limit'],
    type: 'commercial',
  },
  {
    name: 'Sentry',
    category: 'deployment',
    importance: 'medium',
    description:
      '프로덕션 에러 모니터링 및 성능 추적 플랫폼. 크래시 리포트, 성능 병목 탐지, Release Health 추적 제공',
    implementation:
      '→ 에러 발생 시 스택 트레이스, 브레드크럼 자동 수집. Next.js Client/Server/Edge 전체 커버',
    version: '10.39',
    status: 'active',
    icon: '🛡️',
    tags: ['Error-Tracking', 'Performance', 'Monitoring'],
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
