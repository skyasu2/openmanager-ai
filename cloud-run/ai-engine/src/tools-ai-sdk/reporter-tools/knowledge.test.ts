import { describe, expect, it } from 'vitest';
import {
  isCommandIntentQuery,
  mapSeverityFilter,
  rebalanceRagResultsForMonitoring,
  type RAGResultItem,
} from './knowledge';

describe('knowledge helpers', () => {
  it('maps tool severity to knowledge base severity', () => {
    expect(mapSeverityFilter('critical')).toBe('critical');
    expect(mapSeverityFilter('high')).toBe('warning');
    expect(mapSeverityFilter('warning')).toBe('warning');
    expect(mapSeverityFilter('low')).toBe('info');
    expect(mapSeverityFilter(undefined)).toBeUndefined();
  });

  it('detects command-intent query', () => {
    expect(isCommandIntentQuery('docker logs 보는 명령어 알려줘')).toBe(true);
    expect(isCommandIntentQuery('최근 장애 원인 분석해줘')).toBe(false);
    expect(isCommandIntentQuery('아무 질문', 'command')).toBe(true);
  });

  it('rebalances non-command query by limiting command-heavy results and deduplicating title', () => {
    const input: RAGResultItem[] = [
      {
        id: 'a',
        title: 'CPU 경보 대응',
        content: 'incident',
        category: 'incident',
        similarity: 0.92,
        sourceType: 'vector',
        hopDistance: 0,
      },
      {
        id: 'b',
        title: 'netstat',
        content: 'linux',
        category: 'command',
        similarity: 0.9,
        sourceType: 'vector',
        hopDistance: 0,
      },
      {
        id: 'c',
        title: 'netstat',
        content: 'windows',
        category: 'command',
        similarity: 0.88,
        sourceType: 'graph',
        hopDistance: 1,
      },
      {
        id: 'd',
        title: '메모리 누수 점검',
        content: 'troubleshooting',
        category: 'troubleshooting',
        similarity: 0.87,
        sourceType: 'vector',
        hopDistance: 0,
      },
    ];

    const output = rebalanceRagResultsForMonitoring(input, '최근 장애 원인 분석해줘');

    expect(output.filter((r) => r.category === 'command')).toHaveLength(1);
    expect(output.filter((r) => r.title.toLowerCase() === 'netstat')).toHaveLength(1);
    expect(output.length).toBe(3);
  });

  it('filters destructive command docs unless cleanup intent exists', () => {
    const input: RAGResultItem[] = [
      {
        id: 'cmd-1',
        title: 'docker system prune',
        content: 'dangerous cleanup',
        category: 'command',
        similarity: 0.99,
        sourceType: 'vector',
        hopDistance: 0,
      },
      {
        id: 'inc-1',
        title: '메모리 누수 대응',
        content: 'incident runbook',
        category: 'incident',
        similarity: 0.8,
        sourceType: 'vector',
        hopDistance: 0,
      },
    ];

    const normalAnalysis = rebalanceRagResultsForMonitoring(input, '장애 원인 분석');
    expect(normalAnalysis.some((r) => r.title === 'docker system prune')).toBe(false);

    const cleanupIntent = rebalanceRagResultsForMonitoring(input, '디스크 용량 정리 명령어 알려줘');
    expect(cleanupIntent.some((r) => r.title === 'docker system prune')).toBe(true);
  });
});
