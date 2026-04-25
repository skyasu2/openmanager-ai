#!/usr/bin/env ts-node
const fs = require('node:fs');
const path = require('node:path');

interface SettingsState {
  servers: string[];
  allowed: string[];
}

interface GeminiSettings {
  mcpServers?: Record<string, unknown>;
  mcp?: {
    allowed?: unknown;
  };
}

const root = path.resolve(__dirname, '../..');
const home = process.env.HOME;

const expectedProjectServers = [
  'diagram-converter-mcp',
  'supabase-db',
  'playwright',
  'next-devtools',
  'chrome-devtools',
  'github',
  'vercel',
].sort();

const legacyProjectServerAliases = ['openmanager-ai-mcp', 'supabase'];
const openmanagerServerNames = new Set([
  ...expectedProjectServers,
  ...legacyProjectServerAliases,
]);

const bootstrapStart = '<!-- OPENMANAGER-BOOTSTRAP:START -->';
const bootstrapEnd = '<!-- OPENMANAGER-BOOTSTRAP:END -->';

function readJson(file: string): GeminiSettings {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as GeminiSettings;
}

function sameSet(actual: string[], expected: string[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function settingsState(file: string): SettingsState | null {
  if (!fs.existsSync(file)) return null;
  const settings = readJson(file);
  const allowed = settings.mcp?.allowed;
  return {
    servers: Object.keys(settings.mcpServers || {}).sort(),
    allowed: Array.isArray(allowed)
      ? allowed.filter((value): value is string => typeof value === 'string').sort()
      : [],
  };
}

function intersection(values: string[], allowed: Set<string>): string[] {
  return values.filter((value) => allowed.has(value)).sort();
}

const failures: string[] = [];
const warnings: string[] = [];
const projectSettingsPath = path.join(root, '.gemini/settings.json');
const projectState = settingsState(projectSettingsPath);

if (!projectState) {
  failures.push('.gemini/settings.json is missing');
} else {
  if (!sameSet(projectState.servers, expectedProjectServers)) {
    failures.push(
      `.gemini/settings.json mcpServers mismatch: ${projectState.servers.join(', ') || '<none>'}`
    );
  }

  if (!sameSet(projectState.allowed, expectedProjectServers)) {
    failures.push(
      `.gemini/settings.json mcp.allowed mismatch: ${projectState.allowed.join(', ') || '<none>'}`
    );
  }
}

if (home) {
  const userSettingsPath = path.join(home, '.gemini/settings.json');
  const userState = settingsState(userSettingsPath);

  if (userState) {
    const globalOpenmanagerServers = intersection(userState.servers, openmanagerServerNames);
    const globalOpenmanagerAllowed = intersection(userState.allowed, openmanagerServerNames);

    if (globalOpenmanagerServers.length > 0) {
      failures.push(
        `~/.gemini/settings.json must not define OpenManager MCP servers: ${globalOpenmanagerServers.join(', ')}`
      );
    }

    if (globalOpenmanagerAllowed.length > 0) {
      failures.push(
        `~/.gemini/settings.json must not allow OpenManager MCP servers: ${globalOpenmanagerAllowed.join(', ')}`
      );
    }

    const nonProjectServers = userState.servers.filter(
      (name) => !openmanagerServerNames.has(name)
    );
    if (nonProjectServers.length > 0) {
      warnings.push(
        `~/.gemini/settings.json has non-OpenManager MCP servers: ${nonProjectServers.join(', ')}`
      );
    }
  }

  const globalMemoryPath = path.join(home, '.gemini/GEMINI.md');
  if (fs.existsSync(globalMemoryPath)) {
    const globalMemory = fs.readFileSync(globalMemoryPath, 'utf8');
    if (globalMemory.includes(bootstrapStart) || globalMemory.includes(bootstrapEnd)) {
      failures.push('~/.gemini/GEMINI.md still contains obsolete OpenManager bootstrap markers');
    }
  } else {
    warnings.push('~/.gemini/GEMINI.md is missing');
  }

  const legacyProjectMcpPath = path.join(home, 'mcp_project_settings.json');
  const legacyProjectMcpState = settingsState(legacyProjectMcpPath);
  if (legacyProjectMcpState) {
    const legacyOpenmanagerServers = intersection(
      legacyProjectMcpState.servers,
      openmanagerServerNames
    );
    if (legacyOpenmanagerServers.length > 0) {
      failures.push(
        `~/mcp_project_settings.json must not contain OpenManager MCP servers: ${legacyOpenmanagerServers.join(', ')}`
      );
    }
  }
}

for (const warning of warnings) {
  console.log(`WARN GEMINI-GLOBAL-CONFIG-001 ${warning}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(
      `FAIL GEMINI-GLOBAL-CONFIG-001 ${failure} action_hint="OPENMANAGER_SKIP_MCP_CACHE_INSTALL=true bash scripts/ai/setup-gemini-global.sh"`
    );
  }
  process.exit(1);
}

console.log('PASS GEMINI-GLOBAL-CONFIG-001 OpenManager MCP is project-scoped and user-scope config is clean');
