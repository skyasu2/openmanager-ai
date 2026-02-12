#!/usr/bin/env node
/**
 * 🔍 로그인 에러 진단 도구
 * 
 * 실제 로그인 시도 시 발생하는 에러를 분석합니다.
 */

console.log('🔍 로그인 에러 진단 가이드\n');

console.log('📋 브라우저에서 확인할 사항:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('1️⃣ 로그인 페이지 접속');
console.log('   🔗 https://openmanager-ai.vercel.app/login');
console.log('   → 개발자 도구 열기 (F12)');
console.log('   → Console 탭 확인\n');

console.log('2️⃣ "GitHub로 계속하기" 버튼 클릭 시');
console.log('   → Network 탭에서 리다이렉트 확인');
console.log('   → Console에서 에러 메시지 확인\n');

console.log('🚨 일반적인 에러와 해결방법:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('❌ "Invalid API key" 에러');
console.log('   → Vercel 환경변수에 SUPABASE_ANON_KEY 설정 필요\n');

console.log('❌ "redirect_uri_mismatch" 에러');
console.log('   → GitHub OAuth App의 callback URL 확인');
console.log('   → Supabase project URL로 설정되어야 함\n');

console.log('❌ "No provider configured" 에러');
console.log('   → Supabase에서 GitHub Provider 활성화 필요\n');

console.log('❌ 아무 반응이 없는 경우');
console.log('   → Console에서 JavaScript 에러 확인');
console.log('   → 환경변수가 undefined인지 확인\n');

console.log('🔧 빠른 디버깅 팁:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('1. 브라우저 Console에서 실행:');
console.log('   console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)');
console.log('   → undefined면 환경변수 설정 안됨\n');

console.log('2. Network 탭에서 확인:');
console.log('   → supabase.co로의 요청이 있는지');
console.log('   → 응답 상태 코드가 무엇인지\n');

console.log('3. Vercel Functions 로그 확인:');
console.log('   → Vercel Dashboard → Functions → Logs');
console.log('   → 서버사이드 에러 확인\n');

console.log('💡 에러 메시지를 복사해서 알려주시면 정확한 해결방법을 제시해드릴 수 있습니다!');

module.exports = {};