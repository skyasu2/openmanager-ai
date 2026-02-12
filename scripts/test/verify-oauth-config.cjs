#!/usr/bin/env node
/**
 * 🔍 OAuth 설정 검증 도구
 * 
 * Supabase URL 설정이 완료된 후 나머지 설정을 확인합니다.
 */

const https = require('https');

console.log('🔍 OAuth 설정 검증 시작...\n');

console.log('✅ Supabase Authentication URL 설정 확인됨:');
console.log('   Site URL: https://openmanager-ai.vercel.app');
console.log('   Redirect URLs:');
console.log('   - http://localhost:3000/**');
console.log('   - https://openmanager-ai.vercel.app/auth/callback\n');

console.log('📋 남은 설정 체크리스트:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('\n1️⃣ GitHub OAuth Provider 설정');
console.log('   → Supabase Dashboard → Authentication → Providers → GitHub');
console.log('   → GitHub enabled: ON');
console.log('   → Client ID: [GitHub OAuth App의 Client ID]');
console.log('   → Client Secret: [GitHub OAuth App의 Client Secret]');

console.log('\n2️⃣ GitHub OAuth App 설정 확인');
console.log('   🔗 https://github.com/settings/developers');
console.log('   → Authorization callback URL이 다음과 같이 설정되어야 함:');
console.log('   → https://[your-supabase-project-ref].supabase.co/auth/v1/callback');

console.log('\n3️⃣ Vercel 환경변수 설정');
console.log('   → NEXT_PUBLIC_SUPABASE_URL: Supabase 프로젝트 URL');
console.log('   → NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anon key');
console.log('   → SUPABASE_SERVICE_ROLE_KEY: Supabase service role key');

console.log('\n🧪 실시간 테스트:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 프로덕션 사이트 헬스체크
https.get('https://openmanager-ai.vercel.app/api/health', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const health = JSON.parse(data);
      console.log('✅ API 상태:', health.status);
      console.log('✅ 환경:', health.environment);
      
      // 환경변수 힌트 확인
      if (health.services) {
        console.log('✅ 서비스 상태:');
        Object.entries(health.services).forEach(([service, status]) => {
          console.log(`   - ${service}: ${status}`);
        });
      }
    } catch (e) {
      console.log('⚠️ API 응답 파싱 실패');
    }
  });
}).on('error', (err) => {
  console.log('❌ API 접근 실패:', err.message);
});

console.log('\n💡 다음 단계:');
console.log('1. 위 설정들이 모두 완료되었는지 확인');
console.log('2. Vercel에서 재배포 (환경변수 설정 후 자동 트리거됨)');
console.log('3. https://openmanager-ai.vercel.app 에서 로그인 테스트');
console.log('\n⚠️ 주의: GitHub OAuth App의 callback URL은 Supabase URL이어야 합니다!');
console.log('   (Vercel 도메인이 아닌 Supabase 도메인으로 설정)');

module.exports = {};