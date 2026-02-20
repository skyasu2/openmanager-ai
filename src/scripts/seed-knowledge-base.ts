/**
 * Knowledge Base Seed Script
 * RAG 지식베이스 초기 데이터 시딩
 *
 * Mistral mistral-embed (1024 dimensions)
 * - 1회 실행용 (백그라운드 작업 아님)
 * - 예상 임베딩: ~38개 문서 × 1 API call = 38 calls
 *
 * 실행: npx tsx src/scripts/seed-knowledge-base.ts
 *
 * @version 2.0.0 - Mistral embedding migration (2025-12-31)
 */

import { createClient } from '@supabase/supabase-js';
import { createMistral } from '@ai-sdk/mistral';
import { embedMany } from 'ai';
import dotenv from 'dotenv';
import path from 'path';

import { KNOWLEDGE_ENTRIES } from "./seed-knowledge-base.data";

// Load Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });


// ============================================================================
// 2. 임베딩 및 시딩 로직
// ============================================================================

async function seedKnowledgeBase() {
  console.log('🚀 Knowledge Base Seeding Started...\n');

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

  console.log(`📦 Preparing ${KNOWLEDGE_ENTRIES.length} knowledge entries...\n`);

  // 1. 임베딩 생성 (배치)
  console.log('🧠 Generating embeddings with Mistral mistral-embed (1024d)...');

  const texts = KNOWLEDGE_ENTRIES.map(e => `${e.title}\n\n${e.content}`);

  const mistral = createMistral({ apiKey: mistralApiKey });
  const model = mistral.embedding('mistral-embed');
  const { embeddings } = await embedMany({
    model,
    values: texts,
    experimental_telemetry: { isEnabled: false },
  });

  console.log(`✅ Generated ${embeddings.length} embeddings (1024 dimensions)\n`);

  // 2. Supabase에 삽입
  console.log('📝 Inserting into knowledge_base table...');

  let insertedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < KNOWLEDGE_ENTRIES.length; i++) {
    const entry = KNOWLEDGE_ENTRIES[i]!;
    const embedding = embeddings[i]!;
    const vectorString = `[${embedding.join(',')}]`;

    // 중복 체크 (title 기준)
    const { data: existing } = await supabase
      .from('knowledge_base')
      .select('id')
      .eq('title', entry.title)
      .maybeSingle();

    if (existing) {
      skippedCount++;
      process.stdout.write(`\r⏳ Processing... ${i + 1}/${KNOWLEDGE_ENTRIES.length} (skipped: ${skippedCount})`);
      continue;
    }

    // 삽입
    const { error } = await supabase.from('knowledge_base').insert({
      title: entry.title,
      content: entry.content,
      embedding: vectorString,
      category: entry.category,
      tags: entry.tags,
      severity: entry.severity,
      related_server_types: entry.related_server_types,
      source: 'seed_script',
    });

    if (error) {
      console.error(`\n❌ Failed to insert "${entry.title}":`, error.message);
    } else {
      insertedCount++;
    }

    process.stdout.write(`\r⏳ Processing... ${i + 1}/${KNOWLEDGE_ENTRIES.length}`);
  }

  console.log('\n');
  console.log('═'.repeat(50));
  console.log(`✅ Seed Completed!`);
  console.log(`   - Inserted: ${insertedCount}`);
  console.log(`   - Skipped (duplicates): ${skippedCount}`);
  console.log(`   - Total entries: ${KNOWLEDGE_ENTRIES.length}`);
  console.log('═'.repeat(50));
}

// 실행
seedKnowledgeBase().catch(console.error);
