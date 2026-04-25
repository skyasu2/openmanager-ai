#!/usr/bin/env ts-node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const baselinePath = path.join(root, 'config/ai/skill-baselines.json');
const packagePath = path.join(root, 'package.json');
const legacyGeminiSyncScriptPath = path.join(
  root,
  'scripts/skills/sync-gemini-skills.sh'
);
interface PackageJson {
  scripts?: Record<string, string>;
}

interface SkillBaseline {
  skills?: Record<string, SkillConfig>;
}

interface SkillConfig {
  adapters?: Record<string, string | undefined>;
}

type Frontmatter = Record<string, string>;

interface DirectoryEntry {
  name: string;
  isDirectory(): boolean;
}

const requiredRefs: string[] = [
  'docs/guides/ai/skill-standards.md',
  'config/ai/skill-baselines.json'
];

function rel(absPath: string): string {
  return path.relative(root, absPath).replaceAll(path.sep, '/');
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function hasSkillMd(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'SKILL.md'));
}

function skillDirs(baseRel: string): string[] {
  const base = path.join(root, baseRel);
  if (!fs.existsSync(base)) return [];
  return (fs.readdirSync(base, { withFileTypes: true }) as DirectoryEntry[])
    .filter((entry) => entry.isDirectory() && hasSkillMd(path.join(base, entry.name)))
    .map((entry) => entry.name)
    .sort();
}

function userGeminiSkills(): string[] {
  const home = process.env.HOME;
  if (!home) return [];
  const base = path.join(home, '.gemini/skills');
  if (!fs.existsSync(base)) return [];
  return (fs.readdirSync(base, { withFileTypes: true }) as DirectoryEntry[])
    .filter((entry) => entry.isDirectory() && hasSkillMd(path.join(base, entry.name)))
    .map((entry) => entry.name)
    .sort();
}

function parseFrontmatter(content: string): Frontmatter {
  if (!content.startsWith('---\n')) return {};
  const end = content.indexOf('\n---', 4);
  if (end === -1) return {};
  const raw = content.slice(4, end).trim();
  const data: Frontmatter = {};
  for (const line of raw.split('\n')) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (match) {
      const key = match[1];
      const value = match[2] || '';
      if (key) data[key] = value.replace(/^["']|["']$/g, '');
    }
  }
  return data;
}

const failures: string[] = [];
const warnings: string[] = [];

function fail(message: string): void {
  failures.push(message);
}

function warn(message: string): void {
  warnings.push(message);
}

if (fs.existsSync(legacyGeminiSyncScriptPath)) {
  fail(
    `${rel(legacyGeminiSyncScriptPath)} must not exist; OpenManager shared skills stay in .agents/skills, not ~/.gemini/skills`
  );
}

if (fs.existsSync(packagePath)) {
  const packageJson = readJson<PackageJson>(packagePath);
  const scripts = packageJson.scripts || {};
  if (scripts['skills:sync:gemini']) {
    fail('package.json must not define skills:sync:gemini');
  }

  const skillSyncCommands = Object.entries(scripts).filter(([name]) =>
    name.startsWith('skills:sync')
  );
  for (const [name, command] of skillSyncCommands) {
    if (
      typeof command === 'string' &&
      /(?:sync-gemini-skills|~\/\.gemini\/skills|\$HOME\/\.gemini\/skills)/.test(command)
    ) {
      fail(`package.json ${name} must not sync OpenManager skills into Gemini user scope`);
    }
  }
}

if (!fs.existsSync(baselinePath)) {
  fail(`missing baseline file: ${rel(baselinePath)}`);
} else {
  const baseline = readJson<SkillBaseline>(baselinePath);
  const skills = baseline.skills || {};
  const skillNames = Object.keys(skills).sort();

  const agentsSkills = skillDirs('.agents/skills');
  const claudeSkills = skillDirs('.claude/skills');
  const geminiOverlaySkills = skillDirs('.gemini/skills');
  const geminiUserSkills = userGeminiSkills();
  const geminiOverlayIgnoreCheck = spawnSync(
    'git',
    ['check-ignore', '--quiet', '--', '.gemini/skills/gemini-example/SKILL.md'],
    { cwd: root }
  );
  if (geminiOverlayIgnoreCheck.status === 0) {
    fail('.gemini/skills Gemini-only overlay path is ignored by git');
  }

  for (const dir of agentsSkills) {
    if (!skills[dir]) fail(`baseline missing .agents skill: ${dir}`);
  }
  for (const dir of claudeSkills) {
    if (!skills[dir]) fail(`baseline missing .claude skill: ${dir}`);
  }

  for (const name of skillNames) {
    const config = skills[name];
    if (!config) {
      fail(`${name}: missing baseline config`);
      continue;
    }

    const adapters = config.adapters || {};
    for (const adapterName of ['codex', 'claude', 'gemini']) {
      const adapterRel = adapters[adapterName];
      if (!adapterRel) {
        fail(`${name}: missing ${adapterName} adapter path in baseline`);
        continue;
      }

      const adapterAbs = path.join(root, adapterRel);
      if (!fs.existsSync(adapterAbs)) {
        fail(`${name}: missing ${adapterName} adapter file: ${adapterRel}`);
        continue;
      }

      const content = fs.readFileSync(adapterAbs, 'utf8');
      const frontmatter = parseFrontmatter(content);
      if (!frontmatter.description) {
        fail(`${adapterRel}: missing frontmatter description`);
      }
      for (const requiredRef of requiredRefs) {
        if (!content.includes(requiredRef)) {
          fail(`${adapterRel}: missing common baseline reference ${requiredRef}`);
        }
      }
    }

    if (!agentsSkills.includes(name)) fail(`${name}: missing .agents/skills adapter directory`);
    if (!claudeSkills.includes(name)) fail(`${name}: missing .claude/skills adapter directory`);
  }

  for (const overlay of geminiOverlaySkills) {
    if (agentsSkills.includes(overlay)) {
      fail(`.gemini/skills/${overlay}: same-name overlay is shadowed by .agents/skills/${overlay}`);
    } else {
      warn(`.gemini/skills/${overlay}: Gemini-only overlay present`);
    }
  }

  for (const userSkill of geminiUserSkills) {
    if (agentsSkills.includes(userSkill)) {
      fail(`~/.gemini/skills/${userSkill}: user-scope OpenManager skill copy is shadowed by .agents/skills/${userSkill}; run scripts/ai/setup-gemini-global.sh`);
    }
  }
}

for (const message of warnings) {
  console.log(`WARN SKILL-DRIFT-001 ${message}`);
}

if (failures.length > 0) {
  for (const message of failures) {
    console.error(`FAIL SKILL-DRIFT-001 ${message}`);
  }
  process.exit(1);
}

console.log('PASS SKILL-DRIFT-001 skill baseline and native adapter checks passed');
