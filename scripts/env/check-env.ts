#!/usr/bin/env ts-node

/**
 * Environment Variable Checker
 * 목적: 배포/빌드 전 필수 환경 변수 누락 방지
 *
 * 실행: npm run env:check
 * Husky: pre-push 훅에서 자동 실행
 */

// Load environment variables from .env.local and .env
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // Load .env.local first
dotenv.config(); // Fallback to .env

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 1. 필수 환경 변수 정의
// ============================================================================

interface EnvConfig {
  name: string;
  required: boolean;
  description: string;
  example?: string;
}

const REQUIRED_ENV_VARS: EnvConfig[] = [
  // Next.js
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
    example: 'https://xxx.supabase.co',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anonymous key',
    example: 'eyJhbGciOiJIUzI1...',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Supabase service role key (server-side only)',
    example: 'eyJhbGciOiJIUzI1...',
  },

  // NextAuth (Vercel production에서 관리, 로컬 개발 시 불필요)
  {
    name: 'NEXTAUTH_URL',
    required: false,
    description: 'NextAuth callback URL (Vercel production only)',
    example: 'http://localhost:3000 or https://yourdomain.com',
  },
  {
    name: 'NEXTAUTH_SECRET',
    required: false,
    description: 'NextAuth secret for JWT encryption (Vercel production only)',
    example: 'openssl rand -base64 32',
  },

  // Google AI (Optional - Cloud Run AI Engine uses these)
  {
    name: 'GOOGLE_AI_API_KEY',
    required: false,
    description: 'Primary Google AI API key (Cloud Run AI Engine)',
    example: 'AIzaSy...',
  },
  {
    name: 'GROQ_API_KEY',
    required: false,
    description: 'Groq AI API key for fast inference',
    example: 'gsk_...',
  },
  {
    name: 'MISTRAL_API_KEY',
    required: false,
    description: 'Mistral AI API key',
    example: '...',
  },
  {
    name: 'GOOGLE_AI_API_KEY_SECONDARY',
    required: false,
    description: 'Secondary Google AI API key (fallback)',
    example: 'AIzaSy...',
  },

  // Cloud Run
  {
    name: 'CLOUD_RUN_API_SECRET',
    required: false,
    description: 'Cloud Run AI Engine API authentication secret',
    example: 'openssl rand -hex 32',
  },
  {
    name: 'CLOUD_RUN_AI_URL',
    required: false,
    description: 'Cloud Run AI Engine URL',
    example: 'https://ai-engine-xxx.asia-northeast1.run.app',
  },

  // Admin Authentication
  {
    name: 'TEST_SECRET_KEY',
    required: false,
    description: 'Test-only API authentication secret',
    example: 'openssl rand -hex 32',
  },
];

// ============================================================================
// 2. 환경 변수 검사 로직
// ============================================================================

interface EnvCheckResult {
  success: boolean;
  missingRequired: string[];
  missingOptional: string[];
  allEnvs: Record<string, boolean>;
}

function checkEnvironmentVariables(): EnvCheckResult {
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];
  const allEnvs: Record<string, boolean> = {};

  for (const envConfig of REQUIRED_ENV_VARS) {
    const value = process.env[envConfig.name];
    const exists = value !== undefined && value !== '';

    allEnvs[envConfig.name] = exists;

    if (!exists) {
      if (envConfig.required) {
        missingRequired.push(envConfig.name);
      } else {
        missingOptional.push(envConfig.name);
      }
    }
  }

  return {
    success: missingRequired.length === 0,
    missingRequired,
    missingOptional,
    allEnvs,
  };
}

// ============================================================================
// 3. 결과 출력 및 종료 코드
// ============================================================================

function printResults(result: EnvCheckResult): void {
  console.log('\n🔍 환경 변수 검사 결과\n');
  console.log('='.repeat(60));

  // 필수 환경 변수 검사
  if (result.missingRequired.length > 0) {
    console.error('\n❌ 필수 환경 변수 누락!\n');
    for (const envName of result.missingRequired) {
      const config = REQUIRED_ENV_VARS.find((e) => e.name === envName);
      console.error(`  ❌ ${envName}`);
      if (config?.description) {
        console.error(`     → ${config.description}`);
      }
      if (config?.example) {
        console.error(`     → Example: ${config.example}`);
      }
    }
  }

  // 선택적 환경 변수 경고
  if (result.missingOptional.length > 0) {
    console.warn('\n⚠️  선택적 환경 변수 누락 (기능 제한 가능)\n');
    for (const envName of result.missingOptional) {
      const config = REQUIRED_ENV_VARS.find((e) => e.name === envName);
      console.warn(`  ⚠️  ${envName}`);
      if (config?.description) {
        console.warn(`     → ${config.description}`);
      }
    }
  }

  // 성공 메시지
  if (result.success) {
    console.log('\n✅ 모든 필수 환경 변수가 설정되었습니다!\n');
    const optionalCount = result.missingOptional.length;
    if (optionalCount > 0) {
      console.log(
        `   (선택적 환경 변수 ${optionalCount}개 미설정 - 일부 기능 제한)\n`
      );
    }
  }

  console.log('='.repeat(60));

  // .env.example 안내
  console.log('\n💡 참고 파일: .env.example 또는 .env.local.example');
  console.log('   → 누락된 환경 변수를 .env.local에 추가하세요\n');
}

// ============================================================================
// 4. .env.example 생성 (없을 경우)
// ============================================================================

function generateEnvExample(): void {
  const examplePath = path.join(process.cwd(), '.env.example');

  // 이미 존재하면 건너뛰기
  if (fs.existsSync(examplePath)) {
    return;
  }

  const lines: string[] = [
    '# OpenManager AI - Environment Variables Template',
    '# Copy this file to .env.local and fill in the values',
    '',
  ];

  for (const envConfig of REQUIRED_ENV_VARS) {
    lines.push(`# ${envConfig.description}`);
    if (envConfig.example) {
      lines.push(`# Example: ${envConfig.example}`);
    }
    lines.push(
      `${envConfig.name}=${envConfig.required ? '# REQUIRED' : '# OPTIONAL'}`
    );
    lines.push('');
  }

  fs.writeFileSync(examplePath, lines.join('\n'), 'utf8');
  console.log('✅ .env.example 파일이 생성되었습니다.');
}

// ============================================================================
// 5. Main
// ============================================================================

function main(): void {
  console.log('🔍 Environment Variable Checker v1.0.0\n');

  // 환경 변수 검사
  const result = checkEnvironmentVariables();

  // 결과 출력
  printResults(result);

  // 종료 코드 설정 (필수 환경 변수 누락 시 1)
  if (!result.success) {
    console.error('\n❌ 환경 변수 검사 실패: 필수 항목 누락');
    console.error('   → CI/CD 파이프라인 또는 배포가 중단됩니다.\n');
    process.exit(1);
  } else {
    console.log('✅ 환경 변수 검사 통과\n');
    process.exit(0);
  }
}

// 실행
main();

export { checkEnvironmentVariables, REQUIRED_ENV_VARS };
