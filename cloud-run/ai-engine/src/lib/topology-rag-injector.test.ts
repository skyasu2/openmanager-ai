import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  TARGET_DOC_CHAR_MAX,
  TARGET_DOC_CHAR_MIN,
} from './rag-doc-policy';
import { buildTopologyDocuments } from './topology-rag-injector';
import type { OTelResourceCatalog } from '../types/otel-metrics';

function loadCatalogFixture(): OTelResourceCatalog {
  const fixtureCandidates = [
    join(process.cwd(), 'data/otel-data/resource-catalog.json'),
    join(process.cwd(), '../../public/data/otel-data/resource-catalog.json'),
  ];

  const filePath = fixtureCandidates.find((candidate) => existsSync(candidate));
  if (!filePath) {
    throw new Error(
      `resource-catalog.json fixture not found. tried: ${fixtureCandidates.join(', ')}`,
    );
  }

  return JSON.parse(readFileSync(filePath, 'utf-8')) as OTelResourceCatalog;
}

describe('topology-rag-injector', () => {
  it('splits the imported topology snapshot into two governance-sized documents', () => {
    const docs = buildTopologyDocuments(loadCatalogFixture());

    expect(docs).toHaveLength(2);
    expect(docs.map((doc) => doc.title)).toEqual([
      '현재 인프라 역할/트래픽 토폴로지 스냅샷',
      '현재 인프라 배치/운영 검증 스냅샷',
    ]);

    for (const doc of docs) {
      expect(doc.content.length).toBeGreaterThanOrEqual(TARGET_DOC_CHAR_MIN);
      expect(doc.content.length).toBeLessThanOrEqual(TARGET_DOC_CHAR_MAX);
      expect(doc.metadata.source_type).toBe('topology_resource_catalog');
      expect(String(doc.metadata.source_ref)).toContain('otel-resource-catalog:topology-');
      expect(String(doc.metadata.source_hash)).toHaveLength(64);
      expect(doc.content).not.toContain('전체 서버 ID:');
    }
  });

  it('keeps role-flow details and placement-governance details separated', () => {
    const [roleTrafficDoc, placementOpsDoc] = buildTopologyDocuments(loadCatalogFixture());

    expect(roleTrafficDoc.content).toContain('역할별 서버 묶음:');
    expect(roleTrafficDoc.content).toContain('대표 트래픽 경로:');
    expect(roleTrafficDoc.content).not.toContain('정적 배치 anchor');

    expect(placementOpsDoc.content).toContain('배치 요약:');
    expect(placementOpsDoc.content).toContain('정적 배치 anchor');
    expect(placementOpsDoc.content).not.toContain('역할별 서버 묶음:');
  });
});
