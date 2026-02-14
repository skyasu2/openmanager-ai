#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const docsRoot = 'docs';
const outputPath = 'docs/development/docs-inventory.md';

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(fullPath));
    } else {
      out.push(fullPath);
    }
  }
  return out;
}

const allFiles = walk(docsRoot);
const mdFiles = allFiles.filter((file) => file.endsWith('.md'));

const byTopDir = new Map();
for (const file of mdFiles) {
  const relative = file.replace(/^docs\//, '');
  const top = relative.includes('/') ? relative.split('/')[0] : relative;
  byTopDir.set(top, (byTopDir.get(top) || 0) + 1);
}

let lines = 0;
for (const file of mdFiles) {
  lines += fs.readFileSync(file, 'utf8').split('\n').length;
}

const rows = [...byTopDir.entries()].sort((a, b) => b[1] - a[1]);

let out = '';
out += '# Documentation Inventory\n\n';
out += '> 문서 현황(개수/분포/라인 수)을 요약한 인벤토리 리포트\n';
out += '> Owner: docs-platform\n';
out += '> Status: Active\n';
out += '> Doc type: Reference\n';
out += `> Last reviewed: ${new Date().toISOString().slice(0, 10)}\n`;
out += '> Canonical: docs/development/docs-inventory.md\n';
out += '> Tags: docs,inventory,report\n';
out += '>\n';
out += `> Auto-generated: ${new Date().toISOString().slice(0, 10)}\n`;
out += '> Source: `docs/`\n\n';
out += `- Total files in docs: **${allFiles.length}**\n`;
out += `- Total markdown docs: **${mdFiles.length}**\n`;
out += `- Total markdown lines: **${lines}**\n\n`;
out += '## Markdown Distribution\n\n';
out += '| Scope | Count |\n|---|---:|\n';
for (const [scope, count] of rows) {
  out += `| ${scope} | ${count} |\n`;
}
out += '\n## Notes\n\n';
out += '- `analysis/` and `reviews/` are treated as historical docs.\n';
out += '- Canonical docs are managed in `docs/development/documentation-management.md`.\n';

fs.writeFileSync(outputPath, out);
console.log(`Generated ${outputPath}`);
