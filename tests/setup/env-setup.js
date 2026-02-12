import fs from 'node:fs';
import path from 'node:path';

/**
 * 🔧 환경변수 설정 스크립트
 * Cloud Run AI 설정을 포함한 완전한 환경변수 파일을 생성합니다.
 */
function createEnvFile() {
  const envContent = `# OpenManager AI v8 - Local Environment Variables
# 로컬 개발 및 테스트 환경용 설정

# 🤖 Cloud Run AI 설정 (Mistral via Cloud Run)
# Note: Cloud Run AI uses GCP IAM authentication
CLOUD_RUN_AI_URL=https://ai-engine-xxx.asia-northeast1.run.app
CLOUD_RUN_AI_ENABLED=true

# 📢 알림 설정
# 브라우저 알림만 사용

# 🗄️ Supabase 설정 (기존 환경변수 유지)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=SENSITIVE_INFO_REMOVED
SUPABASE_SERVICE_ROLE_KEY=SENSITIVE_INFO_REMOVED

# 🔄 Redis 설정 (Upstash)
REDIS_URL=rediss://default:your_redis_token_here@your_redis_host_here:6379
UPSTASH_REDIS_REST_URL=https://your_redis_host_here
UPSTASH_REDIS_REST_TOKEN=your_redis_token_here

# 🛡️ Next.js 보안 설정
NEXTAUTH_SECRET=openmanager-ai-auth-secret-key-2026
NEXTAUTH_URL=http://localhost:3000

# 🔧 개발 도구 설정
NODE_ENV=development
DEBUG=false`;

  const envPath = path.join(process.cwd(), '.env.local');

  try {
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✅ .env.local 파일이 성공적으로 생성되었습니다.');
    console.log('📁 위치:', envPath);

    // 파일 내용 확인
    const content = fs.readFileSync(envPath, 'utf8');
    console.log('📋 파일 크기:', content.length, '바이트');

    return true;
  } catch (error) {
    console.error('❌ .env.local 파일 생성 실패:', error.message);
    return false;
  }
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 환경변수 파일 생성 시작...');
  createEnvFile();
}

export { createEnvFile };
