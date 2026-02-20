import type { TechItem } from '@/types/feature-card.types';

export const CLOUD_PLATFORM_TECH_STACK: TechItem[] = [
    {
      name: 'Vercel Platform',
      category: 'deployment',
      importance: 'critical',
      description:
        '프론트엔드 배포에 최적화된 클라우드 플랫폼. 글로벌 Edge Network, 자동 HTTPS, Preview Deployments, 서버리스 Functions 제공',
      implementation: '→ GitHub 연동 자동 빌드/배포. Next.js 16 최적화 호스팅',
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
      name: 'GitHub Actions',
      category: 'deployment',
      importance: 'medium',
      description:
        'GitHub 내장 CI/CD 플랫폼. YAML 기반 워크플로우 정의, 다양한 러너 환경, 마켓플레이스 액션으로 자동화 파이프라인 구축',
      implementation: '→ Push 시 자동 테스트→빌드→배포 파이프라인 실행',
      status: 'active',
      icon: '🔄',
      tags: ['CI/CD', '자동화', '워크플로우'],
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
      version: '10.34',
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
      version: '10.1',
      status: 'active',
      icon: '📋',
      tags: ['Logging', 'JSON', 'Performance'],
      type: 'opensource',
    },
];
