/**
 * Command Vectors Seed Script
 * RAG 명령어 벡터 초기 데이터 시딩
 *
 * Mistral mistral-embed (1024 dimensions)
 * - 1회 실행용 (백그라운드 작업 아님)
 * - 예상 임베딩: ~25개 명령어 × 1 API call = 25 calls
 *
 * 실행: npx tsx src/scripts/seed-command-vectors.ts
 *
 * @version 2.0.0 - Mistral embedding migration (2025-12-31)
 */

import { createClient } from '@supabase/supabase-js';
import { createMistral } from '@ai-sdk/mistral';
import { embedMany } from 'ai';
import dotenv from 'dotenv';
import path from 'path';

// Load Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ============================================================================
// 1. 명령어 시드 데이터 정의
// ============================================================================

interface CommandEntry {
  id: string;
  content: string;
  metadata: {
    category: string;
    tags: string[];
    commands: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  };
}

const COMMAND_ENTRIES: CommandEntry[] = [
  // ============================================================================
  // Linux 기본 명령어
  // ============================================================================
  {
    id: 'linux-top',
    content:
      'top 명령어는 실시간으로 실행 중인 프로세스를 모니터링합니다. CPU, 메모리 사용량을 확인할 수 있습니다.',
    metadata: {
      category: 'linux',
      tags: ['process', 'monitoring', 'cpu', 'memory'],
      commands: ['top', 'htop'],
      difficulty: 'intermediate',
    },
  },
  {
    id: 'linux-grep',
    content:
      'grep 명령어는 파일에서 특정 패턴을 검색합니다. grep -r로 재귀 검색, grep -i로 대소문자 무시 검색이 가능합니다.',
    metadata: {
      category: 'linux',
      tags: ['search', 'text', 'pattern', 'regex'],
      commands: ['grep', 'grep -r', 'grep -i'],
      difficulty: 'intermediate',
    },
  },
  {
    id: 'linux-ps',
    content:
      'ps 명령어는 현재 실행 중인 프로세스 목록을 표시합니다. ps aux로 모든 프로세스, ps -ef로 전체 포맷을 확인합니다.',
    metadata: {
      category: 'linux',
      tags: ['process', 'monitoring', 'system'],
      commands: ['ps', 'ps aux', 'ps -ef'],
      difficulty: 'beginner',
    },
  },
  {
    id: 'linux-df',
    content:
      'df 명령어는 디스크 사용량을 확인합니다. df -h로 사람이 읽기 쉬운 형식으로 출력합니다.',
    metadata: {
      category: 'linux',
      tags: ['disk', 'storage', 'monitoring'],
      commands: ['df', 'df -h', 'df -i'],
      difficulty: 'beginner',
    },
  },
  {
    id: 'linux-du',
    content:
      'du 명령어는 디렉토리 및 파일의 디스크 사용량을 확인합니다. du -sh로 요약 보기가 가능합니다.',
    metadata: {
      category: 'linux',
      tags: ['disk', 'storage', 'directory'],
      commands: ['du', 'du -sh', 'du -h --max-depth=1'],
      difficulty: 'beginner',
    },
  },
  {
    id: 'linux-free',
    content:
      'free 명령어는 메모리 사용량을 확인합니다. free -h로 사람이 읽기 쉬운 형식으로 출력합니다.',
    metadata: {
      category: 'linux',
      tags: ['memory', 'ram', 'monitoring'],
      commands: ['free', 'free -h', 'free -m'],
      difficulty: 'beginner',
    },
  },
  {
    id: 'linux-netstat',
    content:
      'netstat 명령어는 네트워크 연결 상태를 확인합니다. netstat -tlnp로 열린 포트를 확인할 수 있습니다.',
    metadata: {
      category: 'linux',
      tags: ['network', 'port', 'connection'],
      commands: ['netstat', 'netstat -tlnp', 'netstat -an'],
      difficulty: 'intermediate',
    },
  },
  {
    id: 'linux-ss',
    content:
      'ss 명령어는 netstat의 현대적 대안으로, 소켓 통계를 빠르게 확인합니다. ss -tlnp로 열린 포트 확인.',
    metadata: {
      category: 'linux',
      tags: ['network', 'socket', 'port'],
      commands: ['ss', 'ss -tlnp', 'ss -s'],
      difficulty: 'intermediate',
    },
  },
  {
    id: 'linux-tail',
    content:
      'tail 명령어는 파일의 마지막 부분을 출력합니다. tail -f로 실시간 로그 모니터링이 가능합니다.',
    metadata: {
      category: 'linux',
      tags: ['log', 'file', 'monitoring'],
      commands: ['tail', 'tail -f', 'tail -n 100'],
      difficulty: 'beginner',
    },
  },
  {
    id: 'linux-journalctl',
    content:
      'journalctl 명령어는 systemd 저널 로그를 확인합니다. journalctl -u nginx로 특정 서비스 로그를 봅니다.',
    metadata: {
      category: 'linux',
      tags: ['log', 'systemd', 'service'],
      commands: ['journalctl', 'journalctl -u', 'journalctl -f'],
      difficulty: 'intermediate',
    },
  },
  {
    id: 'linux-systemctl',
    content:
      'systemctl 명령어는 systemd 서비스를 관리합니다. start, stop, restart, status 등으로 서비스를 제어합니다.',
    metadata: {
      category: 'linux',
      tags: ['service', 'systemd', 'daemon'],
      commands: [
        'systemctl start',
        'systemctl stop',
        'systemctl restart',
        'systemctl status',
      ],
      difficulty: 'intermediate',
    },
  },

  // ============================================================================
  // Docker 명령어
  // ============================================================================
  {
    id: 'docker-run',
    content:
      'docker run 명령어는 컨테이너를 실행합니다. -d로 백그라운드, -p로 포트 매핑, -v로 볼륨 마운트가 가능합니다.',
    metadata: {
      category: 'docker',
      tags: ['container', 'run', 'deployment'],
      commands: ['docker run', 'docker run -d', 'docker run -p'],
      difficulty: 'intermediate',
    },
  },
  {
    id: 'docker-ps',
    content:
      'docker ps 명령어는 실행 중인 컨테이너 목록을 표시합니다. docker ps -a로 모든 컨테이너를 확인합니다.',
    metadata: {
      category: 'docker',
      tags: ['container', 'list', 'monitoring'],
      commands: ['docker ps', 'docker ps -a', 'docker ps -q'],
      difficulty: 'beginner',
    },
  },
  {
    id: 'docker-logs',
    content:
      'docker logs 명령어는 컨테이너 로그를 확인합니다. -f로 실시간 모니터링, --tail로 마지막 N줄만 확인합니다.',
    metadata: {
      category: 'docker',
      tags: ['container', 'log', 'debugging'],
      commands: ['docker logs', 'docker logs -f', 'docker logs --tail'],
      difficulty: 'beginner',
    },
  },
  {
    id: 'docker-exec',
    content:
      'docker exec 명령어는 실행 중인 컨테이너에서 명령을 실행합니다. -it로 대화형 셸 접근이 가능합니다.',
    metadata: {
      category: 'docker',
      tags: ['container', 'shell', 'debug'],
      commands: ['docker exec', 'docker exec -it', 'docker exec bash'],
      difficulty: 'intermediate',
    },
  },
  {
    id: 'docker-compose',
    content:
      'docker compose 명령어는 멀티 컨테이너 애플리케이션을 관리합니다. up, down, logs 등으로 서비스를 제어합니다.',
    metadata: {
      category: 'docker',
      tags: ['compose', 'multi-container', 'orchestration'],
      commands: ['docker compose up', 'docker compose down', 'docker compose logs'],
      difficulty: 'advanced',
    },
  },
  {
    id: 'docker-system-prune',
    content:
      'docker system prune 명령어는 사용하지 않는 Docker 리소스를 정리합니다. -a로 모든 미사용 이미지도 제거합니다.',
    metadata: {
      category: 'docker',
      tags: ['cleanup', 'disk', 'maintenance'],
      commands: ['docker system prune', 'docker system prune -a', 'docker image prune'],
      difficulty: 'intermediate',
    },
  },

  // ============================================================================
  // Kubernetes 명령어
  // ============================================================================
  {
    id: 'k8s-kubectl-get',
    content:
      'kubectl get 명령어는 Kubernetes 리소스를 조회합니다. pods, services, nodes 등 다양한 리소스를 확인할 수 있습니다.',
    metadata: {
      category: 'kubernetes',
      tags: ['k8s', 'resource', 'monitoring'],
      commands: ['kubectl get pods', 'kubectl get services', 'kubectl get nodes'],
      difficulty: 'advanced',
    },
  },
  {
    id: 'k8s-kubectl-describe',
    content:
      'kubectl describe 명령어는 리소스의 상세 정보를 확인합니다. 이벤트, 상태, 설정 등을 자세히 볼 수 있습니다.',
    metadata: {
      category: 'kubernetes',
      tags: ['k8s', 'debug', 'detail'],
      commands: ['kubectl describe pod', 'kubectl describe node', 'kubectl describe service'],
      difficulty: 'advanced',
    },
  },
  {
    id: 'k8s-kubectl-logs',
    content:
      'kubectl logs 명령어는 파드의 로그를 확인합니다. -f로 실시간 로그, --previous로 이전 컨테이너 로그를 봅니다.',
    metadata: {
      category: 'kubernetes',
      tags: ['k8s', 'log', 'debugging'],
      commands: ['kubectl logs', 'kubectl logs -f', 'kubectl logs --previous'],
      difficulty: 'advanced',
    },
  },

  // ============================================================================
  // Windows 명령어
  // ============================================================================
  {
    id: 'windows-tasklist',
    content:
      'tasklist 명령어는 Windows에서 실행 중인 프로세스 목록을 표시합니다. taskkill로 프로세스를 종료할 수 있습니다.',
    metadata: {
      category: 'windows',
      tags: ['process', 'monitoring', 'task'],
      commands: ['tasklist', 'taskkill'],
      difficulty: 'intermediate',
    },
  },
  {
    id: 'windows-netstat',
    content:
      'netstat 명령어는 Windows에서 네트워크 연결 상태를 확인합니다. netstat -an으로 모든 연결을 확인합니다.',
    metadata: {
      category: 'windows',
      tags: ['network', 'port', 'connection'],
      commands: ['netstat', 'netstat -an', 'netstat -b'],
      difficulty: 'intermediate',
    },
  },
  {
    id: 'windows-sfc',
    content:
      'sfc /scannow 명령어는 Windows 시스템 파일 무결성을 검사하고 복구합니다. 관리자 권한이 필요합니다.',
    metadata: {
      category: 'windows',
      tags: ['system', 'repair', 'integrity'],
      commands: ['sfc /scannow', 'DISM /Online /Cleanup-Image /RestoreHealth'],
      difficulty: 'advanced',
    },
  },

  // ============================================================================
  // 네트워크 진단 명령어
  // ============================================================================
  {
    id: 'network-ping',
    content:
      'ping 명령어는 네트워크 연결을 테스트합니다. 대상 호스트에 ICMP 패킷을 보내 응답 시간을 측정합니다.',
    metadata: {
      category: 'network',
      tags: ['connectivity', 'latency', 'icmp'],
      commands: ['ping', 'ping -c 4', 'ping -t'],
      difficulty: 'beginner',
    },
  },
  {
    id: 'network-traceroute',
    content:
      'traceroute 명령어는 패킷이 목적지까지 가는 경로를 추적합니다. 네트워크 병목 지점을 파악할 수 있습니다.',
    metadata: {
      category: 'network',
      tags: ['route', 'path', 'debugging'],
      commands: ['traceroute', 'tracert', 'mtr'],
      difficulty: 'intermediate',
    },
  },
  {
    id: 'network-curl',
    content:
      'curl 명령어는 URL로 데이터를 전송합니다. HTTP 요청 테스트, API 호출, 파일 다운로드에 사용됩니다.',
    metadata: {
      category: 'network',
      tags: ['http', 'api', 'request'],
      commands: ['curl', 'curl -v', 'curl -X POST'],
      difficulty: 'intermediate',
    },
  },
];

// ============================================================================
// 2. 임베딩 및 시딩 로직
// ============================================================================

async function seedCommandVectors() {
  console.log('🚀 Command Vectors Seeding Started...\n');

  // 환경변수 확인
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const mistralApiKey = process.env.MISTRAL_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  if (!mistralApiKey) {
    console.error('❌ Missing Mistral API key (MISTRAL_API_KEY)');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 스키마 확인 (1024d 테스트)
  console.log('🔍 Checking schema dimension...');
  const testVector = new Array(1024).fill(0.1);
  const { error: schemaError } = await supabase.from('command_vectors').insert({
    id: 'test-schema-check',
    content: 'test',
    metadata: {},
    embedding: JSON.stringify(testVector),
  });

  if (schemaError?.message.includes('dimensions')) {
    console.error('❌ Schema is not 1024d. Please run the DDL migration first.');
    console.error('   Error:', schemaError.message);
    process.exit(1);
  }

  // 테스트 데이터 삭제
  await supabase.from('command_vectors').delete().eq('id', 'test-schema-check');
  console.log('✅ Schema is 1024d\n');

  console.log(`📦 Preparing ${COMMAND_ENTRIES.length} command entries...\n`);

  // 1. 임베딩 생성 (배치)
  console.log('🧠 Generating embeddings with Mistral mistral-embed (1024d)...');

  const texts = COMMAND_ENTRIES.map(
    (e) => `${e.metadata.commands.join(', ')}: ${e.content}`
  );

  const mistral = createMistral({ apiKey: mistralApiKey });
  const model = mistral.embedding('mistral-embed');
  const { embeddings } = await embedMany({
    model,
    values: texts,
    experimental_telemetry: { isEnabled: false },
  });

  console.log(`✅ Generated ${embeddings.length} embeddings (1024 dimensions)\n`);

  // 2. Supabase에 삽입
  console.log('📝 Inserting into command_vectors table...');

  let insertedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < COMMAND_ENTRIES.length; i++) {
    const entry = COMMAND_ENTRIES[i]!;
    const embedding = embeddings[i]!;
    const vectorString = `[${embedding.join(',')}]`;

    // 중복 체크 (id 기준)
    const { data: existing } = await supabase
      .from('command_vectors')
      .select('id')
      .eq('id', entry.id)
      .maybeSingle();

    if (existing) {
      skippedCount++;
      process.stdout.write(
        `\r⏳ Processing... ${i + 1}/${COMMAND_ENTRIES.length} (skipped: ${skippedCount})`
      );
      continue;
    }

    // 삽입
    const { error } = await supabase.from('command_vectors').insert({
      id: entry.id,
      content: entry.content,
      metadata: entry.metadata,
      embedding: vectorString,
    });

    if (error) {
      console.error(`\n❌ Failed to insert "${entry.id}":`, error.message);
    } else {
      insertedCount++;
    }

    process.stdout.write(`\r⏳ Processing... ${i + 1}/${COMMAND_ENTRIES.length}`);
  }

  console.log('\n');
  console.log('═'.repeat(50));
  console.log(`✅ Seed Completed!`);
  console.log(`   - Inserted: ${insertedCount}`);
  console.log(`   - Skipped (duplicates): ${skippedCount}`);
  console.log(`   - Total entries: ${COMMAND_ENTRIES.length}`);
  console.log('═'.repeat(50));
}

// 실행
seedCommandVectors().catch(console.error);
