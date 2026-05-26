/**
 * @vitest-environment node
 */

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  classifyWontFixReviewClass,
  classifyWontFixItem,
  groupWontFixItemsByCategory,
  groupWontFixItemsByReviewClass,
} = require('../../../scripts/qa/qa-wont-fix-classification.js');

describe('qa wont-fix classification', () => {
  it('classifies accepted wont-fix items by operational reason', () => {
    expect(
      classifyWontFixItem({
        id: 'ai-server-timing-header-production',
        title: 'Server-Timing header visibility in production',
        lastPolicyNote: '플랫폼 제약으로 인한 비차단 항목',
      }).id
    ).toBe('platform-constraint');

    expect(
      classifyWontFixItem({
        id: 'cloud-run-cold-start-latency',
        title: 'Cloud Run cold start latency',
        lastPolicyNote: 'Keep free tier deployment shape',
      }).id
    ).toBe('free-tier-tradeoff');

    expect(
      classifyWontFixItem({
        id: 'feature-dod-tsc-zero-error',
        title: 'Historical feature DoD evidence item',
        lastPolicyNote: 'Superseded by current CI gates',
      }).id
    ).toBe('historical-obsolete');

    expect(
      classifyWontFixItem({
        id: 'mobile-header-density',
        title: 'Review dashboard mobile header density',
        lastPolicyNote: '포트폴리오 운영성 우선 규칙: 비차단 항목',
      }).id
    ).toBe('portfolio-deferral');

    expect(
      classifyWontFixItem({
        id: 'obs-fp-fn-weekly-report',
        title: '오탐/미탐 주간 리포트 자동 생성',
      }).id
    ).toBe('policy-missing');
  });

  it('groups wont-fix items into stable reason sections', () => {
    const groups = groupWontFixItemsByCategory([
      {
        id: 'obs-fp-fn-weekly-report',
        title: '오탐/미탐 주간 리포트 자동 생성',
        priority: 'P1',
      },
      {
        id: 'ai-server-timing-header-production',
        title: 'Server-Timing header visibility in production',
        priority: 'P1',
        lastPolicyNote: '플랫폼 제약으로 인한 비차단 항목',
      },
      {
        id: 'mobile-header-density',
        title: 'Review dashboard mobile header density',
        priority: 'P2',
        lastPolicyNote: '포트폴리오 운영성 우선 규칙: 비차단 항목',
      },
    ]);

    expect(groups.map((group) => [group.id, group.items.length])).toEqual([
      ['policy-missing', 1],
      ['platform-constraint', 1],
      ['portfolio-deferral', 1],
    ]);
  });

  it('classifies accepted wont-fix items by review action', () => {
    expect(
      classifyWontFixReviewClass({
        id: 'server-comparison-deterministic-path',
        title: '서버 1:1 비교 쿼리 deterministic 경로 미확립',
        lastPolicyNote: '포트폴리오 운영성 우선 규칙: 비차단 항목',
      }).id
    ).toBe('verify-before-promotion');

    expect(
      classifyWontFixReviewClass({
        id: 'q-new10-pronoun-resolution',
        title: '팔로업 대명사 해석 미완',
        lastPolicyNote: '포트폴리오 운영성 우선 규칙: 비차단 항목',
      }).id
    ).toBe('future-product-expansion');

    expect(
      classifyWontFixReviewClass({
        id: 'numbered-list-accordion-split',
        title: '번호 목록이 핵심 요약/상세 분석 아코디언 경계에서 분리됨',
        lastPolicyNote: '포트폴리오 운영성 우선 규칙: 비차단 항목',
      }).id
    ).toBe('low-priority-polish');
  });

  it('groups wont-fix items into review classes', () => {
    const groups = groupWontFixItemsByReviewClass([
      {
        id: 'server-comparison-deterministic-path',
        title: '서버 1:1 비교 쿼리 deterministic 경로 미확립',
        priority: 'P1',
        lastPolicyNote: '포트폴리오 운영성 우선 규칙: 비차단 항목',
      },
      {
        id: 'vision-ui-upload-e2e',
        title: 'Authenticated frontend image-upload UI E2E path',
        priority: 'P3',
        lastPolicyNote: '포트폴리오 운영성 우선 규칙: 비차단 항목',
      },
      {
        id: 'mobile-header-density',
        title: 'Review dashboard mobile header density',
        priority: 'P2',
        lastPolicyNote: '포트폴리오 운영성 우선 규칙: 비차단 항목',
      },
    ]);

    expect(groups.map((group) => [group.id, group.items.length])).toEqual([
      ['verify-before-promotion', 1],
      ['future-product-expansion', 1],
      ['low-priority-polish', 1],
    ]);
  });
});
