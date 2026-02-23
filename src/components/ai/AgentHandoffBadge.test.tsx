/**
 * @vitest-environment jsdom
 *
 * AgentHandoffBadge Component Tests
 *
 * Tests for the agent handoff badge component and utility functions.
 * Covers parsing, rendering, and accessibility.
 *
 * @version 1.0.0
 * @created 2026-01-18
 */

import { render, screen } from '@testing-library/react';
import {
  AgentHandoffBadge,
  containsHandoffMarker,
  parseHandoffMarker,
} from './AgentHandoffBadge';

// ============================================================================
// parseHandoffMarker Tests
// ============================================================================

describe('parseHandoffMarker', () => {
  it('should parse standard handoff marker', () => {
    const text = '🔄 **Orchestrator** → **NLQ Agent**: 서버 상태 조회';
    const result = parseHandoffMarker(text);

    expect(result).toEqual({
      from: 'Orchestrator',
      to: 'NLQ Agent',
      reason: '서버 상태 조회',
    });
  });

  it('should parse handoff marker without reason', () => {
    const text = '🔄 **Orchestrator** → **Analyst Agent**';
    const result = parseHandoffMarker(text);

    expect(result).toEqual({
      from: 'Orchestrator',
      to: 'Analyst Agent',
      reason: undefined,
    });
  });

  it('should parse handoff marker with extra whitespace', () => {
    const text = '🔄  **Reporter Agent**  →  **Advisor Agent** :  명령어 추천';
    const result = parseHandoffMarker(text);

    expect(result).toEqual({
      from: 'Reporter Agent',
      to: 'Advisor Agent',
      reason: '명령어 추천',
    });
  });

  it('should parse handoff marker with OpenManager Orchestrator', () => {
    const text = '🔄 **OpenManager Orchestrator** → **NLQ Agent**: CPU 분석';
    const result = parseHandoffMarker(text);

    expect(result).toEqual({
      from: 'OpenManager Orchestrator',
      to: 'NLQ Agent',
      reason: 'CPU 분석',
    });
  });

  it('should return null for invalid marker (missing emoji)', () => {
    const text = '**Orchestrator** → **NLQ Agent**';
    const result = parseHandoffMarker(text);

    expect(result).toBeNull();
  });

  it('should return null for invalid marker (missing asterisks)', () => {
    const text = '🔄 Orchestrator → NLQ Agent';
    const result = parseHandoffMarker(text);

    expect(result).toBeNull();
  });

  it('should return null for plain text', () => {
    const text = '서버 상태를 확인하고 있습니다.';
    const result = parseHandoffMarker(text);

    expect(result).toBeNull();
  });

  it('should return null for empty string', () => {
    const result = parseHandoffMarker('');
    expect(result).toBeNull();
  });

  it('should handle marker embedded in larger text', () => {
    const text =
      '분석 시작합니다. 🔄 **Orchestrator** → **Analyst Agent**: 이상 탐지 요청됨';
    const result = parseHandoffMarker(text);

    expect(result).toEqual({
      from: 'Orchestrator',
      to: 'Analyst Agent',
      reason: '이상 탐지 요청됨',
    });
  });
});

// ============================================================================
// containsHandoffMarker Tests
// ============================================================================

describe('containsHandoffMarker', () => {
  it('should return true for valid handoff marker', () => {
    const text = '🔄 **Orchestrator** → **NLQ Agent**: 서버 조회';
    expect(containsHandoffMarker(text)).toBe(true);
  });

  it('should return true for handoff marker without reason', () => {
    const text = '🔄 **Reporter Agent** → **Advisor Agent**';
    expect(containsHandoffMarker(text)).toBe(true);
  });

  it('should return false for text without marker', () => {
    const text = '서버 상태가 정상입니다.';
    expect(containsHandoffMarker(text)).toBe(false);
  });

  it('should return false for partial marker (missing arrow)', () => {
    const text = '🔄 **Orchestrator** **NLQ Agent**';
    expect(containsHandoffMarker(text)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(containsHandoffMarker('')).toBe(false);
  });

  it('should return true for marker embedded in text', () => {
    const text =
      '시작합니다.\n\n🔄 **Orchestrator** → **NLQ Agent**\n\n분석 중...';
    expect(containsHandoffMarker(text)).toBe(true);
  });
});

// ============================================================================
// AgentHandoffBadge Component Tests
// ============================================================================

describe('AgentHandoffBadge', () => {
  describe('Default Mode', () => {
    it('should render from and to agent names', () => {
      render(<AgentHandoffBadge from="Orchestrator" to="NLQ Agent" />);

      expect(screen.getByText('Orchestrator')).toBeInTheDocument();
      expect(screen.getByText('NLQ Agent')).toBeInTheDocument();
    });

    it('should render reason when provided', () => {
      render(
        <AgentHandoffBadge
          from="Orchestrator"
          to="Analyst Agent"
          reason="이상 탐지 요청"
        />
      );

      expect(screen.getByText('이상 탐지 요청')).toBeInTheDocument();
    });

    it('should not render reason colon when reason is not provided', () => {
      const { container } = render(
        <AgentHandoffBadge from="Orchestrator" to="NLQ Agent" />
      );

      // Should not have the colon separator
      expect(container.textContent).not.toContain(':');
    });

    it('should render all known agents with correct colors', () => {
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
          <AgentHandoffBadge from={agent} to="Test Agent" />
        );
        expect(screen.getByText(agent)).toBeInTheDocument();
        unmount();
      });
    });

    it('should handle unknown agent with default styling', () => {
      render(<AgentHandoffBadge from="Unknown Agent" to="Custom Agent" />);

      expect(screen.getByText('Unknown Agent')).toBeInTheDocument();
      expect(screen.getByText('Custom Agent')).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('should render in compact mode', () => {
      render(
        <AgentHandoffBadge from="Orchestrator" to="NLQ Agent" compact={true} />
      );

      // In compact mode, only 'to' agent name is shown as text
      expect(screen.getByText('NLQ Agent')).toBeInTheDocument();
    });

    it('should have smaller styling in compact mode', () => {
      const { container } = render(
        <AgentHandoffBadge from="Orchestrator" to="NLQ Agent" compact={true} />
      );

      // Compact mode uses inline-flex span
      const compactBadge = container.querySelector('span.inline-flex');
      expect(compactBadge).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have displayName set', () => {
      expect(AgentHandoffBadge.displayName).toBe('AgentHandoffBadge');
    });

    it('should render semantic HTML structure', () => {
      const { container } = render(
        <AgentHandoffBadge from="Orchestrator" to="NLQ Agent" />
      );

      // Default mode uses div container
      const outerDiv = container.querySelector('div.my-3');
      expect(outerDiv).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Integration Tests (parseHandoffMarker + Component)
// ============================================================================

describe('Integration: Parse and Render', () => {
  it('should parse and render a complete handoff flow', () => {
    const streamText =
      '🔄 **OpenManager Orchestrator** → **Reporter Agent**: 장애 보고서 생성';
    const parsed = parseHandoffMarker(streamText);

    expect(parsed).not.toBeNull();
    if (parsed) {
      render(<AgentHandoffBadge {...parsed} />);

      expect(screen.getByText('OpenManager Orchestrator')).toBeInTheDocument();
      expect(screen.getByText('Reporter Agent')).toBeInTheDocument();
      expect(screen.getByText('장애 보고서 생성')).toBeInTheDocument();
    }
  });

  it('should handle multiple handoffs in sequence', () => {
    const handoffs = [
      '🔄 **Orchestrator** → **NLQ Agent**: 서버 조회',
      '🔄 **NLQ Agent** → **Analyst Agent**: 이상 탐지',
      '🔄 **Analyst Agent** → **Reporter Agent**: 보고서 생성',
    ];

    handoffs.forEach((text, index) => {
      const parsed = parseHandoffMarker(text);
      expect(parsed).not.toBeNull();

      if (parsed) {
        const { unmount } = render(
          <AgentHandoffBadge key={index} {...parsed} />
        );
        expect(screen.getByText(parsed.from)).toBeInTheDocument();
        expect(screen.getByText(parsed.to)).toBeInTheDocument();
        unmount();
      }
    });
  });
});
