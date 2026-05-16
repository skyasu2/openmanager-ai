/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlobContent } from './download-utils';

describe('downloadBlobContent', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('downloads UTF-8 blob content and revokes the object URL', () => {
    const createObjectURL = vi.fn(() => 'blob:artifact-download');
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    downloadBlobContent('# report', 'report.md', 'text/markdown');

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe('text/markdown;charset=utf-8');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:artifact-download');
    expect(document.body.querySelector('a')).toBeNull();
  });
});
