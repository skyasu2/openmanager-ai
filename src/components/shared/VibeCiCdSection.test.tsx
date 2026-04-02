/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VibeCiCdSection } from './VibeCiCdSection';

describe('VibeCiCdSection', () => {
  it('핵심 파이프라인 단계와 운영 배지를 렌더링한다', () => {
    render(<VibeCiCdSection />);

    for (const stage of [
      '로컬 훅',
      'GitLab 푸시',
      '코드 검사',
      '자동 배포',
      '실서비스',
    ]) {
      expect(screen.getAllByText(stage).length).toBeGreaterThan(0);
    }

    expect(screen.getByText('resource_group: production')).toBeInTheDocument();
    expect(screen.getByText(/wsl2-docker/i)).toBeInTheDocument();
    expect(screen.getByText(/npm run sync:github/i)).toBeInTheDocument();
  });

  it('작업 규모별 흐름 시나리오를 모두 노출한다', () => {
    render(<VibeCiCdSection />);

    expect(screen.getByText('작업 규모별 흐름 보기')).toBeInTheDocument();

    for (const label of ['작은 수정', '큰 변경', '문서만']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    expect(screen.getByText('Docker CI')).toBeInTheDocument();
    expect(screen.getByText('CI 스킵')).toBeInTheDocument();
  });
});
