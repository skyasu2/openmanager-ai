#!/usr/bin/env ts-node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const home = process.env.HOME;

const expectedProjectServers = [
  'supabase-db',
  'diagram-converter',
  'playwright',
  'next-devtools',
  'chrome-devtools',
  'github',
  'openaiDeveloperDocs',
  'vercel',
].sort();

const openmanagerServerNames = new Set([
  ...expectedProjectServers,
  'diagram-converter-mcp',
  'openmanager-ai-mcp',
  'supabase',
]);

const codexLocalSecretPatterns = [
  {
    name: 'GitHub classic PAT',
    pattern: /\bghp_[A-Za-z0-9_]{20,}\b/,
  },
  {
    name: 'GitHub fine-grained PAT',
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  },
  {
    name: 'Tavily API key',
    pattern: /\btvly-[A-Za-z0-9_-]{12,}\b/,
  },
  {
    name: 'Supabase access token',
    pattern: /\bsbp_[A-Za-z0-9_]{20,}\b/,
  },
  {
    name: 'inline MCP API key env assignment',
    pattern:
      /^\s*(GITHUB_PERSONAL_ACCESS_TOKEN|GITHUB_TOKEN|TAVILY_API_KEY|BRAVE_API_KEY|SUPABASE_ACCESS_TOKEN|VERCEL_API_KEY)\s*=\s*["'](?!__OPENMANAGER_RUNTIME_ENV__|__REDACTED_LOCAL_BACKUP__|__REDACTED__)[^"'\r\n]+["']/m,
  },
  {
    name: 'Tavily MCP URL API key',
    pattern: /\btavilyApiKey=(?!<your-api-key>|__REDACTED_LOCAL_BACKUP__|__REDACTED__)[^"'\s&]+/,
  },
];

function readTextIfExists(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8') as string;
}

function mcpServersFromToml(file: string): string[] {
  const content = readTextIfExists(file);
  if (!content) return [];

  const servers = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    const match = /^\[mcp_servers\.([^\].]+)\]$/.exec(line.trim());
    if (match?.[1]) servers.add(match[1]);
  }
  return [...servers].sort();
}

function skillNames(baseDir: string): string[] {
  if (!fs.existsSync(baseDir)) return [];
  return fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((entry: { name: string; isDirectory(): boolean }) => {
      return entry.isDirectory() && fs.existsSync(path.join(baseDir, entry.name, 'SKILL.md'));
    })
    .map((entry: { name: string }) => entry.name)
    .sort();
}

function sameSet(actual: string[], expected: string[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function intersection(values: string[], allowed: Set<string>): string[] {
  return values.filter((value) => allowed.has(value)).sort();
}

function codexTomlConfigFiles(baseDir: string): string[] {
  if (!fs.existsSync(baseDir)) return [];
  return fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((entry: { name: string; isFile(): boolean }) => {
      return entry.isFile() && entry.name.startsWith('config.toml');
    })
    .map((entry: { name: string }) => path.join(baseDir, entry.name))
    .sort();
}

function assertNoLocalCodexSecrets(files: string[], failures: string[]): void {
  for (const file of files) {
    const content = readTextIfExists(file);
    if (!content) continue;

    const matchedPattern = codexLocalSecretPatterns.find(({ pattern }) => pattern.test(content));
    if (matchedPattern) {
      failures.push(
        `${path.relative(root, file)} contains ${matchedPattern.name}; redact local backup/config before running Codex`
      );
    }
  }
}

const failures: string[] = [];
const warnings: string[] = [];

const projectConfigPath = path.join(root, '.codex/config.toml');
const projectServers = mcpServersFromToml(projectConfigPath);
if (!sameSet(projectServers, expectedProjectServers)) {
  failures.push(
    `.codex/config.toml mcp_servers mismatch: ${projectServers.join(', ') || '<none>'}`
  );
}

assertNoLocalCodexSecrets(codexTomlConfigFiles(path.join(root, '.codex')), failures);

const projectSkillNames = skillNames(path.join(root, '.agents/skills'));
if (projectSkillNames.length === 0) {
  failures.push('.agents/skills has no project skills');
}

const projectCodexSkillNames = skillNames(path.join(root, '.codex/skills'));
const projectCodexDuplicates = projectCodexSkillNames.filter((name) =>
  projectSkillNames.includes(name)
);
if (projectCodexDuplicates.length > 0) {
  failures.push(
    `.codex/skills must not duplicate OpenManager skills: ${projectCodexDuplicates.join(', ')}`
  );
}

if (home) {
  const homeConfigPath = path.join(home, '.codex/config.toml');
  const homeOpenmanagerServers = intersection(
    mcpServersFromToml(homeConfigPath),
    openmanagerServerNames
  );
  if (homeOpenmanagerServers.length > 0) {
    failures.push(
      `~/.codex/config.toml must not define OpenManager MCP servers: ${homeOpenmanagerServers.join(', ')}`
    );
  }

  const homeSkillNames = skillNames(path.join(home, '.codex/skills'));
  const homeDuplicates = homeSkillNames.filter((name) => projectSkillNames.includes(name));
  if (homeDuplicates.length > 0) {
    failures.push(
      `~/.codex/skills must not duplicate OpenManager skills: ${homeDuplicates.join(', ')}`
    );
  }
} else {
  warnings.push('HOME is not set; skipped user-scope Codex checks');
}

for (const warning of warnings) {
  console.log(`WARN CODEX-PROJECT-SCOPE-001 ${warning}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(
      `FAIL CODEX-PROJECT-SCOPE-001 ${failure} action_hint="bash scripts/ai/setup-codex-project-scope.sh"`
    );
  }
  process.exit(1);
}

console.log('PASS CODEX-PROJECT-SCOPE-001 OpenManager Codex MCP and skills are project-scoped');
