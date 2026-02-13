#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = process.cwd();
const REGISTRY_PATH = path.join(REPO_ROOT, 'config/ai/stitch-project-registry.json');

function fail(msg) {
  console.error(`❌ ${msg}`);
}

function pass(msg) {
  console.log(`✅ ${msg}`);
}

function warn(msg) {
  console.warn(`⚠️ ${msg}`);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidProjectId(value) {
  return isNonEmptyString(value) && /^[0-9]{8,}$/.test(value);
}

function main() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    fail(`Registry not found: ${REGISTRY_PATH}`);
    process.exit(1);
  }

  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (error) {
    fail(`Invalid JSON in registry: ${error.message}`);
    process.exit(1);
  }

  const errors = [];

  if (!isNonEmptyString(registry.version)) {
    errors.push('`version` is required.');
  }

  if (!isNonEmptyString(registry.updatedAt)) {
    errors.push('`updatedAt` is required.');
  }

  if (registry.sourceOfTruth !== 'code') {
    errors.push('`sourceOfTruth` must be "code".');
  }

  if (!Array.isArray(registry.projects) || registry.projects.length === 0) {
    errors.push('`projects` must be a non-empty array.');
  }

  const projectIds = new Set();
  const projects = Array.isArray(registry.projects) ? registry.projects : [];

  for (const [index, project] of projects.entries()) {
    const prefix = `projects[${index}]`;

    if (!isValidProjectId(project.id)) {
      errors.push(`${prefix}.id must be a numeric string with length >= 8.`);
    }

    if (projectIds.has(project.id)) {
      errors.push(`${prefix}.id is duplicated (${project.id}).`);
    }
    projectIds.add(project.id);

    if (!isNonEmptyString(project.title)) {
      errors.push(`${prefix}.title is required.`);
    }

    if (!['active', 'legacy', 'archived'].includes(project.status)) {
      errors.push(`${prefix}.status must be one of: active, legacy, archived.`);
    }

    if (!Array.isArray(project.mappedFiles)) {
      errors.push(`${prefix}.mappedFiles must be an array.`);
      continue;
    }

    if (project.status === 'active' && project.mappedFiles.length === 0) {
      errors.push(`${prefix}.mappedFiles must not be empty for active project.`);
    }

    for (const mappedFile of project.mappedFiles) {
      if (!isNonEmptyString(mappedFile)) {
        errors.push(`${prefix}.mappedFiles contains an invalid path.`);
        continue;
      }

      const resolved = path.join(REPO_ROOT, mappedFile);
      if (!fs.existsSync(resolved)) {
        errors.push(`${prefix}.mappedFiles missing file: ${mappedFile}`);
      }
    }
  }

  const activeProjects = projects.filter((project) => project.status === 'active');
  if (activeProjects.length === 0) {
    errors.push('At least 1 active project is required.');
  }

  if (!isValidProjectId(registry.activeProjectId)) {
    errors.push('`activeProjectId` must be a valid numeric project id string.');
  } else if (!activeProjects.some((project) => project.id === registry.activeProjectId)) {
    errors.push('`activeProjectId` must point to one of the active projects.');
  }

  if (errors.length > 0) {
    console.error('\nStitch registry validation failed:');
    for (const error of errors) {
      fail(error);
    }
    process.exit(1);
  }

  pass('Registry structure is valid.');
  pass(`Active project: ${registry.activeProjectId}`);
  pass('Stitch usage mode: incremental UI improvement / prototyping');

  const legacyCount = projects.filter((project) => project.status === 'legacy').length;
  const archivedCount = projects.filter((project) => project.status === 'archived').length;

  if (activeProjects.length > 1) {
    warn(
      `${activeProjects.length} active projects detected. This is allowed, but 1 active project is recommended for simpler collaboration.`
    );
  }

  if (legacyCount > 0) {
    warn(
      `${legacyCount} legacy project(s) detected. This is normal during iteration; archive only when cleanup is needed.`
    );
  }

  console.log('\nSummary');
  console.log(`- total projects: ${projects.length}`);
  console.log(`- active: ${activeProjects.length}`);
  console.log(`- legacy: ${legacyCount}`);
  console.log(`- archived: ${archivedCount}`);
}

main();
