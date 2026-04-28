/**
 * KB 문서 시드 스크립트
 *
 * 사용법:
 *   npx tsx scripts/seed-knowledge-base.ts              # 새 문서 추가 (BM25/KRL 텍스트 검색용)
 *   npx tsx scripts/seed-knowledge-base.ts --backfill   # source 이름 통일
 *   npx tsx scripts/seed-knowledge-base.ts --input=scripts/data/knowledge-base.first-batch.json --dry-run
 *   npx tsx scripts/seed-knowledge-base.ts --input=scripts/data/knowledge-base.first-batch.json --upsert
 *
 * knowledge_base 테이블에 운영 지식 문서를 추가합니다.
 * 입력 파일을 주면 해당 배치를 검증하거나, title 기준으로 insert/upsert 할 수 있습니다.
 * 입력 배치에 relationships가 있으면 knowledge_relationships까지 같이 동기화합니다.
 * Knowledge Retrieval Lite request path는 search_knowledge_text BM25 RPC를 사용하므로
 * 이 스크립트는 embedding helper를 호출하지 않습니다.
 */

import './_env';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  HARD_DOC_CHAR_MAX,
  TARGET_DOC_CHAR_MAX,
  TARGET_DOC_CHAR_MIN,
} from '../src/lib/rag-doc-policy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const VALID_RELATIONSHIP_TYPES = new Set([
  'causes',
  'solves',
  'related_to',
  'prerequisite',
  'part_of',
  'similar_to',
  'contradicts',
  'follows',
  'depends_on',
]);

interface KBDocument {
  title: string;
  content: string;
  category: string;
  tags: string[];
  severity: string;
  source: string;
  related_server_types: string[];
  metadata?: Record<string, unknown>;
  relationships?: KBDocumentRelationship[];
}

interface KBDocumentRelationship {
  target_title: string;
  relationship_type: string;
  weight?: number;
  description?: string;
  bidirectional?: boolean;
  metadata?: Record<string, unknown>;
}

interface CliOptions {
  backfill: boolean;
  dryRun: boolean;
  json: boolean;
  inputPath?: string;
  upsert: boolean;
}

interface SeedPlanItem {
  title: string;
  category: string;
  source: string;
  charCount: number;
  tagCount: number;
  relatedServerTypeCount: number;
  relationshipCount: number;
  warnings: string[];
}

interface SeedPlan {
  docCount: number;
  inputPath: string | null;
  mode: 'insert' | 'upsert';
  warnings: string[];
  items: SeedPlanItem[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function getSupabaseEnv() {
  const url = getEnv('SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_KEY');

  if (!url || !key) {
    throw new Error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요');
  }

  return { url, key };
}

function createSupabaseClient(): SupabaseClient {
  const { url, key } = getSupabaseEnv();
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function getStringArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    const value = inline.slice(prefix.length).trim();
    return value.length > 0 ? value : undefined;
  }

  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  const next = process.argv[index + 1];
  if (!next || next.startsWith('--')) return undefined;
  return next.trim();
}

function parseCliOptions(): CliOptions {
  return {
    backfill: hasFlag('--backfill'),
    dryRun: hasFlag('--dry-run'),
    json: hasFlag('--json'),
    inputPath: getStringArg('input'),
    upsert: hasFlag('--upsert'),
  };
}

function resolveInputPath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }

  const cwdCandidate = path.resolve(process.cwd(), inputPath);
  if (existsSync(cwdCandidate)) {
    return cwdCandidate;
  }

  const projectCandidate = path.resolve(PROJECT_ROOT, inputPath);
  if (existsSync(projectCandidate)) {
    return projectCandidate;
  }

  return path.resolve(__dirname, inputPath);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0)
    )
  );
}

function normalizeRelationship(
  raw: unknown,
  index: number,
  docTitle: string
): KBDocumentRelationship {
  const row = asRecord(raw);
  if (!row) {
    throw new Error(`Invalid relationship for "${docTitle}" at index ${index}: expected object`);
  }

  const targetTitle = String(row.target_title ?? '').trim();
  const relationshipType = String(row.relationship_type ?? '').trim();

  if (!targetTitle) {
    throw new Error(`Invalid relationship for "${docTitle}" at index ${index}: missing target_title`);
  }

  if (!VALID_RELATIONSHIP_TYPES.has(relationshipType)) {
    throw new Error(
      `Invalid relationship for "${docTitle}" at index ${index}: unsupported relationship_type "${relationshipType}"`
    );
  }

  const rawWeight = row.weight;
  const weight =
    typeof rawWeight === 'number' && Number.isFinite(rawWeight)
      ? Math.min(1, Math.max(0, rawWeight))
      : undefined;

  return {
    target_title: targetTitle,
    relationship_type: relationshipType,
    weight,
    description: String(row.description ?? '').trim() || undefined,
    bidirectional: Boolean(row.bidirectional),
    metadata: asRecord(row.metadata) ?? undefined,
  };
}

function normalizeRelationships(value: unknown, docTitle: string): KBDocumentRelationship[] {
  if (!Array.isArray(value)) return [];

  const deduped = new Map<string, KBDocumentRelationship>();
  value.forEach((entry, index) => {
    const relationship = normalizeRelationship(entry, index, docTitle);
    const key = `${relationship.target_title.toLowerCase()}|||${relationship.relationship_type}`;
    deduped.set(key, relationship);
  });

  return Array.from(deduped.values());
}

function normalizeDocument(raw: unknown, index: number): KBDocument {
  const row = asRecord(raw);
  if (!row) {
    throw new Error(`Invalid document at index ${index}: expected object`);
  }

  const title = String(row.title ?? '').trim();
  const content = String(row.content ?? '').trim();

  if (!title) {
    throw new Error(`Invalid document at index ${index}: missing title`);
  }
  if (!content) {
    throw new Error(`Invalid document at index ${index}: missing content`);
  }

  const metadata = asRecord(row.metadata) ?? undefined;

  return {
    title,
    content,
    category: String(row.category ?? 'general').trim() || 'general',
    tags: normalizeStringArray(row.tags),
    severity: String(row.severity ?? 'info').trim() || 'info',
    source: String(row.source ?? 'manual').trim() || 'manual',
    related_server_types: normalizeStringArray(row.related_server_types),
    metadata,
    relationships: normalizeRelationships(row.relationships, title),
  };
}

function assertUniqueTitles(documents: KBDocument[]): void {
  const seen = new Map<string, number>();
  for (const [index, doc] of documents.entries()) {
    const normalized = doc.title.trim().toLowerCase();
    const prior = seen.get(normalized);
    if (prior !== undefined) {
      throw new Error(`Duplicate title in batch: "${doc.title}" (indexes ${prior} and ${index})`);
    }
    seen.set(normalized, index);
  }
}

function collectDocumentWarnings(doc: KBDocument): string[] {
  const warnings: string[] = [];
  const charCount = doc.content.length;

  if (charCount < TARGET_DOC_CHAR_MIN) {
    warnings.push(`below-target:${charCount}`);
  } else if (charCount > HARD_DOC_CHAR_MAX) {
    warnings.push(`over-hard-limit:${charCount}`);
  } else if (charCount > TARGET_DOC_CHAR_MAX) {
    warnings.push(`over-target:${charCount}`);
  }

  if (doc.tags.length === 0) {
    warnings.push('missing-tags');
  }

  for (const relationship of doc.relationships || []) {
    if (relationship.target_title === doc.title) {
      warnings.push(`self-relationship:${relationship.relationship_type}`);
    }
  }

  return warnings;
}

function buildSeedPlan(documents: KBDocument[], options: CliOptions): SeedPlan {
  const items = documents.map((doc) => ({
    title: doc.title,
    category: doc.category,
    source: doc.source,
    charCount: doc.content.length,
    tagCount: doc.tags.length,
    relatedServerTypeCount: doc.related_server_types.length,
    relationshipCount: doc.relationships?.length ?? 0,
    warnings: collectDocumentWarnings(doc),
  }));

  const warnings = items.flatMap((item) =>
    item.warnings.map((warning) => `${item.title}: ${warning}`)
  );

  return {
    docCount: documents.length,
    inputPath: options.inputPath ? resolveInputPath(options.inputPath) : null,
    mode: options.upsert ? 'upsert' : 'insert',
    warnings,
    items,
  };
}

function printSeedPlan(plan: SeedPlan, asJson: boolean): void {
  if (asJson) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  console.log(
    `🧪 KB dry-run (${plan.mode}) — docs=${plan.docCount}, input=${plan.inputPath ?? 'built-in seed set'}`
  );
  for (const item of plan.items) {
    const warningText = item.warnings.length > 0 ? ` warnings=${item.warnings.join(',')}` : '';
    console.log(
      `  - [${item.category}] ${item.title} | source=${item.source} | chars=${item.charCount} | tags=${item.tagCount} | rels=${item.relationshipCount}${warningText}`
    );
  }

  if (plan.warnings.length > 0) {
    console.log('\n⚠️ Corpus warnings');
    for (const warning of plan.warnings) {
      console.log(`  - ${warning}`);
    }
  } else {
    console.log('\n✅ Corpus warnings 없음');
  }
}

async function loadDocumentsFromInput(inputPath: string): Promise<KBDocument[]> {
  const resolved = resolveInputPath(inputPath);
  const raw = await readFile(resolved, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid input file: expected array (${resolved})`);
  }

  const documents = parsed.map((row, index) => normalizeDocument(row, index));
  assertUniqueTitles(documents);
  return documents;
}

const SEED_DOCUMENTS: KBDocument[] = [
  // ─── 점진적 메모리 누수 ───
  {
    title: '점진적 메모리 누수 탐지 및 대응 가이드',
    content: `## 점진적 메모리 누수 (Gradual Memory Leak)

### 증상
- 메모리 사용량이 시간 경과에 따라 지속적으로 증가 (시간당 1-5% 상승)
- OOM 이벤트 없이 며칠에 걸쳐 서서히 악화
- GC 빈도 증가, GC 소요 시간 점진적 증가
- 응답 시간이 메모리 증가와 비례하여 느려짐

### OOM과의 차이점
| 구분 | OOM | 점진적 누수 |
|------|-----|------------|
| 속도 | 수분 내 급격한 상승 | 수시간~수일에 걸친 완만한 상승 |
| 감지 | critical alert 즉시 발생 | warning 구간에서 장기 체류 |
| 복구 | 즉시 재시작 필요 | 계획된 재시작 가능 |

### 탐지 방법
1. **24시간 트렌드 분석**: 메모리 사용량의 기울기(slope) 계산
   - 시간당 +2% 이상이면 누수 의심
   - 시간당 +5% 이상이면 누수 확정
2. **GC 메트릭 모니터링**: Full GC 후에도 해제되지 않는 메모리 비율 확인
3. **힙 프로파일링**: Node.js의 경우 --inspect 플래그로 힙 스냅샷 비교

### 대응 기준
- **경고 단계** (slope +2~5%/h): 모니터링 강화, 원인 조사 시작
- **위험 단계** (slope +5%/h 이상): 계획된 rolling restart 수행
- **긴급 단계** (memory >85%): 즉시 재시작, 트래픽 우회

### 일반적 원인
- 이벤트 리스너 미해제
- 캐시 크기 제한 미설정 (unbounded cache)
- 클로저에 의한 의도치 않은 참조 유지
- 전역 변수에 데이터 누적`,
    category: 'troubleshooting',
    tags: ['memory', 'leak', 'gradual', 'gc', 'heap', 'monitoring'],
    severity: 'warning',
    source: 'seed_script',
    related_server_types: ['web', 'api', 'backend'],
  },

  // ─── 연쇄 장애 ───
  {
    title: '연쇄 장애 (Cascading Failure) 패턴 및 차단 전략',
    content: `## 연쇄 장애 (Cascading Failure)

### 전파 패턴
가장 일반적인 연쇄 장애 경로:

\`\`\`
DB 과부하 → API 타임아웃 증가 → 커넥션 풀 고갈 → Web 502 응답 → 사용자 재시도 → 부하 증폭
\`\`\`

### 서버 타입별 전파 시나리오

1. **DB → API → Web 경로** (가장 흔함)
   - DB slow query → API 응답 지연 → Web 타임아웃
   - 징후: DB CPU 상승 → 10-30분 후 API memory 상승 → Web error rate 증가

2. **Cache → API → Web 경로**
   - Redis/Memcached 장애 → cache miss 폭증 → DB 직접 조회 급증 → DB 과부하
   - 징후: Cache 연결 실패 → DB CPU 급등 → API 응답 시간 10x 증가

3. **네트워크 → 전체 서버 경로**
   - 네트워크 지연 증가 → 모든 서비스 간 통신 지연 → 타임아웃 연쇄
   - 징후: 모든 서버의 network 메트릭 동시 상승

### 탐지 지표
- 2개 이상의 서버 타입에서 **10분 이내** 연속 warning/critical 발생
- DB 서버 alert 발생 후 15분 이내 API 서버 alert 발생
- error rate가 baseline 대비 5배 이상 증가

### 차단점 (Circuit Breaker)
1. **DB 레벨**: slow query 자동 kill (30초 이상), 커넥션 수 제한
2. **API 레벨**: 요청 큐 크기 제한, 타임아웃 축소 (30초→5초)
3. **Web 레벨**: rate limiting, 정적 fallback 페이지
4. **Cache 레벨**: local cache fallback, cache-aside 패턴

### 복구 순서
연쇄 장애 시 반드시 **역순**으로 복구:
1. Web 서버 트래픽 차단 (maintenance 모드)
2. API 서버 큐 비우기
3. DB 정상화 확인
4. Cache 워밍업
5. API 서버 정상화 확인
6. Web 트래픽 점진적 복원 (10% → 50% → 100%)`,
    category: 'incident',
    tags: ['cascading', 'failure', 'circuit-breaker', 'recovery', 'chain'],
    severity: 'critical',
    source: 'seed_script',
    related_server_types: ['web', 'api', 'database', 'cache'],
  },

  // ─── 서버 타입별 정상 범위 ───
  {
    title: '서버 타입별 정상 메트릭 범위 기준 (Baseline)',
    content: `## 서버 타입별 정상 범위 기준

각 서버 타입은 역할에 따라 "정상" 메트릭 범위가 다릅니다.
아래는 운영 환경 기준 baseline입니다.

### Web 서버 (Nginx, Apache, Next.js)
| 메트릭 | 정상 범위 | 주의 | 비고 |
|--------|----------|------|------|
| CPU | 10-45% | >60% | 정적 파일은 낮고, SSR은 높음 |
| Memory | 30-55% | >70% | SSR 캐시에 따라 변동 |
| Disk | 10-30% | >60% | 로그 로테이션 필수 |
| Network | 20-50% | >65% | 트래픽에 비례 |

### API 서버 (Express, Fastify, Hono)
| 메트릭 | 정상 범위 | 주의 | 비고 |
|--------|----------|------|------|
| CPU | 15-50% | >65% | JSON 직렬화/역직렬화 비용 |
| Memory | 35-60% | >75% | 요청 처리 중 일시적 상승 정상 |
| Disk | 5-20% | >50% | 로그만 기록 |
| Network | 25-55% | >70% | upstream/downstream 모두 |

### Database 서버 (PostgreSQL, MySQL)
| 메트릭 | 정상 범위 | 주의 | 비고 |
|--------|----------|------|------|
| CPU | 20-55% | >70% | 복잡한 쿼리 시 스파이크 정상 |
| Memory | 50-75% | >85% | 버퍼 캐시 포함 (높은 게 정상) |
| Disk | 30-60% | >75% | WAL + 데이터 + 인덱스 |
| Network | 10-35% | >50% | 결과셋 크기에 비례 |

> **주의**: DB 서버는 Memory 50-75%가 정상입니다. 버퍼/캐시를 적극 활용하므로 메모리가 낮으면 오히려 비효율적입니다.

### Cache 서버 (Redis, Memcached)
| 메트릭 | 정상 범위 | 주의 | 비고 |
|--------|----------|------|------|
| CPU | 5-25% | >40% | 단순 키-값이므로 낮아야 정상 |
| Memory | 40-70% | >80% | eviction 정책에 따라 상한 다름 |
| Disk | 5-15% | >30% | RDB/AOF 백업 시 일시 상승 |
| Network | 30-60% | >75% | 높은 처리량 = 높은 네트워크 |

### Load Balancer / Gateway
| 메트릭 | 정상 범위 | 주의 | 비고 |
|--------|----------|------|------|
| CPU | 5-20% | >35% | L4/L7 프록시만 수행 |
| Memory | 15-35% | >50% | 연결 테이블 크기에 비례 |
| Disk | 5-10% | >20% | 액세스 로그만 |
| Network | 40-70% | >80% | 모든 트래픽 경유 |

### Storage 서버 (NFS, S3 Gateway)
| 메트릭 | 정상 범위 | 주의 | 비고 |
|--------|----------|------|------|
| CPU | 5-15% | >30% | I/O 위주 |
| Memory | 20-40% | >60% | 파일 시스템 캐시 |
| Disk | 40-75% | >85% | 핵심 메트릭, 용량 계획 필수 |
| Network | 20-50% | >65% | 대용량 파일 전송 시 스파이크 |

### 활용 방법
- 각 서버 타입의 baseline과 현재 메트릭을 비교하여 이상 여부 판단
- 글로벌 임계값(80%/90%) 외에 타입별 "주의" 기준 참고
- 시간대별 패턴 고려 (업무시간 vs 야간)`,
    category: 'best_practice',
    tags: ['baseline', 'normal-range', 'server-type', 'threshold', 'metrics'],
    severity: 'info',
    source: 'seed_script',
    related_server_types: ['web', 'api', 'database', 'cache', 'load_balancer', 'storage'],
  },

  // ─── CPU 과부하 진단 ───
  {
    title: 'CPU 사용률 급증 원인 분석 및 대응 가이드',
    content: `## CPU 사용률 급증 (High CPU Utilization)

### 증상
- CPU 사용률이 80% 이상 지속 (5분 이상)
- 응답 시간 급격한 증가 (평소 대비 3x 이상)
- 프로세스 스케줄링 지연으로 전체 시스템 느려짐

### 서버 타입별 주요 원인

**Web 서버**
- SSR 렌더링 과부하 (대규모 페이지 동시 요청)
- 정적 파일 압축(gzip/brotli) 과다
- SSL/TLS 핸드셰이크 폭증

**API 서버**
- JSON 직렬화/역직렬화 대량 처리
- 동기 블로킹 연산 (crypto, 이미지 처리)
- 무한 루프 또는 재귀 호출 버그

**Database 서버**
- Full Table Scan 쿼리 (인덱스 미사용)
- 복잡한 JOIN + 서브쿼리 조합
- VACUUM/ANALYZE 작업 중 부하

### 진단 순서
1. \`top -o %CPU\` — 상위 프로세스 확인
2. \`pidstat -u 1 5\` — 프로세스별 CPU 이력
3. \`perf top\` 또는 \`strace -c -p PID\` — 시스템콜 분석
4. Node.js: \`--prof\` 플래그로 V8 CPU 프로파일링

### 대응 기준
- **경고** (60-80%): 원인 조사 시작, 로드밸런서 트래픽 분산 검토
- **위험** (80-90%): 불필요 프로세스 종료, 트래픽 제한 적용
- **긴급** (>90%, 5분 이상): 인스턴스 수평 확장, 비핵심 배치 중단`,
    category: 'troubleshooting',
    tags: ['cpu', 'high-utilization', 'profiling', 'performance', 'diagnosis'],
    severity: 'warning',
    source: 'seed_script',
    related_server_types: ['web', 'api', 'database'],
  },

  // ─── 디스크 용량 관리 ───
  {
    title: '디스크 용량 부족 예방 및 긴급 대응 가이드',
    content: `## 디스크 용량 관리 (Disk Space Management)

### 주요 원인 (빈도순)
1. **로그 파일 누적**: 로테이션 미설정 시 수일 내 수십 GB 도달
2. **임시 파일**: /tmp, 빌드 캐시, 업로드 임시 파일
3. **DB WAL/binlog**: PostgreSQL WAL, MySQL binlog 미정리
4. **Docker**: 미사용 이미지/컨테이너/볼륨 누적 (docker system df로 확인)

### 서버 타입별 주의사항
| 타입 | 주요 소비자 | 정리 대상 |
|------|-----------|----------|
| Web | access.log, error.log | logrotate 설정 |
| API | application.log, pm2 logs | pm2 flush, logrotate |
| DB | WAL, pg_xlog, binlog | pg_archivecleanup, PURGE BINARY LOGS |
| Cache | RDB/AOF dump | maxmemory-policy 설정 |

### 진단 명령어
\`\`\`bash
df -h                        # 전체 디스크 사용량
du -sh /var/log/*            # 로그 디렉토리별 크기
find / -size +100M -type f   # 100MB 이상 파일 찾기
lsof +L1                    # 삭제됐지만 열려있는 파일
\`\`\`

### 긴급 대응 (사용률 > 90%)
1. 로그 파일 truncate: \`truncate -s 0 /var/log/app.log\`
2. 오래된 로그 삭제: \`find /var/log -name "*.gz" -mtime +7 -delete\`
3. Docker 정리: \`docker system prune -f\`
4. 패키지 캐시 정리: \`apt clean\` / \`yum clean all\`

### 예방 설정
- logrotate: 7일 보관, 100MB 초과 시 로테이션
- 디스크 75% 경고, 85% 위험 알림 설정
- 주간 자동 정리 cron 설정`,
    category: 'troubleshooting',
    tags: ['disk', 'storage', 'cleanup', 'log-rotation', 'capacity'],
    severity: 'warning',
    source: 'seed_script',
    related_server_types: ['web', 'api', 'database', 'storage'],
  },

  // ─── 네트워크 이슈 ───
  {
    title: '네트워크 지연 및 연결 장애 진단 가이드',
    content: `## 네트워크 문제 진단 (Network Troubleshooting)

### 증상 분류
| 증상 | 가능 원인 | 영향 범위 |
|------|----------|----------|
| 전체 서버 동시 지연 | 스위치/라우터 장애, DNS 장애 | 전체 |
| 특정 서비스 간 지연 | 해당 경로 혼잡, 방화벽 규칙 | 부분 |
| 간헐적 패킷 손실 | NIC 결함, MTU 불일치 | 부분 |
| 연결 거부 | 포트 미개방, 서비스 다운 | 해당 서비스 |

### 진단 순서
1. **연결 확인**: \`ping\`, \`telnet host port\`, \`nc -zv host port\`
2. **경로 추적**: \`traceroute\` / \`mtr\` — 어느 구간에서 지연/손실 발생하는지
3. **DNS 확인**: \`dig\`, \`nslookup\` — DNS 응답 시간, 잘못된 레코드
4. **대역폭 확인**: \`iftop\`, \`nethogs\` — 실시간 트래픽 소비 프로세스
5. **연결 상태**: \`ss -tunapl\` — TIME_WAIT, CLOSE_WAIT 과다 여부

### 자주 발생하는 패턴
- **TIME_WAIT 폭증**: 짧은 수명의 HTTP 연결 반복 → connection pooling 도입
- **CLOSE_WAIT 누적**: 애플리케이션이 소켓 미닫음 → 코드 버그 수정
- **DNS 타임아웃**: 내부 DNS 서버 과부하 → local DNS cache 설정
- **MTU 불일치**: VPN/터널 환경에서 1500 → 1400 조정 필요

### 대응
- **즉시**: 영향받는 서비스 health check 결과 확인
- **단기**: 문제 경로 우회 (DNS, 라우팅 변경)
- **장기**: 모니터링 강화 (SNMP, 패킷 캡처 자동화)`,
    category: 'troubleshooting',
    tags: ['network', 'latency', 'packet-loss', 'dns', 'connection', 'diagnosis'],
    severity: 'warning',
    source: 'seed_script',
    related_server_types: ['web', 'api', 'database', 'cache', 'load_balancer'],
  },

  // ─── 보안 인시던트 ───
  {
    title: '보안 인시던트 초기 대응 체크리스트',
    content: `## 보안 인시던트 대응 (Security Incident Response)

### 인시던트 유형별 초동 대응

**1. 비정상 로그인 시도 감지**
- 동일 IP에서 5분 내 10회 이상 실패
- 대응: IP 차단 (iptables/fail2ban), 계정 잠금, 로그 보존

**2. 의심스러운 프로세스 발견**
- 알 수 없는 프로세스가 CPU/네트워크 과다 사용
- 대응: 프로세스 격리 (kill 전 메모리 덤프), 파일 해시 확인

**3. 데이터 유출 의심**
- 비정상적으로 높은 outbound 트래픽
- 대응: 해당 서버 네트워크 격리, 접근 로그 즉시 보존

### 공통 대응 절차
1. **탐지/확인**: 알림 검증, false positive 배제
2. **격리**: 영향 범위 최소화 (네트워크 분리, 서비스 중단)
3. **증거 보존**: 로그, 메모리 덤프, 디스크 이미지 보존
4. **분석**: 침투 경로, 영향 범위, 유출 데이터 파악
5. **복구**: 패치 적용, 자격 증명 교체, 서비스 복원
6. **사후 검토**: 재발 방지 대책, 프로세스 개선

### 점검 명령어
\`\`\`bash
last -n 50                     # 최근 로그인 이력
lastb -n 50                    # 실패한 로그인 시도
netstat -tunapl | grep ESTAB   # 활성 네트워크 연결
find / -perm -4000 -ls         # SUID 파일 확인
cat /etc/passwd | grep ':0:'   # root 권한 계정 확인
\`\`\`

### 모니터링 서버에서의 징후
- 특정 서버의 network outbound 갑자기 3x 이상 증가
- 새벽 시간대(02:00-05:00) 비정상 CPU 사용
- 알 수 없는 프로세스의 외부 IP 통신`,
    category: 'security',
    tags: ['security', 'incident', 'response', 'intrusion', 'forensics'],
    severity: 'critical',
    source: 'seed_script',
    related_server_types: ['web', 'api', 'database'],
  },

  // ─── 로그 분석 패턴 ───
  {
    title: '서버 로그 분석 패턴 및 이상 징후 탐지',
    content: `## 로그 기반 이상 징후 탐지 (Log Analysis Patterns)

### 핵심 로그 패턴

**1. Error Rate 급증 패턴**
- 정상: error/total < 1%
- 경고: error/total 1-5% (5분 윈도우)
- 위험: error/total > 5% 또는 절대 수 100건/분 이상

**2. 응답 시간 이상 패턴**
- P50 정상인데 P99가 5x 이상: 특정 엔드포인트 또는 DB 쿼리 문제
- 전체 percentile 동시 상승: 리소스 부족 (CPU, Memory)
- 점진적 상승 (시간당 +10%): 메모리 누수 또는 커넥션 고갈

**3. 5xx 응답 분류**
| 코드 | 의미 | 주요 원인 |
|------|------|----------|
| 500 | Internal Server Error | 앱 버그, 미처리 예외 |
| 502 | Bad Gateway | upstream 서버 다운 |
| 503 | Service Unavailable | 과부하, 유지보수 |
| 504 | Gateway Timeout | upstream 응답 지연 |

### 로그 분석 명령어
\`\`\`bash
# 최근 1시간 에러 카운트
grep -c "ERROR" /var/log/app.log

# 5xx 응답 빈도 (Nginx access log)
awk '$9 ~ /^5/ {count++} END {print count}' access.log

# 느린 요청 추출 (1초 이상)
awk '$NF > 1.0 {print}' access.log | tail -20

# 시간대별 에러 분포
grep "ERROR" app.log | awk '{print $1, $2}' | cut -d: -f1,2 | sort | uniq -c
\`\`\`

### 자동 탐지 기준 (모니터링 시스템 연동)
- Error rate 5% 초과 → warning 알림
- 5xx 연속 3회 → critical 알림
- P99 latency baseline 대비 5x → warning 알림
- 로그 볼륨 갑자기 10x 증가 → 조사 필요`,
    category: 'best_practice',
    tags: ['log', 'analysis', 'error-rate', 'latency', 'monitoring', 'pattern'],
    severity: 'info',
    source: 'seed_script',
    related_server_types: ['web', 'api', 'database'],
  },

  // ─── Redis/캐시 운영 ───
  {
    title: 'Redis 및 캐시 서버 운영 이슈 대응 가이드',
    content: `## Redis/캐시 서버 운영 (Cache Operations)

### 주요 이슈 및 대응

**1. 메모리 초과 (maxmemory 도달)**
- 증상: SET 명령 실패, OOM 에러
- 진단: \`redis-cli INFO memory\` → used_memory vs maxmemory
- 대응: eviction policy 확인 (allkeys-lru 권장), TTL 미설정 키 정리
- 예방: maxmemory의 80%에 warning 알림 설정

**2. 연결 수 초과**
- 증상: "max number of clients reached" 에러
- 진단: \`redis-cli CLIENT LIST | wc -l\`
- 대응: 유휴 연결 정리 (\`CLIENT KILL\`), connection pool 설정 검토
- 예방: maxclients 설정 + 커넥션 풀 크기 제한

**3. 느린 명령 (Slow Log)**
- 진단: \`redis-cli SLOWLOG GET 10\`
- 주의 명령: KEYS *, SMEMBERS (대규모 집합), SORT
- 대응: KEYS → SCAN으로 교체, 대규모 자료구조 분할

**4. 캐시 관련 장애 패턴**
- **Cache Stampede**: 인기 키 만료 시 동시 DB 조회 → singleflight/lock 패턴
- **Cache Avalanche**: 대량 키 동시 만료 → TTL에 랜덤 jitter 추가
- **Cache Penetration**: 존재하지 않는 키 반복 조회 → Bloom filter

### 모니터링 지표
| 지표 | 정상 범위 | 경고 |
|------|----------|------|
| hit_rate | >90% | <80% → 캐시 전략 재검토 |
| evicted_keys | 0 | >0 → 메모리 부족 징후 |
| connected_clients | <100 | >500 → 커넥션 누수 의심 |
| mem_fragmentation_ratio | 1.0-1.5 | >2.0 → 재시작 고려 |`,
    category: 'troubleshooting',
    tags: ['redis', 'cache', 'memory', 'eviction', 'connection', 'stampede'],
    severity: 'warning',
    source: 'seed_script',
    related_server_types: ['cache', 'api'],
  },
];

// ============================================================================
// Backfill: source 이름 통일
// ============================================================================

async function normalizeSeedSources(supabase: SupabaseClient) {
  console.log('🔧 KB source 이름 통일 시작...\n');

  const { data: wrongSource, error: sourceQueryError } = await supabase
    .from('knowledge_base')
    .select('id, title')
    .eq('source', 'seed-script');

  if (sourceQueryError) {
    console.error('❌ source 조회 실패:', sourceQueryError.message);
  } else if (wrongSource && wrongSource.length > 0) {
    const { error: sourceUpdateError } = await supabase
      .from('knowledge_base')
      .update({ source: 'seed_script' })
      .eq('source', 'seed-script');

    if (sourceUpdateError) {
      console.error('❌ source 통일 실패:', sourceUpdateError.message);
    } else {
      console.log(`✅ source 이름 통일: ${wrongSource.length}건 seed-script → seed_script`);
    }
  } else {
    console.log('ℹ️  source 이름 불일치 없음');
  }
}

// ============================================================================
// Seed: 새 문서 추가
// ============================================================================

function buildWritePayload(doc: KBDocument) {
  const { relationships: _relationships, ...baseDoc } = doc;
  return baseDoc;
}

async function syncDocumentRelationships(
  supabase: SupabaseClient,
  documents: KBDocument[],
  documentIds: Map<string, string>
): Promise<{ inserted: number; updated: number; skipped: number; failed: number }> {
  const relationshipDocs = documents.filter((doc) => (doc.relationships?.length ?? 0) > 0);
  if (relationshipDocs.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0, failed: 0 };
  }

  const allTitles = new Set<string>();
  for (const doc of relationshipDocs) {
    allTitles.add(doc.title);
    for (const relationship of doc.relationships || []) {
      allTitles.add(relationship.target_title);
    }
  }

  const { data: rows, error } = await supabase
    .from('knowledge_base')
    .select('id, title')
    .in('title', Array.from(allTitles));

  if (error) {
    throw new Error(`relationship title lookup failed: ${error.message}`);
  }

  const titleToId = new Map<string, string>(documentIds);
  for (const row of rows || []) {
    if (typeof row.title === 'string' && typeof row.id === 'string') {
      titleToId.set(row.title, row.id);
    }
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of relationshipDocs) {
    const sourceId = titleToId.get(doc.title);
    if (!sourceId) {
      console.warn(`  ⚠️ 관계 source 미해결: ${doc.title}`);
      failed++;
      continue;
    }

    for (const relationship of doc.relationships || []) {
      const targetId = titleToId.get(relationship.target_title);
      if (!targetId) {
        console.warn(`  ⚠️ 관계 target 미해결: ${doc.title} -> ${relationship.target_title}`);
        skipped++;
        continue;
      }

      const payload = {
        source_id: sourceId,
        target_id: targetId,
        source_table: 'knowledge_base',
        target_table: 'knowledge_base',
        relationship_type: relationship.relationship_type,
        weight: relationship.weight ?? 0.7,
        description:
          relationship.description ??
          `${doc.title} → ${relationship.target_title} (${relationship.relationship_type})`,
        bidirectional: relationship.bidirectional ?? false,
        metadata: {
          seeded_by: 'seed-knowledge-base',
          source_title: doc.title,
          target_title: relationship.target_title,
          ...(relationship.metadata || {}),
        },
      };

      const { data: existing, error: existingError } = await supabase
        .from('knowledge_relationships')
        .select('id')
        .eq('source_id', sourceId)
        .eq('target_id', targetId)
        .eq('source_table', 'knowledge_base')
        .eq('target_table', 'knowledge_base')
        .eq('relationship_type', relationship.relationship_type)
        .limit(1);

      if (existingError) {
        console.warn(
          `  ⚠️ 관계 existing 조회 실패: ${doc.title} -> ${relationship.target_title}`,
          existingError.message
        );
        failed++;
        continue;
      }

      const existingId = existing?.[0]?.id;
      if (existingId) {
        const { error: updateError } = await supabase
          .from('knowledge_relationships')
          .update(payload)
          .eq('id', existingId);

        if (updateError) {
          console.warn(
            `  ⚠️ 관계 업데이트 실패: ${doc.title} -> ${relationship.target_title}`,
            updateError.message
          );
          failed++;
        } else {
          console.log(
            `🔗 관계 업데이트: ${doc.title} -> ${relationship.target_title} (${relationship.relationship_type})`
          );
          updated++;
        }
        continue;
      }

      const { error: insertError } = await supabase.from('knowledge_relationships').insert(payload);
      if (insertError) {
        console.warn(
          `  ⚠️ 관계 추가 실패: ${doc.title} -> ${relationship.target_title}`,
          insertError.message
        );
        failed++;
      } else {
        console.log(
          `🔗 관계 추가: ${doc.title} -> ${relationship.target_title} (${relationship.relationship_type})`
        );
        inserted++;
      }
    }
  }

  return { inserted, updated, skipped, failed };
}

async function seedDocuments(
  supabase: SupabaseClient,
  documents: KBDocument[],
  options: CliOptions,
  plan: SeedPlan
) {
  console.log(
    `🌱 KB 시드 시작 (${plan.mode}, docs=${documents.length}, input=${plan.inputPath ?? 'built-in seed set'})...\n`
  );
  if (plan.warnings.length > 0) {
    console.log('⚠️ 실행 전 corpus warning');
    for (const warning of plan.warnings) {
      console.log(`  - ${warning}`);
    }
    console.log('');
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const documentIds = new Map<string, string>();

  for (const doc of documents) {
    // 중복 체크 (title 기준)
    const { data: existing, error: existingError } = await supabase
      .from('knowledge_base')
      .select('id')
      .eq('title', doc.title)
      .limit(1);

    if (existingError) {
      console.error(`❌ 조회 실패: ${doc.title}`, existingError.message);
      failed++;
      continue;
    }

    const existingId = existing?.[0]?.id;
    if (existingId && !options.upsert) {
      console.log(`⏭️  이미 존재: ${doc.title}`);
      documentIds.set(doc.title, existingId);
      skipped++;
      continue;
    }

    const payload = buildWritePayload(doc);

    if (existingId) {
      const { error } = await supabase
        .from('knowledge_base')
        .update(payload)
        .eq('id', existingId);

      if (error) {
        console.error(`❌ 업데이트 실패: ${doc.title}`, error.message);
        failed++;
      } else {
        console.log(`♻️  업데이트: ${doc.title}`);
        documentIds.set(doc.title, existingId);
        updated++;
      }
      continue;
    }

    const { data: insertedRow, error } = await supabase
      .from('knowledge_base')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      console.error(`❌ 추가 실패: ${doc.title}`, error.message);
      failed++;
    } else {
      console.log(`✅ 추가: ${doc.title}`);
      if (typeof insertedRow?.id === 'string') {
        documentIds.set(doc.title, insertedRow.id);
      }
      inserted++;
    }
  }

  const relationshipSummary = await syncDocumentRelationships(supabase, documents, documentIds);

  // 최종 문서 수 확인
  const { count } = await supabase
    .from('knowledge_base')
    .select('id', { count: 'exact', head: true });

  console.log(
    `\n📊 결과: ${inserted}건 추가, ${updated}건 업데이트, ${skipped}건 스킵, ${failed}건 실패`
  );
  console.log(
    `🔗 관계: ${relationshipSummary.inserted}건 추가, ${relationshipSummary.updated}건 업데이트, ${relationshipSummary.skipped}건 스킵, ${relationshipSummary.failed}건 실패`
  );
  console.log(`📚 KB 총 문서 수: ${count ?? '확인 불가'}`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const options = parseCliOptions();

  if (options.backfill && options.inputPath) {
    throw new Error('--backfill 과 --input 은 함께 사용할 수 없습니다');
  }

  if (options.backfill && options.upsert) {
    throw new Error('--backfill 과 --upsert 는 함께 사용할 수 없습니다');
  }

  if (options.backfill) {
    if (options.dryRun) {
      console.log('🧪 KB source normalize dry-run — live DB 조회/수정 없이 종료');
      return;
    }

    const supabase = createSupabaseClient();
    await normalizeSeedSources(supabase);
    return;
  }

  const documents = options.inputPath
    ? await loadDocumentsFromInput(options.inputPath)
    : SEED_DOCUMENTS;
  const plan = buildSeedPlan(documents, options);

  if (options.dryRun) {
    printSeedPlan(plan, options.json);
    return;
  }

  const supabase = createSupabaseClient();
  await seedDocuments(supabase, documents, options, plan);
}

main().catch((error) => {
  console.error('[FATAL] seed-knowledge-base failed:', error);
  process.exit(1);
});
