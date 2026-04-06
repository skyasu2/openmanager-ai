#!/usr/bin/env node

/**
 * 🔐 GitHub 인증 헬퍼
 * PAT을 암호화하여 안전하게 저장하고 git push 시 사용
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { exec, execFile } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
let originalGitHubRemote = null;

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

// 암호화 키 생성 (환경변수 또는 기본값 사용)
const getEncryptionKey = () => {
  const masterKey =
    process.env.ENCRYPTION_KEY || 'openmanager-ai-default-key-2026';
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
  const configPath = path.join(__dirname, '..', '.github-auth.json');

  fs.writeFileSync(configPath, JSON.stringify(encryptedData, null, 2));
  console.log('✅ GitHub PAT이 안전하게 암호화되어 저장되었습니다.');

  // .gitignore에 추가
  const gitignorePath = path.join(__dirname, '..', '.gitignore');
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  if (!gitignoreContent.includes('.github-auth.json')) {
    fs.appendFileSync(
      gitignorePath,
      '\n# GitHub 인증 정보\n.github-auth.json\n'
    );
  }
}

// 암호화된 PAT 로드
function loadEncryptedPAT() {
  const configPath = path.join(__dirname, '..', '.github-auth.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(
      '암호화된 GitHub PAT을 찾을 수 없습니다. 먼저 설정해주세요.'
    );
  }

  const encryptedData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return decryptPAT(encryptedData);
}

// Git remote URL 업데이트
async function updateGitRemote(pat) {
  try {
    const remoteName = await resolveGitHubRemoteName();
    const { stdout: remoteUrl } = await execAsync(`git remote get-url ${remoteName}`);
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
      // PAT 설정 (환경변수 또는 인자에서 가져오기)
      const pat = process.env.GITHUB_PAT || process.argv[3];
      if (!pat) {
        console.error(
          '사용법: GITHUB_PAT=xxx node github-auth-helper.cjs setup'
        );
        console.error('또는: node github-auth-helper.cjs setup <PAT>');
        process.exit(1);
      }
      saveEncryptedPAT(pat);
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
  node github-auth-helper.js setup <PAT>  - PAT 암호화 저장
  node github-auth-helper.js push [branch] - 안전한 git push

예시:
  node github-auth-helper.js setup [YOUR_GITHUB_TOKEN_HERE]
  node github-auth-helper.js push main
      `);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { encryptPAT, decryptPAT, saveEncryptedPAT, loadEncryptedPAT };
