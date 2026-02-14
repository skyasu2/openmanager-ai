# Testing Documentation

> Owner: documentation
> Status: Archived
> Doc type: Reference
> Last reviewed: 2026-02-14
> Canonical: docs/guides/testing/test-strategy.md
> Tags: testing,guides,archived

## Available Docs

- [Test Strategy](../../../guides/testing/test-strategy.md)
- [E2E Testing Guide](../../../guides/testing/e2e-testing-guide.md)

## Test Locations

```text
src/      # unit/component tests (co-located)
tests/    # api/integration/e2e test suites
```

## Common Commands

```bash
npm run test
npm run test:quick
npm run test:coverage
npm run test:e2e
npm run test:e2e:critical
```

## Notes

- 이 디렉토리에는 현재 2개의 기준 문서만 유지합니다.
- 과거 세부 가이드는 통합되어 제거되었거나 다른 문서로 흡수되었습니다.

## Related

- [Development Guide](../../../development/README.md)
- [Docs Home](../../../README.md)
