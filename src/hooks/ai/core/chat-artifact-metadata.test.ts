import { describe, expect, it } from 'vitest';
import type { ChatArtifact } from '@/lib/ai/chat-artifacts/types';
import * as artifactMetadata from './chat-artifact-metadata';
import {
  createArtifactGuidanceMessages,
  getArtifactLoadingText,
} from './chat-artifact-metadata';

type ArtifactStepMessage = {
  delayMs: number;
  text: string;
};

type ArtifactMetadataExports = typeof artifactMetadata & {
  getArtifactStepMessages?: (
    kind: ChatArtifact['kind']
  ) => ArtifactStepMessage[];
};

describe('createArtifactGuidanceMessages', () => {
  it('adds monitoring-analysis CTA metadata to guidance assistant messages', () => {
    const [, assistantMessage] = createArtifactGuidanceMessages({
      query: '추세 분석 기능 설명해줘',
      target: 'monitoring-analysis',
      reason: 'monitoring_guidance_pattern',
    });

    expect(assistantMessage.metadata).toMatchObject({
      type: 'guidance',
      artifactIntentReason: 'monitoring_guidance_pattern',
      artifactIntentTarget: 'monitoring-analysis',
      guidanceCta: {
        target: 'monitoring-analysis',
        label: '바로 이상감지/추세 분석 실행하기',
      },
    });
  });

  it('adds incident-report CTA metadata to guidance assistant messages', () => {
    const [, assistantMessage] = createArtifactGuidanceMessages({
      query: '장애 보고서 작성 방법 알려줘',
      target: 'incident-report',
      reason: 'incident_report_guidance_pattern',
    });

    expect(assistantMessage.metadata).toMatchObject({
      type: 'guidance',
      artifactIntentReason: 'incident_report_guidance_pattern',
      artifactIntentTarget: 'incident-report',
      guidanceCta: {
        target: 'incident-report',
        label: '바로 장애 보고서 생성하기',
      },
    });
  });
});

describe('getArtifactStepMessages', () => {
  const getArtifactStepMessages = (artifactMetadata as ArtifactMetadataExports)
    .getArtifactStepMessages;

  it('exports ordered incident-report progress steps', () => {
    expect(getArtifactStepMessages).toBeTypeOf('function');

    expect(getArtifactStepMessages?.('incident-report')).toEqual([
      { delayMs: 0, text: getArtifactLoadingText('incident-report') },
      { delayMs: 3000, text: '장애 데이터를 수집하고 있습니다...' },
      { delayMs: 6000, text: '보고서를 작성하고 있습니다...' },
      { delayMs: 9000, text: '거의 완료됐습니다...' },
    ]);
  });

  it('exports ordered monitoring-analysis progress steps', () => {
    expect(getArtifactStepMessages).toBeTypeOf('function');

    expect(getArtifactStepMessages?.('monitoring-analysis')).toEqual([
      { delayMs: 0, text: getArtifactLoadingText('monitoring-analysis') },
      { delayMs: 3000, text: '데이터를 수집하고 있습니다...' },
      { delayMs: 6000, text: '분석 결과를 정리하고 있습니다...' },
      { delayMs: 9000, text: '거의 완료됐습니다...' },
    ]);
  });
});
