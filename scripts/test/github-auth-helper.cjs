#!/usr/bin/env node

/**
 * 🔐 GitHub 인증 헬퍼
 * PAT을 암호화하여 안전하게 저장하고 git push 시 사용
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
let originalGitHubRemote = null;
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ENCRYPTED_PAT_PATH = path.join(REPO_ROOT, '.github-auth.json');
const GITIGNORE_PATH = path.join(REPO_ROOT, '.gitignore');

async function resolveGitHubRemoteName() {
  const preferredRemotes = [
    process.env.GITHUB_PUBLIC_REMOTE || 'github-public',
    process.env.GITHUB_PUBLIC_LEGACY_REMOTE || 'origin',
  ];

  for (const remote of preferredRemotes) {
    try {
      await execFileAsync('git', ['remote', 'get-url', remote]);
      return remote;
    } catch {
      // continue
    }
  }

  throw new Error(
    `GitHub public remote를 찾을 수 없습니다. (${preferredRemotes.join(', ')})`
  );
}

function toGitHubHttpsUrl(remoteUrl) {
  const trimmed = String(remoteUrl || '').trim();
  if (!trimmed) {
    throw new Error('GitHub remote URL이 비어 있습니다.');
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return new URL(trimmed);
  }

  const sshMatch = trimmed.match(/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
  if (sshMatch) {
    return new URL(`https://github.com/${sshMatch[1]}/${sshMatch[2]}.git`);
  }

  throw new Error(`지원하지 않는 GitHub remote URL 형식입니다: ${trimmed}`);
}

// 암호화 설정
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// 암호화 키 생성 (환경변수 필수)
const getEncryptionKey = () => {
  const masterKey = process.env.ENCRYPTION_KEY;
  if (!masterKey) {
    throw new Error(
      'ENCRYPTION_KEY가 필요합니다. 기본 키 fallback은 보안상 허용되지 않습니다.'
    );
  }
  return crypto.scryptSync(masterKey, 'salt', KEY_LENGTH);
};

// PAT 암호화
function encryptPAT(pat) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(pat, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    timestamp: new Date().toISOString(),
  };
}

// PAT 복호화
function decryptPAT(encryptedData) {
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const tag = Buffer.from(encryptedData.tag, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// 암호화된 PAT 저장
function saveEncryptedPAT(pat) {
  const encryptedData = encryptPAT(pat);

  fs.writeFileSync(ENCRYPTED_PAT_PATH, JSON.stringify(encryptedData, null, 2), {
    mode: 0o600,
  });
  console.log('✅ GitHub PAT이 안전하게 암호화되어 저장되었습니다.');

  // .gitignore에 추가
  const gitignoreContent = fs.readFileSync(GITIGNORE_PATH, 'utf8');
  if (!gitignoreContent.includes('.github-auth.json')) {
    fs.appendFileSync(
      GITIGNORE_PATH,
      '\n# GitHub 인증 정보\n.github-auth.json\n'
    );
  }
}

// 암호화된 PAT 로드
function loadEncryptedPAT() {
  if (!fs.existsSync(ENCRYPTED_PAT_PATH)) {
    throw new Error(
      '암호화된 GitHub PAT을 찾을 수 없습니다. 먼저 설정해주세요.'
    );
  }

  const encryptedData = JSON.parse(fs.readFileSync(ENCRYPTED_PAT_PATH, 'utf8'));
  return decryptPAT(encryptedData);
}

// Git remote URL 업데이트
async function updateGitRemote(pat) {
  try {
    const remoteName = await resolveGitHubRemoteName();
    const { stdout: remoteUrl } = await execFileAsync('git', ['remote', 'get-url', remoteName]);
    const currentRemoteUrl = remoteUrl.trim();
    const url = toGitHubHttpsUrl(currentRemoteUrl);

    originalGitHubRemote = {
      name: remoteName,
      url: currentRemoteUrl,
    };

    // HTTPS URL에 PAT 추가
    // URL에서 기존 사용자 정보 제거 후 PAT 추가
    url.username = 'pat'; // Generic placeholder for PAT authentication
    url.password = pat;

    await execFileAsync('git', ['remote', 'set-url', remoteName, url.toString()]);
    console.log('✅ Git remote URL이 업데이트되었습니다.');
  } catch (error) {
    console.error('❌ Git remote 업데이트 실패:', error.message);
    throw error;
  }
}

// Git push 실행
async function gitPush(branch = 'main') {
  try {
    const remoteName = await resolveGitHubRemoteName();
    console.log('🚀 Git push 시작...');
    const { stdout, stderr } = await execFileAsync(
      'git', ['push', remoteName, branch],
      { env: { ...process.env, HUSKY: '0' } }
    );

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    console.log('✅ Git push 완료!');
  } catch (error) {
    console.error('❌ Git push 실패:', error.message);
    throw error;
  }
}

// 원래 remote URL 복원
async function restoreGitRemote() {
  try {
    if (!originalGitHubRemote) {
      return;
    }

    await execFileAsync('git', [
      'remote',
      'set-url',
      originalGitHubRemote.name,
      originalGitHubRemote.url,
    ]);
    console.log('✅ Git remote URL이 원래대로 복원되었습니다.');
  } catch (error) {
    console.error('⚠️  Git remote 복원 실패:', error.message);
  }
}

// 메인 함수
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'setup':
      try {
        const pat = process.env.GITHUB_PAT || process.argv[3];
        if (!pat) {
          console.error(
            '사용법: ENCRYPTION_KEY=... GITHUB_PAT=xxx node github-auth-helper.cjs setup'
          );
          console.error('또는: node github-auth-helper.cjs setup <PAT>');
          process.exit(1);
        }
        saveEncryptedPAT(pat);
      } catch (error) {
        console.error('Setup 실패:', error.message);
        process.exit(1);
      }
      break;

    case 'push':
      // 안전한 push
      try {
        const pat = loadEncryptedPAT();
        await updateGitRemote(pat);
        await gitPush(process.argv[3] || 'main');
      } catch (error) {
        console.error('Push 실패:', error.message);
        process.exit(1);
      } finally {
        await restoreGitRemote();
      }
      break;

    default:
      console.log(`
🔐 GitHub 인증 헬퍼

사용법:
  ENCRYPTION_KEY=... node github-auth-helper.cjs setup <PAT>   - PAT 암호화 저장
  ENCRYPTION_KEY=... node github-auth-helper.cjs push [branch] - 안전한 git push

예시:
  ENCRYPTION_KEY=... node github-auth-helper.cjs setup [YOUR_GITHUB_TOKEN_HERE]
  ENCRYPTION_KEY=... node github-auth-helper.cjs push main
      `);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { encryptPAT, decryptPAT, saveEncryptedPAT, loadEncryptedPAT };
