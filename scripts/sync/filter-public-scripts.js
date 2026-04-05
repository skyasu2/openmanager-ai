#!/usr/bin/env node
/**
 * Filter package.json scripts to only include publicly safe entries.
 *
 * Usage: node filter-public-scripts.js <pkg-path> <allowlist-json> [override-json]
 *   pkg-path      - Path to package.json to modify in-place
 *   allowlist-json - JSON array of allowed script names, e.g. '["dev","build"]'
 *   override-json - Optional JSON object of script replacements keyed by script name
 */

'use strict';

const fs = require('node:fs');

const [, , pkgPath, allowlistJson, overrideJson] = process.argv;

if (!pkgPath || !allowlistJson) {
  process.stderr.write(
    'Usage: filter-public-scripts.js <pkg-path> <allowlist-json> [override-json]\n'
  );
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const allowed = new Set(JSON.parse(allowlistJson));
const overrides = overrideJson ? JSON.parse(overrideJson) : {};

const filtered = {};
for (const [key, value] of Object.entries(pkg.scripts || {})) {
  if (!allowed.has(key)) continue;
  filtered[key] =
    typeof overrides[key] === 'string' && overrides[key].trim().length > 0
      ? overrides[key]
      : value;
}
pkg.scripts = filtered;

fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
