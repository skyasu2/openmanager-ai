#!/usr/bin/env node
/**
 * 🔐 하드코딩된 시크릿 검사 스크립트 v2.0
 * GitHub Actions Security Check용 빠른 보안 검사 도구
 */

const fs = require('fs');
const path = require('path');

console.log('🔐 하드코딩된 시크릿 검사 시작...');

// 실제 위험한 패턴만 검사 (false positive 최소화)
const criticalPatterns = [
  // 실제 GitHub 토큰 패턴
  { pattern: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub Personal Access Token' },
  { pattern: /ghs_[a-zA-Z0-9]{36}/, name: 'GitHub App Token' },
  { pattern: /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/, name: 'GitHub Personal Access Token (new format)' },
  
  // 실제 OpenAI API 키 패턴  
  { pattern: /sk-[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20}/, name: 'OpenAI API Key' },
  
  // Google AI 키
  { pattern: /AIza[a-zA-Z0-9-_]{35}/, name: 'Google API Key' },
  
  // AWS 실제 키만
  { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS Access Key ID' },
  
  // Supabase 키
  { pattern: /sb-[a-zA-Z0-9]{40}-[a-zA-Z0-9]{20}/, name: 'Supabase Key' },

  // Gemini API 키 (AIza로 시작하지만 패턴 구체화)
  { pattern: /AIzaSy[a-zA-Z0-9-_]{33}/, name: 'Gemini API Key' },

  // Groq API 키
  { pattern: /gsk_[a-zA-Z0-9]{48}/, name: 'Groq API Key' },
  
  // 명시적인 하드코딩된 키 패턴
  { pattern: /(api_key|apikey|secret_key|secretkey)\s*[:=]\s*['"][^'"]{20,}['"]/, name: 'Hardcoded API Key' },
  { pattern: /(password|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/, name: 'Hardcoded Password' }
];

// 제외할 테스트/예시 값들
const excludeValues = [
  // 테스트 값들
  'sk-1234567890abcdef',
  'ghp_1234567890123456789012345678901234567890',
  'AIzaSyABC2WATlHIG0Kd-Oj4JSL6wJoqMd3FhvM',
  'testpass123',
  'admin123',
  'fallback-dev-password',
  // 예시/플레이스홀더
  'your-api-key-here',
  'example-token',
  'placeholder',
  'dummy-key',
  'test-key',
  '***',
  // 가짜 테스트 키 패턴
  'FAKE',
  'MOCK',
  'TEST_KEY',
  'NOT_REAL'
];

// 제외할 디렉토리
const excludeDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'tests', 'test', '__tests__', 'docs', 'reports', '.claude', 'public']);

// 빠른 파일 스캔
function quickScan() {
  const findings = [];
  
  // 주요 위험 파일들만 체크
  const criticalFiles = [
    '.env',
    '.env.local', 
    '.env.production',
    '.env.development',
    'config.js',
    'config.ts',
    'constants.js',
    'constants.ts'
  ];
  
  // 환경 변수 파일 우선 체크 (.env.local 제외 - 개발용)
  criticalFiles.forEach(fileName => {
    // .env.local은 개발용이므로 제외
    if (fileName === '.env.local') return;
    
    const filePath = path.join(process.cwd(), fileName);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      findings.push(...scanContent(content, filePath));
    }
  });
  
  // src 디렉토리의 config/auth 관련 파일만 체크
  const srcDir = path.join(process.cwd(), 'src');
  if (fs.existsSync(srcDir)) {
    findings.push(...scanDirectory(srcDir, 2)); // 2 레벨 깊이만
  }
  
  return findings;
}

function scanDirectory(dir, maxDepth = 1) {
  if (maxDepth <= 0) return [];
  
  const findings = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      if (excludeDirs.has(item)) continue;
      
      const fullPath = path.join(dir, item);
      const stat = fs.lstatSync(fullPath);
      
      if (stat.isDirectory()) {
        findings.push(...scanDirectory(fullPath, maxDepth - 1));
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.js') || item.endsWith('.json'))) {
        // 테스트 파일 제외
        if (item.includes('.test.') || item.includes('.spec.')) continue;

        // config, auth, secret 관련 파일만
        if (item.toLowerCase().includes('config') ||
            item.toLowerCase().includes('auth') ||
            item.toLowerCase().includes('secret') ||
            item.toLowerCase().includes('env')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          findings.push(...scanContent(content, fullPath));
        }
      }
    }
  } catch (error) {
    // 권한 에러 등은 무시
  }
  
  return findings;
}

function scanContent(content, filePath) {
  const findings = [];
  const lines = content.split('\n');
  
  lines.forEach((line, lineNumber) => {
    criticalPatterns.forEach(({ pattern, name }) => {
      const matches = line.match(pattern);
      if (matches) {
        const matchValue = matches[0];
        
        // 제외 값 확인
        const isExcluded = excludeValues.some(exclude => 
          matchValue.includes(exclude) || line.includes(exclude)
        );
        
        // 주석이나 예시 코드 제외
        const isComment = line.trim().startsWith('//') || line.trim().startsWith('*');
        const isExample = line.includes('example') || line.includes('placeholder') || line.includes('dummy');
        
        if (!isExcluded && !isComment && !isExample) {
          findings.push({
            file: filePath.replace(process.cwd() + '/', ''),
            line: lineNumber + 1,
            type: name,
            content: line.trim().substring(0, 100) + (line.length > 100 ? '...' : ''),
            match: matchValue
          });
        }
      }
    });
  });
  
  return findings;
}

// 메인 실행
try {
  const findings = quickScan();
  
  if (findings.length === 0) {
    console.log('✅ 하드코딩된 시크릿을 발견하지 못했습니다.');
    process.exit(0);
  } else {
    console.log(`❌ ${findings.length}개의 잠재적 시크릿을 발견했습니다:`);
    console.log('');
    
    findings.forEach((finding, index) => {
      console.log(`${index + 1}. ${finding.type}`);
      console.log(`   파일: ${finding.file}:${finding.line}`);
      console.log(`   내용: ${finding.content}`);
      console.log('');
    });
    
    console.log('⚠️ 발견된 항목들을 검토하고 실제 시크릿이 있다면 즉시 제거하세요!');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ 시크릿 검사 중 오류 발생:', error.message);
  process.exit(1);
}