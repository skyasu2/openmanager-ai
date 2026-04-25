const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

interface Rule {
  id: string;
  description: string;
  pattern: RegExp;
  allowPattern?: RegExp;
}

interface Finding {
  ruleId: string;
  file: string;
  line: number;
  description: string;
}

interface CheckResult {
  ok: boolean;
  files: string[];
  findings: Finding[];
}

const TARGET_PATHS: string[] = [
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.mcp.json',
  '.mcp.json.README.md',
  '.gemini/settings.json',
  '.claude/rules',
  'config/ai/skill-baselines.json',
  'config/templates/codex.config.toml.template',
  'docs/guides/ai',
  'docs/development/vibe-coding',
  'scripts/README.md',
];

const SCANNED_EXTENSIONS = new Set<string>(['.md', '.json', '.toml']);

const RULES: Rule[] = [
  {
    id: 'AI-DOCS-MCP-SECRET-001',
    description: '.mcp.json must not be documented as a token-bearing gitignored file',
    pattern:
      /(?:하드코딩된 API 토큰|(?:\.mcp\.json|MCP).*(?:실제 토큰\/경로|실제 토큰.*포함|직접 토큰 저장|토큰이 평문|Git 추적 제외|Git 제외.*토큰|gitignore.*보호|로컬 전용.*GitHub))/i,
  },
  {
    id: 'AI-DOCS-MCP-LATEST-001',
    description: 'MCP package docs must use pinned launchers, not @latest',
    pattern:
      /(?:chrome-devtools-mcp|next-devtools-mcp|diagram-converter-mcp|@playwright\/mcp|vercel-mcp)@latest/i,
  },
  {
    id: 'AI-DOCS-MCP-NPX-001',
    description: 'MCP package docs must use scripts/mcp/start-node-mcp-package.sh instead of raw npx -y',
    pattern: /npx\s+-y\s+(?:@?[\w./-]*mcp[\w./-]*)(?:@[\w.-]+)?(?:\s|$)/i,
  },
  {
    id: 'AI-DOCS-MCP-GITHUB-001',
    description: 'GitHub MCP docs must use the official HTTP endpoint, not legacy server-github',
    pattern: /(?:@modelcontextprotocol\/server-github|server-github)/i,
  },
  {
    id: 'AI-DOCS-MCP-SUPABASE-001',
    description: 'Supabase MCP docs must use the project launcher, not legacy package paths',
    pattern: /(?:@supabase\/mcp-server|mcp-server-supabase)/i,
  },
  {
    id: 'AI-DOCS-MCP-DIAGRAM-001',
    description: 'Diagram converter MCP docs must not reference the retired 0.2.6 tuple',
    pattern: /diagram-converter-mcp@0\.2\.6/i,
  },
  {
    id: 'AI-DOCS-SKILL-SYMLINK-001',
    description: 'Gemini skills must not be documented as same-name symlinks to .claude/skills',
    pattern:
      /(?:\.gemini\/skills.*(?:symlink|심볼릭|\.claude\/skills)|ln\s+-sf\s+\.\.\/\.\.\/\.claude\/skills)/i,
  },
  {
    id: 'AI-DOCS-REMOVED-MCP-001',
    description: 'Removed MCP servers must not appear as allowed tool examples',
    pattern: /mcp__(?:context7|sequential-thinking)__/i,
  },
  {
    id: 'AI-DOCS-GEMINI-MCP-STATUS-001',
    description: 'Gemini MCP status docs must use the project env launcher, not direct Gemini or npm wrappers',
    pattern:
      /(?:^|[^\w/-])(?:gemini\s+mcp\s+list|npm\s+run\s+mcp:status:gemini)\b/i,
    allowPattern:
      /(?:scripts\/mcp\/run-with-project-env\.sh\s+gemini\s+mcp\s+list|GEMINI_CLI_TRUST_WORKSPACE=true\s+GEMINI_CLI_NO_RELAUNCH=true\s+gemini\s+mcp\s+list)\b/i,
  },
  {
    id: 'AI-DOCS-GEMINI-MCP-SCOPE-001',
    description: 'OpenManager Gemini MCP must not be documented as restored or merged into ~/.gemini/settings.json',
    pattern:
      /(?:(?:~\/\.gemini\/settings\.json|user-scope|전역).*(?:OpenManager MCP|mcpServers|MCP).*(?:복구|추가|저장|병합\(|병합하여|병합합니다|넣)|(?:OpenManager MCP|mcpServers|MCP).*(?:~\/\.gemini\/settings\.json|user-scope|전역).*(?:복구|추가|저장|병합\(|병합하여|병합합니다|넣))/i,
  },
  {
    id: 'AI-DOCS-GEMINI-MCP-LEGACY-FILE-001',
    description: '~/mcp_project_settings.json must not be documented as a restore source for Gemini global MCP',
    pattern:
      /mcp_project_settings\.json.*(?:~\/\.gemini\/settings\.json|전역|global).*(?:복구|추가|저장|병합\(|병합하여|병합합니다|넣)/i,
  },
  {
    id: 'AI-DOCS-GEMINI-SKILLS-LIST-001',
    description: 'Gemini skills health docs must use npm run skills:check, not headless Gemini skills list',
    pattern:
      /(?:^|[^\w/-])(?:gemini\s+skills\s+list|npm\s+run\s+skills:list:gemini)\b/i,
  },
  {
    id: 'AI-DOCS-GEMINI-SKILL-SCOPE-001',
    description: 'OpenManager common skills must not be documented as copied into Gemini overlay or user-scope skills',
    pattern:
      /(?:(?:~\/\.gemini\/skills|\.gemini\/skills).*(?:OpenManager|공통|프로젝트 맞춤형|qa-state|lint-smoke|git-workflow).*(?:복원|복구|복사|이동|가져|넣)|(?:OpenManager|공통|프로젝트 맞춤형|qa-state|lint-smoke|git-workflow).*(?:~\/\.gemini\/skills|\.gemini\/skills).*(?:복원|복구|복사|이동|가져|넣))/i,
    allowPattern: /(?:두지 않습니다|없음|격리|전용|금지|충돌 경고|shadowed)/i,
  },
  {
    id: 'AI-DOCS-CODEX-SKILL-SCOPE-001',
    description: 'OpenManager common skills must not be documented as mirrored into Codex user scope',
    pattern:
      /(?:(?:~\/\.codex\/skills|CODEX_HOME\/skills).*(?:OpenManager|공통|프로젝트 맞춤형|qa-state|lint-smoke|git-workflow).*(?:mirror|미러|복원|복구|복사|동기화|sync|이동|가져|넣)|(?:OpenManager|공통|프로젝트 맞춤형|qa-state|lint-smoke|git-workflow).*(?:~\/\.codex\/skills|CODEX_HOME\/skills).*(?:mirror|미러|복원|복구|복사|동기화|sync|이동|가져|넣))/i,
    allowPattern: /(?:두지 않습니다|만들지 않습니다|없음|격리|전용|금지|충돌 경고|shadowed|not sync|does not mirror)/i,
  },
  {
    id: 'AI-DOCS-CODEX-MCP-SCOPE-001',
    description: 'OpenManager Codex MCP must be documented as project .codex/config.toml, not global ~/.codex/config.toml',
    pattern:
      /(?:(?:~\/\.codex\/config\.toml|user-scope|전역).*(?:OpenManager MCP|mcp_servers|MCP).*(?:복구|추가|저장|병합\(|병합하여|병합합니다|넣)|(?:OpenManager MCP|mcp_servers|MCP).*(?:~\/\.codex\/config\.toml|user-scope|전역).*(?:복구|추가|저장|병합\(|병합하여|병합합니다|넣))/i,
    allowPattern: /(?:추가하지 않습니다|두지 않습니다|없음|격리|전용|금지|project \.codex\/config\.toml)/i,
  },
  {
    id: 'AI-DOCS-TOKEN-EXAMPLE-001',
    description: 'AI docs must not include realistic token examples',
    pattern:
      /(?:GITHUB_PERSONAL_ACCESS_TOKEN["'=:\s]+["']?ghp_|ghp_[A-Za-z0-9_]{12,}|sbp_[A-Za-z0-9]{12,}|VERCEL_API_KEY=["']?[A-Za-z0-9_-]{12,})/,
  },
];

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

function shouldScanFile(filePath: string): boolean {
  return SCANNED_EXTENSIONS.has(path.extname(filePath));
}

function walk(targetPath: string): string[] {
  const absolutePath = path.join(root, targetPath);
  if (!fs.existsSync(absolutePath)) return [];

  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) {
    return shouldScanFile(absolutePath) ? [targetPath] : [];
  }

  if (!stat.isDirectory()) return [];

  const results: string[] = [];
  const stack: string[] = [absolutePath];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'archive' || entry.name === 'archived') continue;
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && shouldScanFile(fullPath)) {
        results.push(toPosix(path.relative(root, fullPath)));
      }
    }
  }

  return results;
}

function collectTargetFiles(): string[] {
  return [...new Set(TARGET_PATHS.flatMap((targetPath) => walk(targetPath)))].sort();
}

function checkContent(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const rule of RULES) {
      if (
        rule.pattern.test(line) &&
        !(rule.allowPattern && rule.allowPattern.test(line))
      ) {
        findings.push({
          ruleId: rule.id,
          file: filePath,
          line: index + 1,
          description: rule.description,
        });
      }
    }
  });

  return findings;
}

function runConsistencyCheck(): CheckResult {
  const files = collectTargetFiles();
  const findings = files.flatMap((filePath) =>
    checkContent(filePath, fs.readFileSync(path.join(root, filePath), 'utf8'))
  );

  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(
        `FAIL ${finding.ruleId} file=${finding.file}:${finding.line} action_hint="${finding.description}"`
      );
    }
    return { ok: false, files, findings };
  }

  console.log(
    `PASS AI-DOCS-CONSISTENCY-001 scanned=${files.length} action_hint="none"`
  );
  return { ok: true, files, findings };
}

if (require.main === module) {
  const result = runConsistencyCheck();
  process.exit(result.ok ? 0 : 1);
}

module.exports = {
  RULES,
  TARGET_PATHS,
  checkContent,
  collectTargetFiles,
  runConsistencyCheck,
};
