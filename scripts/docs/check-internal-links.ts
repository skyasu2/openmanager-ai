#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const docsRoot = process.argv[2] || 'docs';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(fullPath));
    } else if (entry.name.endsWith('.md')) {
      out.push(fullPath);
    }
  }
  return out;
}

function resolveLink(filePath: string, link: string): string | null {
  let target = (link.split('#')[0] ?? '').trim();
  if (!target) {
    return null;
  }

  if (target.startsWith('<') && target.endsWith('>')) {
    target = target.slice(1, -1);
  }

  if (target.startsWith('/')) {
    return path.join('.', target);
  }

  return path.resolve(path.dirname(filePath), target);
}

const markdownFiles = walk(docsRoot);
const missing: string[] = [];

for (const filePath of markdownFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g);

  for (const match of matches) {
    const rawLink = (match[1] ?? '').trim();

    if (
      !rawLink ||
      rawLink.startsWith('#') ||
      rawLink.startsWith('http://') ||
      rawLink.startsWith('https://') ||
      rawLink.startsWith('mailto:')
    ) {
      continue;
    }

    let resolved = resolveLink(filePath, rawLink);
    if (!resolved) {
      continue;
    }

    if (!path.extname(resolved) && fs.existsSync(`${resolved}.md`)) {
      resolved = `${resolved}.md`;
    }

    if (!fs.existsSync(resolved)) {
      missing.push(`${filePath} -> ${rawLink}`);
    }
  }
}

if (missing.length > 0) {
  console.error(`Found ${missing.length} broken internal links:`);
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log(`Internal links check passed (${markdownFiles.length} files scanned)`);
