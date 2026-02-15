/**
 * AgentStatusIndicator Component Tests
 *
 * Tests for the agent status indicator component and utility functions.
 *
 * @version 1.0.0
 * @created 2026-01-18
 */

import { render, screen } from '@testing-library/react';
import {
  type AgentStatus,
  AgentStatusIndicator,
  parseAgentStatus,
} from './AgentStatusIndicator';

// ============================================================================
// parseAgentStatus Tests
// ============================================================================

describe('parseAgentStatus', () => {
  it('should parse valid agent_status data', () => {
    const data = { agent: 'NLQ Agent', status: 'thinking' };
    const result = parseAgentStatus(data);

    expect(result).toEqual({
      agent: 'NLQ Agent',
      status: 'thinking',
    });
  });

  it('should parse processing status', () => {
    const data = { agent: 'Analyst Agent', status: 'processing' };
    const result = parseAgentStatus(data);

    expect(result).toEqual({
      agent: 'Analyst Agent',
      status: 'processing',
    });
  });

  it('should parse completed status', () => {
    const data = { agent: 'Reporter Agent', status: 'completed' };
    const result = parseAgentStatus(data);

    expect(result).toEqual({
      agent: 'Reporter Agent',
      status: 'completed',
    });
  });

  it('should parse idle status', () => {
    const data = { agent: 'Advisor Agent', status: 'idle' };
    const result = parseAgentStatus(data);

    expect(result).toEqual({
      agent: 'Advisor Agent',
      status: 'idle',
    });
  });

  it('should return null for invalid status', () => {
    const data = { agent: 'NLQ Agent', status: 'unknown' };
    const result = parseAgentStatus(data);

    expect(result).toBeNull();
  });

  it('should return null for missing agent', () => {
    const data = { status: 'thinking' };
    const result = parseAgentStatus(data);

    expect(result).toBeNull();
  });

  it('should return null for null input', () => {
    const result = parseAgentStatus(null);
    expect(result).toBeNull();
  });

  it('should return null for non-object input', () => {
    const result = parseAgentStatus('invalid');
    expect(result).toBeNull();
  });
});

// ============================================================================
// AgentStatusIndicator Component Tests
// ============================================================================

describe('AgentStatusIndicator', () => {
  describe('Default Mode', () => {
    it('should render agent name and thinking status', () => {
      render(<AgentStatusIndicator agent="NLQ Agent" status="thinking" />);

      expect(screen.getByText('NLQ Agent')).toBeInTheDocument();
      expect(screen.getByText('• 분석 중...')).toBeInTheDocument();
    });

    it('should render processing status', () => {
      render(
        <AgentStatusIndicator agent="Analyst Agent" status="processing" />
      );

      expect(screen.getByText('Analyst Agent')).toBeInTheDocument();
      expect(screen.getByText('• 처리 중...')).toBeInTheDocument();
    });

    it('should render completed status', () => {
      render(
        <AgentStatusIndicator agent="Reporter Agent" status="completed" />
      );

      expect(screen.getByText('Reporter Agent')).toBeInTheDocument();
      expect(screen.getByText('• 완료')).toBeInTheDocument();
    });

    it('should render idle status', () => {
      render(<AgentStatusIndicator agent="Advisor Agent" status="idle" />);

      expect(screen.getByText('Advisor Agent')).toBeInTheDocument();
      expect(screen.getByText('• 대기')).toBeInTheDocument();
    });

    it('should render all known agents', () => {
      const agents = [
        'Orchestrator',
        'OpenManager Orchestrator',
        'NLQ Agent',
        'Analyst Agent',
        'Reporter Agent',
        'Advisor Agent',
      ];

      agents.forEach((agent) => {
        const { unmount } = render(
          <AgentStatusIndicator agent={agent} status="thinking" />
        );
        expect(screen.getByText(agent)).toBeInTheDocument();
        unmount();
      });
    });

    it('should handle unknown agent with default icon', () => {
      render(<AgentStatusIndicator agent="Custom Agent" status="processing" />);
      expect(screen.getByText('Custom Agent')).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('should render in compact mode', () => {
      render(
        <AgentStatusIndicator agent="NLQ Agent" status="thinking" compact />
      );

      expect(screen.getByText('NLQ Agent')).toBeInTheDocument();
    });

    it('should have smaller styling in compact mode', () => {
      const { container } = render(
        <AgentStatusIndicator agent="NLQ Agent" status="processing" compact />
      );

      const compactBadge = container.querySelector('div.inline-flex');
      expect(compactBadge).toBeInTheDocument();
    });
  });

  describe('Status Animations', () => {
    it('should have pulse animation for thinking status', () => {
      const { container } = render(
        <AgentStatusIndicator agent="NLQ Agent" status="thinking" />
      );

      const animatedDiv = container.querySelector('.animate-pulse');
      expect(animatedDiv).toBeInTheDocument();
    });

    it('should not have pulse animation for completed status', () => {
      const { container } = render(
        <AgentStatusIndicator agent="NLQ Agent" status="completed" />
      );

      const animatedDiv = container.querySelector('.animate-pulse');
      expect(animatedDiv).not.toBeInTheDocument();
    });

    it('should render thinking status in compact mode', () => {
      render(
        <AgentStatusIndicator agent="NLQ Agent" status="thinking" compact />
      );

      // compact 모드에서도 에이전트 이름이 표시됨
      expect(screen.getByText('NLQ Agent')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have displayName set', () => {
      expect(AgentStatusIndicator.displayName).toBe('AgentStatusIndicator');
    });
  });
});

// ============================================================================
// Status Transition Tests
// ============================================================================

describe('Status Transitions', () => {
  it('should render different statuses correctly', () => {
    const statuses: AgentStatus[] = [
      'thinking',
      'processing',
      'completed',
      'idle',
    ];

    statuses.forEach((status) => {
      const { unmount } = render(
        <AgentStatusIndicator agent="Test Agent" status={status} />
      );

      expect(screen.getByText('Test Agent')).toBeInTheDocument();
      unmount();
    });
  });
});
