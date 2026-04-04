#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const {
  findGitLabCiSemanticIssues,
} = require('../hooks/pre-push-guards');

const rootDir = path.resolve(__dirname, '../..');
const gitlabCiPath = path.join(rootDir, '.gitlab-ci.yml');

if (!fs.existsSync(gitlabCiPath)) {
  console.log('⚪ .gitlab-ci.yml not found - semantic guard skipped');
  process.exit(0);
}

const content = fs.readFileSync(gitlabCiPath, 'utf8');
const issues = findGitLabCiSemanticIssues(content);

if (issues.length === 0) {
  console.log('✅ GitLab CI semantic guard passed');
  process.exit(0);
}

console.log('❌ GitLab CI semantic guard failed');
for (const issue of issues) {
  console.log(
    `- line ${issue.line} (${issue.scriptKey}): ${issue.message} -> ${issue.snippet.trim()}`
  );
}
process.exit(1);
