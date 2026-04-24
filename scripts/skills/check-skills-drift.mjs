#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const baselinePath = path.join(root, 'config/ai/skill-baselines.json');
const requiredRefs = [
  'docs/guides/ai/skill-standards.md',
  'config/ai/skill-baselines.json'
];

function rel(absPath) {
  return path.relative(root, absPath).replaceAll(path.sep, '/');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hasSkillMd(dir) {
  return fs.existsSync(path.join(dir, 'SKILL.md'));
}

function skillDirs(baseRel) {
  const base = path.join(root, baseRel);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && hasSkillMd(path.join(base, entry.name)))
    .map((entry) => entry.name)
    .sort();
}

function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) return {};
  const end = content.indexOf('\n---', 4);
  if (end === -1) return {};
  const raw = content.slice(4, end).trim();
  const data = {};
  for (const line of raw.split('\n')) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (match) data[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return data;
}

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

if (!fs.existsSync(baselinePath)) {
  fail(`missing baseline file: ${rel(baselinePath)}`);
} else {
  const baseline = readJson(baselinePath);
  const skills = baseline.skills || {};
  const skillNames = Object.keys(skills).sort();

  const agentsSkills = skillDirs('.agents/skills');
  const claudeSkills = skillDirs('.claude/skills');
  const geminiOverlaySkills = skillDirs('.gemini/skills');
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
