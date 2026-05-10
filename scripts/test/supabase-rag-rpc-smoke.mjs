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
    args: {
      p_query_text: 'cpu',
      p_max_results: 3,
      p_filter_category: null,
    },
  },
  {
    label: 'search_knowledge_text:cpu-high-load',
    minRows: 1,
    args: {
      p_query_text: 'cpu high load',
      p_max_results: 3,
      p_filter_category: null,
    },
  },
  {
    label: 'search_knowledge_text:disk-cleanup',
    minRows: 1,
    args: {
      p_query_text: 'disk space cleanup',
      p_max_results: 3,
      p_filter_category: null,
    },
  },
  {
    label: 'search_knowledge_text:redis-memory',
    minRows: 1,
    args: {
      p_query_text: 'redis memory',
      p_max_results: 3,
      p_filter_category: null,
    },
  },
  {
    label: 'search_knowledge_text:topology',
    minRows: 1,
    args: {
      p_query_text: 'server topology dependency',
      p_max_results: 3,
      p_filter_category: null,
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
];

let failures = 0;

for (const {
  label,
  args,
  minRows,
  expectedTopTitleIncludesAny,
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
    Array.isArray(forbiddenTopTitleIncludesAny) &&
    forbiddenTopTitleIncludesAny.some((forbidden) => topTitle.includes(forbidden))
  ) {
    failures += 1;
    console.log(
      `[FAIL] ${label}: topTitle="${topTitle}" contains forbidden precision marker`
    );
    continue;
  }

  console.log(`[PASS] ${label}: rows=${rowCount}, top="${topTitle}"`);
}

if (failures > 0) {
  process.exit(1);
}
