import { describe, expect, it } from 'vitest';

import {
  getExpiredLegacyContracts,
  LEGACY_CONTRACTS,
} from './legacy-contracts';

describe('legacy compatibility contracts', () => {
  it('does not keep the removed useGraphRAG compatibility contract in the active registry', () => {
    expect(Object.values(LEGACY_CONTRACTS).map((contract) => contract.id)).not.toContain(
      'searchKnowledgeBase.useGraphRAG'
    );
  });

  it('reports expired legacy contracts from a controlled date', () => {
    expect(getExpiredLegacyContracts(new Date('2026-04-26T00:00:00Z'))).toEqual(
      []
    );
    expect(
      getExpiredLegacyContracts(new Date('2026-06-01T00:00:00Z')).map(
        (contract) => contract.id
      )
    ).toEqual([]);
  });
});
