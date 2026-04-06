#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const [, , readmePath, packageJsonPath] = process.argv;

if (!readmePath || !packageJsonPath) {
  process.stderr.write(
    'Usage: node render-public-readme.js <readme-path> <package-json-path>\n'
  );
  process.exit(1);
}

const readme = fs.readFileSync(readmePath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const rendered = readme.replaceAll('{{VERSION}}', String(pkg.version || '0.0.0'));

fs.writeFileSync(readmePath, rendered);
