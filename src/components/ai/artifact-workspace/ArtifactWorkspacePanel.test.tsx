/** @vitest-environment jsdom */

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtifactWorkspacePanel } from '@/components/ai/artifact-workspace/ArtifactWorkspacePanel';
import {
  createArtifactReplayPack,
  MONITORING_ARTIFACT_DOMAIN_ID,
} from '@/lib/ai/chat-artifacts/artifact-workspace-registry';
import {
  ARTIFACT_WORKSPACE_STORAGE_KEY,
  createArtifactWorkspaceStore,
} from '@/lib/ai/chat-artifacts/artifact-workspace-store';
import {
  createArtifactEnvelope,
  type ServerSnapshotArtifact,
} from '@/lib/ai/chat-artifacts/types';

const snapshotArtifact: ServerSnapshotArtifact = {
  kind: 'server-snapshot',
  generatedAt: '2026-05-06T01:00:00.000Z',
  title: '현재 서버 상태 스냅샷',
  summary: '4대 서버 중 위험 1대입니다.',
  source: 'otel-static',
  slot: {
    slotIndex: 42,
    minuteOfDay: 420,
    timeLabel: '07:00 KST',
  },
  totals: {
    total: 4,
    online: 2,
    warning: 1,
    critical: 1,
    offline: 0,
  },
  averages: {
    cpu: 60,
    memory: 67.8,
    disk: 56.8,
    network: 35,
  },
  topServers: [],
  alerts: [],
};

function createSnapshotPack(
  workspaceId: string,
  summary = snapshotArtifact.summary
) {
  return createArtifactReplayPack({
    workspaceId,
    createdAt: `2026-05-06T01:0${workspaceId.endsWith('b') ? '2' : '1'}:00.000Z`,
    envelopes: [
      createArtifactEnvelope(
        {
          ...snapshotArtifact,
          summary,
        },
        {
          domainId: MONITORING_ARTIFACT_DOMAIN_ID,
          sourceMode: 'otel-static',
          dataSlot: '07:00 KST',
        }
      ),
    ],
  });
}

describe('ArtifactWorkspacePanel', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders an empty local-only workspace state without network calls', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(
      <ArtifactWorkspacePanel
        messages={[]}
        store={createArtifactWorkspaceStore()}
        workspaceId="workspace-empty"
      />
    );

    expect(screen.getByText('아티팩트 워크스페이스')).toBeInTheDocument();
    expect(screen.getByLabelText('replay pack 설명')).toHaveAttribute(
      'title',
      '대화 이력과 분석 결과를 저장·불러오는 스냅샷'
    );
    expect(screen.getByText('저장된 replay pack 없음')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '현재 대화 저장' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: '비교' })).toBeDisabled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('saves current chat artifacts into session storage and lists the replay pack', async () => {
    const store = createArtifactWorkspaceStore();

    render(
      <ArtifactWorkspacePanel
        messages={[
          {
            metadata: {
              artifactEnvelopes: [
                createArtifactEnvelope(snapshotArtifact, {
                  domainId: MONITORING_ARTIFACT_DOMAIN_ID,
                  sourceMode: 'otel-static',
                  dataSlot: '07:00 KST',
                }),
              ],
            },
          },
        ]}
        store={store}
        workspaceId="workspace-current"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '현재 대화 저장' }));

    await screen.findByText('workspace-current');
    expect(sessionStorage.getItem(ARTIFACT_WORKSPACE_STORAGE_KEY)).toContain(
      'workspace-current'
    );
    expect(localStorage.getItem(ARTIFACT_WORKSPACE_STORAGE_KEY)).toBeNull();
  });

  it('imports invalid JSON as a visible error without mutating stored packs', async () => {
    render(
      <ArtifactWorkspacePanel
        messages={[]}
        store={createArtifactWorkspaceStore()}
        workspaceId="workspace-import"
      />
    );

    const fileInput = screen.getByLabelText('replay pack JSON 가져오기');
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(['{not-json'], 'broken.json', { type: 'application/json' }),
        ],
      },
    });

    await screen.findByText('잘못된 JSON 파일입니다.');
    expect(screen.getByText('저장된 replay pack 없음')).toBeInTheDocument();
  });

  it('keeps the native file input out of the page scroll flow', () => {
    render(
      <ArtifactWorkspacePanel
        messages={[]}
        store={createArtifactWorkspaceStore()}
        workspaceId="workspace-import-layout"
      />
    );

    const fileInput = screen.getByTestId('artifact-replay-pack-file-input');
    expect(fileInput).toHaveClass('hidden');
    expect(fileInput).not.toHaveClass('sr-only');
  });

  it('compares two selected replay packs and rejects selecting the same pack twice', async () => {
    const store = createArtifactWorkspaceStore();
    store.saveReplayPack(createSnapshotPack('workspace-a'));
    store.saveReplayPack(
      createSnapshotPack('workspace-b', '4대 서버 중 위험 2대입니다.')
    );

    render(
      <ArtifactWorkspacePanel
        messages={[]}
        store={store}
        workspaceId="workspace-compare"
      />
    );

    const leftSelect = screen.getByLabelText('기준 replay pack');
    const rightSelect = screen.getByLabelText('비교 replay pack');

    fireEvent.change(leftSelect, { target: { value: 'workspace-a' } });
    fireEvent.change(rightSelect, { target: { value: 'workspace-a' } });
    fireEvent.click(screen.getByRole('button', { name: '비교' }));

    await screen.findByText('서로 다른 replay pack을 선택하세요.');

    fireEvent.change(rightSelect, { target: { value: 'workspace-b' } });
    fireEvent.click(screen.getByRole('button', { name: '비교' }));

    await waitFor(() => {
      expect(screen.getByText('changed 1')).toBeInTheDocument();
    });
    expect(screen.getByText('matched 0')).toBeInTheDocument();
    expect(screen.getByText('missing 0')).toBeInTheDocument();
    expect(screen.getByText('added 0')).toBeInTheDocument();
    const details = screen.getByLabelText('replay pack 비교 상세');
    expect(
      within(details).getByText('server-snapshot (2026-05-06 10:00 KST)')
    ).toBeInTheDocument();
    expect(within(details).getByText('changed')).toBeInTheDocument();
  });
});
