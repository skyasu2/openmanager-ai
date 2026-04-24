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

const vector1024 = `[${Array.from({ length: 1024 }, (_, index) =>
  index === 0 ? '0.001' : '0'
).join(',')}]`;

const checks = [
  [
    'match_knowledge_base',
    { query_text: 'cpu', match_threshold: 0.1, match_count: 1 },
  ],
  [
    'search_knowledge_base',
    {
      query_embedding: vector1024,
      similarity_threshold: 0,
      max_results: 1,
      filter_category: null,
      filter_severity: null,
    },
  ],
  [
    'match_documents',
    { query_embedding: vector1024, match_count: 1, filter: {} },
  ],
  [
    'hybrid_search_with_text',
    {
      p_query_embedding: vector1024,
      p_query_text: 'cpu',
      p_similarity_threshold: 0,
      p_text_weight: 0.3,
      p_vector_weight: 0.5,
      p_graph_weight: 0.2,
      p_max_vector_results: 1,
      p_max_text_results: 1,
      p_max_graph_hops: 1,
      p_max_total_results: 1,
      p_filter_category: null,
    },
  ],
];

let failures = 0;

for (const [name, args] of checks) {
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    failures += 1;
    console.log(`[FAIL] ${name}: ${error.code || 'no_code'} ${error.message}`);
    continue;
  }

  const rowCount = Array.isArray(data) ? data.length : 'n/a';
  console.log(`[PASS] ${name}: rows=${rowCount}`);
}

if (failures > 0) {
  process.exit(1);
}
