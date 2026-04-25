#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const TIME_ZONE = 'Asia/Seoul';
const OUTPUT_PATH = 'docs/reference/architecture/system/component-dependency-map.md';
const OUTPUT_JSON_PATH = 'reports/docs/component-dependency-map.json';
const TOP_NODE_LIMIT = 12;
const TOP_DOMAIN_EDGE_LIMIT = 28;
const TOP_SCC_LIMIT = 10;
const SKIP_DIR_NAMES = new Set(['.git', 'node_modules', '.next', 'coverage', 'dist']);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface DomainEdgeRow {
  fromDomain: string;
  toDomain: string;
  count: number;
}

interface ComponentGraph {
  edges: [string, string][];
  inDegree: Map<string, number>;
  outDegree: Map<string, number>;
  aliasEdgeCount: number;
  relativeEdgeCount: number;
}

interface DomainStats {
  domainNodes: Map<string, number>;
  domainEdgeRows: DomainEdgeRow[];
}

interface SccResult {
  groups: string[][];
  cycleGroups: string[][];
}

function formatDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const parsed: Record<string, string> = {};
  for (const part of parts) {
    if (part.type === 'literal') continue;
    parsed[part.type] = part.value;
  }

  return `${parsed.year}-${parsed.month}-${parsed.day}`;
}

function normalizePosix(input: string): string {
  return input.replace(/\\/g, '/');
}

function walkFiles(rootDir: string): string[] {
  const out: string[] = [];
  const stack: string[] = [rootDir];
  const root = path.resolve(rootDir);

  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        if (SKIP_DIR_NAMES.has(entry.name)) continue;
        stack.push(fullPath);
        continue;
      }

      const relative = normalizePosix(path.relative(root, fullPath));
      out.push(relative);
    }
  }

  return out;
}

function countLines(filePath: string): number {
  const text = fs.readFileSync(filePath, 'utf8');
  if (text.length === 0) return 0;
  return text.split('\n').length;
}

function resolveGeneratedDate(): string {
  const envDate = (process.env.DOCS_COMPONENT_MAP_DATE || '').trim();
  if (ISO_DATE_RE.test(envDate)) return envDate;

  if (fs.existsSync(OUTPUT_PATH)) {
    const content = fs.readFileSync(OUTPUT_PATH, 'utf8');
    const match = content.match(/^\> Last reviewed:\s*(\d{4}-\d{2}-\d{2})\s*$/m);
    if (match?.[1] && ISO_DATE_RE.test(match[1])) return match[1];
  }

  return formatDate(new Date());
}

function isComponentFile(file: string): boolean {
  return (
    file.startsWith('src/components/') &&
    file.endsWith('.tsx') &&
    !file.endsWith('.test.tsx') &&
    !file.endsWith('.stories.tsx')
  );
}

function isAppLocalComponentFile(file: string): boolean {
  return (
    file.startsWith('src/app/') &&
    file.includes('/components/') &&
    file.endsWith('.tsx') &&
    !file.endsWith('.test.tsx') &&
    !file.endsWith('.stories.tsx')
  );
}

function resolveWithCandidates(basePath: string, componentSet: Set<string>): string | null {
  const candidates = [
    basePath,
    `${basePath}.tsx`,
    `${basePath}.ts`,
    `${basePath}.jsx`,
    `${basePath}.js`,
    `${basePath}/index.tsx`,
    `${basePath}/index.ts`,
    `${basePath}/index.jsx`,
    `${basePath}/index.js`,
  ];

  for (const candidate of candidates) {
    if (componentSet.has(candidate)) return candidate;
  }

  return null;
}

function resolveComponentImport(fromFile: string, specifier: string, componentSet: Set<string>): string | null {
  if (specifier.startsWith('@/components/')) {
    const base = `src/components/${specifier.slice('@/components/'.length)}`;
    return resolveWithCandidates(base, componentSet);
  }

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const fromDir = path.posix.dirname(fromFile);
    const joined = path.posix.normalize(path.posix.join(fromDir, specifier));
    return resolveWithCandidates(joined, componentSet);
  }

  return null;
}

function parseImportSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const seen = new Set<string>();

  const patterns = [
    /\bimport\s+(?:type\s+)?[\s\S]*?\sfrom\s+['"]([^'"\n]+)['"]/g,
    /\bimport\s+['"]([^'"\n]+)['"]/g,
    /\bexport\s+(?:type\s+)?[\s\S]*?\sfrom\s+['"]([^'"\n]+)['"]/g,
  ];

  for (const regex of patterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      const spec = match[1];
      if (!spec || seen.has(spec)) continue;
      seen.add(spec);
      specs.push(spec);
    }
  }

  return specs;
}

function domainOf(file: string): string {
  const relative = file.replace(/^src\/components\//, '');
  const index = relative.indexOf('/');
  if (index === -1) return '(root)';
  return relative.slice(0, index);
}

function componentLabel(file: string): string {
  return file.replace(/^src\/components\//, '').replace(/\.tsx$/, '');
}

function appLocalComponentLabel(file: string): string {
  return file.replace(/^src\/app\//, '').replace(/\.tsx$/, '');
}

function appLocalComponentArea(file: string): string {
  const relative = file.replace(/^src\/app\//, '');
  const componentsIndex = relative.indexOf('/components/');
  if (componentsIndex === -1) return '(unknown)';
  return relative.slice(0, componentsIndex) || '(root)';
}

function buildComponentGraph(componentFiles: string[]): ComponentGraph {
  const componentSet = new Set(componentFiles);
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  const edges: [string, string][] = [];

  for (const file of componentFiles) {
    inDegree.set(file, 0);
    outDegree.set(file, 0);
  }

  let aliasEdgeCount = 0;
  let relativeEdgeCount = 0;

  for (const file of componentFiles) {
    const fullPath = path.join(process.cwd(), file);
    const source = fs.readFileSync(fullPath, 'utf8');
    const specs = parseImportSpecifiers(source);
    const localTargets = new Set<string>();

    for (const spec of specs) {
      const target = resolveComponentImport(file, spec, componentSet);
      if (!target || target === file) continue;
      if (localTargets.has(target)) continue;
      localTargets.add(target);

      if (spec.startsWith('@/components/')) aliasEdgeCount += 1;
      if (spec.startsWith('./') || spec.startsWith('../')) relativeEdgeCount += 1;

      edges.push([file, target]);
      outDegree.set(file, (outDegree.get(file) || 0) + 1);
      inDegree.set(target, (inDegree.get(target) || 0) + 1);
    }
  }

  return { edges, inDegree, outDegree, aliasEdgeCount, relativeEdgeCount };
}

function buildDomainStats(componentFiles: string[], edges: [string, string][]): DomainStats {
  const domainNodes = new Map<string, number>();
  const domainEdges = new Map<string, number>();

  for (const file of componentFiles) {
    const domain = domainOf(file);
    domainNodes.set(domain, (domainNodes.get(domain) || 0) + 1);
  }

  for (const [from, to] of edges) {
    const fromDomain = domainOf(from);
    const toDomain = domainOf(to);
    const key = `${fromDomain}=>${toDomain}`;
    domainEdges.set(key, (domainEdges.get(key) || 0) + 1);
  }

  const domainEdgeRows: DomainEdgeRow[] = Array.from(domainEdges.entries())
    .map(([key, count]) => {
      const sepIdx = key.indexOf('=>');
      const fromDomain = key.slice(0, sepIdx);
      const toDomain = key.slice(sepIdx + 2);
      return { fromDomain, toDomain, count };
    })
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.fromDomain.localeCompare(b.fromDomain) ||
        a.toDomain.localeCompare(b.toDomain)
    );

  return { domainNodes, domainEdgeRows };
}

function topEntries(map: Map<string, number>, limit: number): [string, number][] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function buildDomainMermaid(domainNodes: Map<string, number>, domainEdgeRows: DomainEdgeRow[]): string {
  const sortedDomains = Array.from(domainNodes.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const idMap = new Map<string, string>();

  let out = 'flowchart LR\n';
  sortedDomains.forEach(([domain, count], index) => {
    const id = `d${index}`;
    idMap.set(domain, id);
    out += `  ${id}["${domain} (${count})"]\n`;
  });

  for (const row of domainEdgeRows.slice(0, TOP_DOMAIN_EDGE_LIMIT)) {
    const fromId = idMap.get(row.fromDomain);
    const toId = idMap.get(row.toDomain);
    if (!fromId || !toId) continue;
    out += `  ${fromId} -->|${row.count}| ${toId}\n`;
  }

  return out;
}

function markdownTable(rows: string[][], headers: string[]): string {
  let out = `| ${headers.join(' | ')} |\n`;
  out += `| ${headers.map(() => '---').join(' | ')} |\n`;
  for (const row of rows) {
    out += `| ${row.join(' | ')} |\n`;
  }
  return out;
}

function toPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function detectSCC(nodes: string[], edges: [string, string][]): SccResult {
  const adjacency = new Map<string, string[]>();
  const selfLoops = new Set<string>();

  for (const node of nodes) adjacency.set(node, []);
  for (const [from, to] of edges) {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from)!.push(to);
    if (from === to) selfLoops.add(from);
  }

  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const groups: string[][] = [];

  function strongConnect(v: string): void {
    indices.set(v, index);
    lowLinks.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);

    for (const w of adjacency.get(v) ?? []) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowLinks.set(v, Math.min(lowLinks.get(v)!, lowLinks.get(w)!));
      } else if (onStack.has(w)) {
        lowLinks.set(v, Math.min(lowLinks.get(v)!, indices.get(w)!));
      }
    }

    if (lowLinks.get(v) === indices.get(v)) {
      const component: string[] = [];
      while (stack.length > 0) {
        const w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
        if (w === v) break;
      }
      groups.push(component);
    }
  }

  for (const node of nodes) {
    if (!indices.has(node)) strongConnect(node);
  }

  const cycleGroups = groups
    .filter((g) => g.length > 1 || (g.length === 1 && selfLoops.has(g[0] ?? '')))
    .sort((a, b) => b.length - a.length || (a[0] ?? '').localeCompare(b[0] ?? ''));

  return { groups, cycleGroups };
}

function main(): void {
  const generatedDate = resolveGeneratedDate();
  const trackedFiles = walkFiles('.');

  const componentFiles = trackedFiles.filter(isComponentFile).sort((a, b) => a.localeCompare(b));
  const appLocalComponentFiles = trackedFiles.filter(isAppLocalComponentFile).sort((a, b) => a.localeCompare(b));

  let componentSourceLines = 0;
  for (const file of componentFiles) componentSourceLines += countLines(file);

  const appLocalAreaRows: [string, string][] = Array.from(
    appLocalComponentFiles.reduce((acc, file) => {
      const area = appLocalComponentArea(file);
      acc.set(area, (acc.get(area) || 0) + 1);
      return acc;
    }, new Map<string, number>()),
  )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([area, count]) => [area, String(count)]);

  const graph = buildComponentGraph(componentFiles);
  const domainStats = buildDomainStats(componentFiles, graph.edges);
  const scc = detectSCC(componentFiles, graph.edges);

  const isolatedComponents = componentFiles.filter(
    (file) => (graph.inDegree.get(file) || 0) === 0 && (graph.outDegree.get(file) || 0) === 0,
  );

  const topIn = topEntries(graph.inDegree, TOP_NODE_LIMIT);
  const topOut = topEntries(graph.outDegree, TOP_NODE_LIMIT);
  const densityBase = componentFiles.length * Math.max(componentFiles.length - 1, 1);
  const density = densityBase === 0 ? 0 : graph.edges.length / densityBase;
  const largestCycleSize = scc.cycleGroups.length > 0 ? (scc.cycleGroups[0]?.length ?? 0) : 0;

  const domainNodeRows = Array.from(domainStats.domainNodes.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([domain, count]) => [domain, String(count)]);

  const domainEdgeRows = domainStats.domainEdgeRows
    .slice(0, TOP_DOMAIN_EDGE_LIMIT)
    .map((row) => [row.fromDomain, row.toDomain, String(row.count)]);

  const topInRows = topIn.map(([file, count]) => [componentLabel(file), String(count)]);
  const topOutRows = topOut.map(([file, count]) => [componentLabel(file), String(count)]);
  const topCycleRows = scc.cycleGroups.slice(0, TOP_SCC_LIMIT).map((group, index) => [
    `C${index + 1}`,
    String(group.length),
    group.slice(0, 5).map((node) => componentLabel(node)).join(', '),
  ]);
  const sampleOut = topOut.slice(0, 8).map(([file]) => {
    const deps = graph.edges.filter(([from]) => from === file).slice(0, 6).map(([, to]) => componentLabel(to));
    return `${componentLabel(file)} -> ${deps.length > 0 ? deps.join(', ') : '(none)'}`;
  });

  const mermaid = buildDomainMermaid(domainStats.domainNodes, domainStats.domainEdgeRows);

  let doc = '';
  doc += '# Frontend Component Dependency Map\n\n';
  doc += '> src/components 중심의 정적 import 관계를 요약한 의존도 맵\n';
  doc += '> Owner: platform-architecture\n';
  doc += '> Status: Active\n';
  doc += '> Doc type: Reference\n';
  doc += `> Last reviewed: ${generatedDate}\n`;
  doc += '> Canonical: docs/reference/architecture/system/component-dependency-map.md\n';
  doc += '> Tags: architecture,frontend,components,dependency-map\n';
  doc += '>\n';
  doc += `> Auto-generated: ${generatedDate} (KST)\n`;
  doc += '> Generation command: `npm run docs:components:map`\n\n';
  doc += '## Decision\n\n';
  doc += '- 문서 카테고리는 재편하지 않고 기존 `docs/reference/architecture/system`에 **추가**했습니다.\n';
  doc += '- 이유: 기존 IA를 보존하면서도 의존도 맵을 운영 문서로 바로 연결할 수 있기 때문입니다.\n\n';
  doc += '## Scope\n\n';
  doc += '- 대상 노드: `src/components/**/*.tsx` (단, `*.test.tsx`, `*.stories.tsx` 제외)\n';
  doc += '- 대상 엣지: 정적 `import`/`export ... from` 중 내부 컴포넌트로 해석되는 참조\n';
  doc += '- 제외: 런타임 동적 import, Next route(`src/app`) 전용 컴포넌트, 외부 패키지 의존성\n\n';
  doc += '## Inventory Coverage\n\n';
  doc += markdownTable(
    [
      ['Shared component graph scope (`src/components/**/*.tsx`)', String(componentFiles.length)],
      ['Route-local components excluded from graph (`src/app/**/components/**/*.tsx`)', String(appLocalComponentFiles.length)],
      ['Total TSX component inventory', String(componentFiles.length + appLocalComponentFiles.length)],
    ],
    ['Inventory Slice', 'Count'],
  );
  doc += '\n';
  doc += '## App Route-Local Component Distribution\n\n';
  if (appLocalAreaRows.length === 0) {
    doc += '- No route-local component files detected under `src/app/**/components`.\n\n';
  } else {
    doc += markdownTable(appLocalAreaRows, ['App Area', 'Node Count']);
    doc += '\n';
    doc += 'Route-local component files:\n\n';
    for (const file of appLocalComponentFiles) doc += `- \`${appLocalComponentLabel(file)}\`\n`;
    doc += '\n';
  }
  doc += '## Snapshot Metrics\n\n';
  doc += markdownTable(
    [
      ['Component source lines', String(componentSourceLines)],
      ['Component nodes', String(componentFiles.length)],
      ['Component edges', String(graph.edges.length)],
      ['Graph density', toPercent(density)],
      ['Alias edges (`@/components/*`)', String(graph.aliasEdgeCount)],
      ['Relative edges (`./`, `../`)', String(graph.relativeEdgeCount)],
      ['Isolated components', String(isolatedComponents.length)],
      ['SCC cycle groups', String(scc.cycleGroups.length)],
      ['Largest cycle size', String(largestCycleSize)],
    ],
    ['Metric', 'Value'],
  );
  doc += '\n';
  doc += '## Domain-Level Mermaid\n\n```mermaid\n';
  doc += mermaid;
  doc += '```\n\n';
  doc += '## Domain Node Distribution\n\n';
  doc += markdownTable(domainNodeRows, ['Domain', 'Node Count']);
  doc += '\n';
  doc += `## Top Domain Edges (Top ${TOP_DOMAIN_EDGE_LIMIT})\n\n`;
  doc += markdownTable(domainEdgeRows, ['From', 'To', 'Edge Count']);
  doc += '\n';
  doc += `## Top Component Hubs by In-Degree (Top ${TOP_NODE_LIMIT})\n\n`;
  doc += markdownTable(topInRows, ['Component', 'In-Degree']);
  doc += '\n';
  doc += `## Top Component Hubs by Out-Degree (Top ${TOP_NODE_LIMIT})\n\n`;
  doc += markdownTable(topOutRows, ['Component', 'Out-Degree']);
  doc += '\n';
  doc += `## Cycle Risk (SCC Top ${TOP_SCC_LIMIT})\n\n`;
  if (topCycleRows.length === 0) {
    doc += '- No strongly connected component cycle groups detected.\n\n';
  } else {
    doc += markdownTable(topCycleRows, ['Cycle Group', 'Size', 'Sample Components']);
    doc += '\n';
  }
  doc += '## ASCII Quick View\n\n```text\n[Top Outgoing Dependency Samples]\n';
  for (const line of sampleOut) doc += `${line}\n`;
  doc += '```\n\n';
  doc += '## Update Rule\n\n';
  doc += '1. 구조 변경 후 `npm run docs:components:map` 실행\n';
  doc += '2. 문서 변경과 코드 변경을 같은 PR에서 검토\n';
  doc += '3. 큰 구조 변경 시 `Top Domain Edges`와 `Hub` 변화를 릴리스 노트에 요약\n';

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, doc);
  fs.mkdirSync(path.dirname(OUTPUT_JSON_PATH), { recursive: true });
  fs.writeFileSync(
    OUTPUT_JSON_PATH,
    JSON.stringify(
      {
        generatedAt: generatedDate,
        scope: {
          nodes: 'src/components/**/*.tsx (excluding test/stories)',
          edges: 'static import/export-from resolved inside src/components',
          excludedRouteLocalNodes: 'src/app/**/components/**/*.tsx',
        },
        inventory: {
          sharedComponentNodes: componentFiles.length,
          routeLocalComponentNodes: appLocalComponentFiles.length,
          totalComponentNodes: componentFiles.length + appLocalComponentFiles.length,
        },
        metrics: {
          componentSourceLines,
          componentNodes: componentFiles.length,
          componentEdges: graph.edges.length,
          graphDensity: Number(density.toFixed(6)),
          aliasEdges: graph.aliasEdgeCount,
          relativeEdges: graph.relativeEdgeCount,
          isolatedComponents: isolatedComponents.length,
          sccCycleGroups: scc.cycleGroups.length,
          largestCycleSize,
        },
        topInDegree: topIn.map(([file, count]) => ({ component: componentLabel(file), inDegree: count })),
        topOutDegree: topOut.map(([file, count]) => ({ component: componentLabel(file), outDegree: count })),
        topDomainEdges: domainStats.domainEdgeRows.slice(0, TOP_DOMAIN_EDGE_LIMIT),
        appRouteLocalDistribution: appLocalAreaRows.map(([area, count]) => ({ area, count: Number(count) })),
        appRouteLocalFiles: appLocalComponentFiles.map((file) => appLocalComponentLabel(file)),
        topCycles: scc.cycleGroups.slice(0, TOP_SCC_LIMIT).map((group, idx) => ({
          id: `C${idx + 1}`,
          size: group.length,
          members: group.map((node) => componentLabel(node)),
        })),
      },
      null,
      2,
    ),
  );

  console.log(`Generated ${OUTPUT_PATH}`);
  console.log(`Generated ${OUTPUT_JSON_PATH}`);
  console.log(`nodes=${componentFiles.length}, edges=${graph.edges.length}, isolated=${isolatedComponents.length}`);
}

main();
