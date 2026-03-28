#!/usr/bin/env node
/**
 * Filter package.json scripts to only include publicly safe entries.
 *
 * Usage: node filter-public-scripts.js <pkg-path> <allowlist-json>
 *   pkg-path      - Path to package.json to modify in-place
 *   allowlist-json - JSON array of allowed script names, e.g. '["dev","build"]'
 */

'use strict';

const fs = require('node:fs');

const [, , pkgPath, allowlistJson] = process.argv;

if (!pkgPath || !allowlistJson) {
  process.stderr.write('Usage: filter-public-scripts.js <pkg-path> <allowlist-json>\n');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const allowed = new Set(JSON.parse(allowlistJson));

const filtered = {};
for (const [key, value] of Object.entries(pkg.scripts || {})) {
  if (allowed.has(key)) filtered[key] = value;
}
pkg.scripts = filtered;

fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
