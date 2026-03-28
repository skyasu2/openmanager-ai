/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VIBE_CODING_DATA } from '@/data/tech-stacks/vibe-coding';
import { VibeHistorySection } from './VibeHistorySection';

const history = VIBE_CODING_DATA.history;

describe('VibeHistorySection', () => {
  it('stageMeta 기반으로 각 단계 제목을 표시한다', () => {
    render(<VibeHistorySection historyStages={history} />);

    expect(
      screen.getByText(history.stageMeta.stage1.title)
    ).toBeInTheDocument();
    expect(
      screen.getByText(history.stageMeta.stage2.title)
    ).toBeInTheDocument();
    expect(
      screen.getByText(history.stageMeta.stage3.title)
    ).toBeInTheDocument();
    expect(
      screen.getByText(history.stageMeta.stage4.title)
    ).toBeInTheDocument();
  });

  it('stageMeta 기반으로 각 단계 설명을 표시한다', () => {
    render(<VibeHistorySection historyStages={history} />);

    expect(
      screen.getByText(history.stageMeta.stage1.description)
    ).toBeInTheDocument();
    expect(
      screen.getByText(history.stageMeta.stage2.description)
    ).toBeInTheDocument();
    expect(
      screen.getByText(history.stageMeta.stage3.description)
    ).toBeInTheDocument();
    expect(
      screen.getByText(history.stageMeta.stage4.description)
    ).toBeInTheDocument();
  });

  it('stage1 링크가 있으면 외부 링크 버튼을 렌더링한다', () => {
    render(<VibeHistorySection historyStages={history} />);

    const link = screen.getByRole('link', {
      name: /v2 버전 확인하기/i,
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('stage2/3/4에는 외부 링크가 없다', () => {
    render(<VibeHistorySection historyStages={history} />);

    // stage1 링크만 1개
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
  });

  it('각 단계의 도구 수를 배지로 표시한다', () => {
    render(<VibeHistorySection historyStages={history} />);

    // stage1 개수 배지 확인 (stage4와 같은 개수일 수 있으므로 getAllByText 사용)
    const stage1Badge = `${history.stage1.length}개 도구`;
    expect(screen.getAllByText(stage1Badge).length).toBeGreaterThanOrEqual(1);

    // stage2/3/4 개수가 같을 수 있으므로 해당 텍스트가 최소 1개 이상 존재하는지 확인
    const stage2Badge = `${history.stage2.length}개 도구`;
    expect(screen.getAllByText(stage2Badge).length).toBeGreaterThanOrEqual(1);

    const stage3Badge = `${history.stage3.length}개 도구`;
    expect(screen.getAllByText(stage3Badge).length).toBeGreaterThanOrEqual(1);

    const stage4Badge = `${history.stage4.length}개 도구`;
    expect(screen.getAllByText(stage4Badge).length).toBeGreaterThanOrEqual(1);
  });

  it('historyStages가 null/undefined이면 아무것도 렌더링하지 않는다', () => {
    // @ts-expect-error intentional null test
    const { container } = render(<VibeHistorySection historyStages={null} />);
    expect(container.firstChild).toBeNull();
  });
});
