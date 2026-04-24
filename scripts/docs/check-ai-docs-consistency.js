'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const TARGET_PATHS = [
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

const SCANNED_EXTENSIONS = new Set(['.md', '.json', '.toml']);

const RULES = [
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
    id: 'AI-DOCS-TOKEN-EXAMPLE-001',
    description: 'AI docs must not include realistic token examples',
    pattern:
      /(?:GITHUB_PERSONAL_ACCESS_TOKEN["'=:\s]+["']?ghp_|ghp_[A-Za-z0-9_]{12,}|sbp_[A-Za-z0-9]{12,}|VERCEL_API_KEY=["']?[A-Za-z0-9_-]{12,})/,
  },
];

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function shouldScanFile(filePath) {
  return SCANNED_EXTENSIONS.has(path.extname(filePath));
}

function walk(targetPath) {
  const absolutePath = path.join(root, targetPath);
  if (!fs.existsSync(absolutePath)) return [];

  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) {
    return shouldScanFile(absolutePath) ? [targetPath] : [];
  }

  if (!stat.isDirectory()) return [];

  const results = [];
  const stack = [absolutePath];
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

function collectTargetFiles() {
  return [...new Set(TARGET_PATHS.flatMap((targetPath) => walk(targetPath)))].sort();
}

function checkContent(filePath, content) {
  const findings = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
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

function runConsistencyCheck() {
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
