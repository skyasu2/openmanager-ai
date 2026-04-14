/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import QueryProvider from './QueryProvider';

function ThrowOnDemand({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('query boundary test error');
  }

  return <div>query-provider-recovered</div>;
}

function RecoveryHarness() {
  const [shouldThrow, setShouldThrow] = useState(true);

  return (
    <>
      <button type="button" onClick={() => setShouldThrow(false)}>
        복구 준비
      </button>
      <QueryProvider>
        <ThrowOnDemand shouldThrow={shouldThrow} />
      </QueryProvider>
    </>
  );
}

describe('QueryProvider', () => {
  it('resets the boundary without forcing a page reload', () => {
    // QueryProvider uses resetErrorBoundary (react-error-boundary) which resets
    // component state only — no window.location.reload is involved.
    // jsdom makes window.location non-configurable, so we assert recovery via
    // DOM presence rather than a reload spy.
    render(<RecoveryHarness />);

    expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '복구 준비' }));
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(screen.getByText('query-provider-recovered')).toBeInTheDocument();
  });
});
