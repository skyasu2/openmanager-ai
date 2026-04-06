#!/usr/bin/env node

/**
 * 🔓 Tavily API 키 복호화 로더
 * MCP 서버에서 사용할 수 있도록 암호화된 키를 복호화
 */

const fs = require('fs');
const path = require('path');

const ENCRYPTED_TAVILY_GUIDANCE =
  '암호화된 Tavily 키 경로는 더 이상 지원되지 않습니다. 평문 TAVILY_API_KEY를 직접 설정하세요.';

function loadTavilyApiKey() {
  try {
    // 1. 환경 변수에서 확인
    if (process.env.TAVILY_API_KEY) {
      return process.env.TAVILY_API_KEY;
    }

    // 2. 폐기된 암호화 경로는 명시적으로 실패시켜 사용자가 즉시 수정할 수 있게 한다.
    if (process.env.TAVILY_API_KEY_ENCRYPTED) {
      throw new Error(ENCRYPTED_TAVILY_GUIDANCE);
    }

    // 3. 과거 설정 파일이 남아 있어도 더 이상 읽지 않는다.
    const configPath = path.join(__dirname, '../config/tavily-encrypted.json');
    if (fs.existsSync(configPath)) {
      throw new Error(`${ENCRYPTED_TAVILY_GUIDANCE} Deprecated file: ${configPath}`);
    }

    throw new Error('Tavily API 키를 찾을 수 없습니다. TAVILY_API_KEY를 설정하세요.');
  } catch (error) {
    console.error('❌ Tavily API 키 로드 실패:', error.message);
    return null;
  }
}

// 모듈로 내보내기
if (module.exports) {
  module.exports = { loadTavilyApiKey, ENCRYPTED_TAVILY_GUIDANCE };
}

// CLI로 실행시 키 출력 (테스트용)
if (require.main === module) {
  const apiKey = loadTavilyApiKey();
  if (apiKey) {
    console.log('✅ Tavily API 키 로드 성공');
    console.log(`키 길이: ${apiKey.length}자`);
    console.log(`키 시작: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
  } else {
    console.log('❌ Tavily API 키 로드 실패');
    process.exit(1);
  }
}
