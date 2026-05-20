#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase env. Required: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, plus a service/anon key.'
  );
  process.exit(2);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const checks = [
  {
    label: 'search_knowledge_text:cpu',
    minRows: 1,
    expectedTopTitleIncludesAny: ['CPU'],
    args: {
      p_query_text: 'cpu',
      p_max_results: 3,
      p_filter_category: null,
    },
  },
  {
    label: 'search_knowledge_text:cpu-processor-alias',
    minRows: 1,
    expectedTopTitleIncludesAny: ['CPU 사용률 급증', 'CPU 사용량 급증'],
    args: {
      p_query_text: '프로세서 사용률 급증',
      p_max_results: 3,
      p_filter_category: null,
    },
  },
  {
    label: 'search_knowledge_text:cpu-high-load',
    minRows: 1,
    expectedTopTitleIncludesAny: ['CPU 사용률 급증', 'CPU 사용량 급증'],
    args: {
      p_query_text: 'cpu high load',
      p_max_results: 3,
      p_filter_category: null,
    },
  },
  {
    label: 'search_knowledge_text:disk-cleanup',
    minRows: 1,
    expectedTopTitleIncludesAny: ['디스크'],
    args: {
      p_query_text: 'disk space cleanup',
      p_max_results: 3,
      p_filter_category: null,
    },
  },
  {
    label: 'search_knowledge_text:redis-memory',
    minRows: 1,
    expectedAnyTitleIncludesAny: ['Redis', 'Cache 서버'],
    args: {
      p_query_text: 'redis memory',
      p_max_results: 3,
      p_filter_category: null,
    },
  },
  {
    label: 'search_knowledge_text:topology',
    minRows: 1,
    expectedTopTitleIncludesAny: ['토폴로지'],
    args: {
      p_query_text: 'server topology dependency',
      p_max_results: 3,
      p_filter_category: null,
    },
  },
  {
    label: 'search_knowledge_text:korean-topology-diagram',
    minRows: 1,
    expectedCategory: 'architecture',
    expectedTopTitleIncludesAny: ['토폴로지'],
    args: {
      p_query_text: '서버 토폴로지 구성도',
      p_max_results: 3,
      p_filter_category: 'architecture',
    },
  },
  {
    label: 'search_knowledge_text:otel-ssot-path',
    minRows: 1,
    expectedCategory: 'architecture',
    expectedTopTitleIncludesAny: ['OpenManager OTel 데이터 SSOT 경로'],
    args: {
      p_query_text: 'OTel 데이터 SSOT 경로',
      p_max_results: 3,
      p_filter_category: 'architecture',
    },
  },
  {
    label: 'search_knowledge_text:nginx-5xx-precision',
    minRows: 1,
    expectedTopTitleIncludesAny: ['웹 서버', 'Web 서버', 'Load Balancer'],
    forbiddenTopTitleIncludesAny: ['Storage 서버'],
    args: {
      p_query_text: 'nginx 5xx gateway timeout',
      p_max_results: 3,
      p_filter_category: null,
    },
  },
  {
    label: 'search_knowledge_text:systemctl-command-backfill',
    minRows: 1,
    expectedTopTitleIncludesAny: ['Command: linux-systemctl'],
    args: {
      p_query_text: 'systemctl service status restart',
      p_max_results: 3,
      p_filter_category: 'command',
    },
  },
  {
    label: 'search_knowledge_text:sfc-command-backfill',
    minRows: 1,
    expectedTopTitleIncludesAny: ['Command: windows-sfc'],
    args: {
      p_query_text: 'sfc scannow dism',
      p_max_results: 3,
      p_filter_category: 'command',
    },
  },
  {
    label: 'search_knowledge_text:docker-run-command-backfill',
    minRows: 1,
    expectedTopTitleIncludesAny: ['Command: docker-run'],
    args: {
      p_query_text: 'docker run port volume',
      p_max_results: 3,
      p_filter_category: 'command',
    },
  },
  {
    label: 'search_knowledge_text:category-architecture',
    minRows: 1,
    expectedCategory: 'architecture',
    args: {
      p_query_text: '서버 토폴로지 구조가 어떻게 되나요?',
      p_max_results: 3,
      p_filter_category: 'architecture',
    },
  },
  {
    label: 'search_knowledge_text:category-command',
    minRows: 1,
    expectedCategory: 'command',
    args: {
      p_query_text: 'CPU 진단 명령어 알려줘',
      p_max_results: 3,
      p_filter_category: 'command',
    },
  },
  {
    label: 'search_knowledge_text:category-incident',
    minRows: 1,
    expectedCategory: 'incident',
    args: {
      p_query_text: 'DB 연결 장애 어떻게 대응하나요?',
      p_max_results: 3,
      p_filter_category: 'incident',
    },
  },
  {
    label: 'search_knowledge_text:category-security',
    minRows: 1,
    expectedCategory: 'security',
    expectedTopTitleIncludesAny: ['보안 인시던트', 'SSH 인증 실패'],
    args: {
      p_query_text: '보안 인시던트 ssh 접근 인증 실패',
      p_max_results: 3,
      p_filter_category: 'security',
    },
  },
  {
    label: 'search_knowledge_text:security-token-rotation',
    minRows: 1,
    expectedCategory: 'security',
    expectedTopTitleIncludesAny: ['API 키/토큰 노출'],
    args: {
      p_query_text: 'API 키 토큰 노출 rotate 점검',
      p_max_results: 3,
      p_filter_category: 'security',
    },
  },
  {
    label: 'search_knowledge_text:architecture-vercel-cloud-run-boundary',
    minRows: 1,
    expectedCategory: 'architecture',
    expectedTopTitleIncludesAny: ['Vercel BFF와 Cloud Run AI Engine'],
    args: {
      p_query_text: 'Vercel BFF Cloud Run AI Engine 책임 경계',
      p_max_results: 3,
      p_filter_category: 'architecture',
    },
  },
  {
    label: 'search_knowledge_text:mysql-connection-alias',
    minRows: 1,
    expectedTopCategoryIn: ['incident', 'troubleshooting'],
    expectedAnyTitleIncludesAny: [
      'Database 서버',
      '데이터베이스 연결 실패',
    ],
    args: {
      p_query_text: 'mysql 접속 실패',
      p_max_results: 3,
      p_filter_category: 'incident',
    },
  },
];

let failures = 0;

for (const {
  label,
  args,
  minRows,
  expectedCategory,
  expectedTopCategoryIn,
  expectedTopTitleIncludesAny,
  expectedAnyTitleIncludesAny,
  forbiddenTopTitleIncludesAny,
} of checks) {
  const { data, error } = await supabase.rpc('search_knowledge_text', args);

  if (error) {
    failures += 1;
    console.log(`[FAIL] ${label}: ${error.code || 'no_code'} ${error.message}`);
    continue;
  }

  const rowCount = Array.isArray(data) ? data.length : 'n/a';
  if (typeof rowCount !== 'number' || rowCount < minRows) {
    failures += 1;
    console.log(`[FAIL] ${label}: rows=${rowCount}, expected>=${minRows}`);
    continue;
  }

  const topTitle = String(data[0]?.title ?? '');
  const topCategory = String(data[0]?.category ?? '');
  if (expectedCategory && topCategory !== expectedCategory) {
    failures += 1;
    console.log(
      `[FAIL] ${label}: topCategory="${topCategory}", expected="${expectedCategory}"`
    );
    continue;
  }

  if (
    Array.isArray(expectedTopCategoryIn) &&
    !expectedTopCategoryIn.includes(topCategory)
  ) {
    failures += 1;
    console.log(
      `[FAIL] ${label}: topCategory="${topCategory}", expected one of ${expectedTopCategoryIn.join(', ')}`
    );
    continue;
  }

  if (
    Array.isArray(expectedTopTitleIncludesAny) &&
    !expectedTopTitleIncludesAny.some((expected) => topTitle.includes(expected))
  ) {
    failures += 1;
    console.log(
      `[FAIL] ${label}: topTitle="${topTitle}", expected one of ${expectedTopTitleIncludesAny.join(', ')}`
    );
    continue;
  }

  if (
    Array.isArray(expectedAnyTitleIncludesAny) &&
    !data.some((row) =>
      expectedAnyTitleIncludesAny.some((expected) =>
        String(row?.title ?? '').includes(expected)
      )
    )
  ) {
    failures += 1;
    console.log(
      `[FAIL] ${label}: titles=${formatTitles(data)}, expected any of ${expectedAnyTitleIncludesAny.join(', ')}`
    );
    continue;
  }

  if (
    Array.isArray(forbiddenTopTitleIncludesAny) &&
    forbiddenTopTitleIncludesAny.some((forbidden) => topTitle.includes(forbidden))
  ) {
    failures += 1;
    console.log(
      `[FAIL] ${label}: topTitle="${topTitle}" contains forbidden precision marker`
    );
    continue;
  }

  console.log(
    `[PASS] ${label}: rows=${rowCount}, top="${topTitle}", category="${topCategory}"`
  );
}

if (failures > 0) {
  process.exit(1);
}

function formatTitles(rows) {
  if (!Array.isArray(rows)) return '[]';
  return `[${rows
    .map((row) => JSON.stringify(String(row?.title ?? '')))
    .join(', ')}]`;
}
