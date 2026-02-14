# 배포 아키텍처

> **최종 갱신**: 2026-01-18

## 🚀 Vercel 배포 시스템

### 플랫폼 구성
- **Vercel**: Edge Network 글로벌 배포
- **무료 티어**: 30GB/월 (현재 30% 사용)
- **자동 배포**: GitHub main 브랜치 트리거
- **성능**: 152ms 평균 응답시간

### 배포 파이프라인
```typescript
// GitHub → Vercel 자동 배포
const deploymentFlow = {
  trigger: 'git push origin main',
  build: 'npm run build',
  output: '.next (standalone)',
  deploy: 'Edge Network',
  domain: 'openmanager-ai.vercel.app'
};

// vercel.json 최적화
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "regions": ["icn1", "sin1", "nrt1"], // 아시아 중심
  "functions": {
    "app/**/*.tsx": {
      "runtime": "nodejs20.x",
      "memory": 512
    }
  }
}
```

### Edge Network 전략
```typescript
// 글로벌 배포 최적화
const edgeConfig = {
  primary: 'ICN1 (Seoul)', // 주요 사용자층
  secondary: ['SIN1 (Singapore)', 'NRT1 (Tokyo)'], // 아시아 백업
  cache: {
    static_assets: '24h',
    api_responses: '5min',
    pages: '1h'
  }
};

// Next.js 16 최적화
const nextConfig = {
  output: 'standalone',
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@heroicons/react', 'lucide-react']
  },
  compress: true,
  poweredByHeader: false
};
```

### 성능 최적화
```typescript
// 번들 크기 최적화
const bundleOptimization = {
  before: '2.1MB',
  after: '850KB', // 60% 감소
  techniques: [
    'tree_shaking',
    'code_splitting',
    'dynamic_imports',
    'package_optimization'
  ]
};

// 로딩 성능
const performanceMetrics = {
  fcp: '1.2s', // First Contentful Paint
  lcp: '1.8s', // Largest Contentful Paint
  cls: '0.05', // Cumulative Layout Shift
  fid: '15ms'  // First Input Delay
};
```

### CI/CD 자동화
```yaml
# GitHub Actions (선택사항)
name: Deploy to Vercel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - name: Deploy to Vercel
        run: vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
```

### 모니터링
- **배포 성공률**: 99.5%
- **빌드 시간**: 평균 3-5분
- **Zero Downtime**: 자동 롤백 지원
- **실시간 로그**: Vercel Analytics 통합
