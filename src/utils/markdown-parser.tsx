'use client';

import React from 'react';
import { CodeExecutionBlock } from '@/components/ai/CodeExecutionBlock';

export interface ContentBlock {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

/**
 * Parse markdown content into text and code blocks
 */
export function parseMarkdownContent(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim();
      if (textContent) {
        blocks.push({
          type: 'text',
          content: textContent,
        });
      }
    }

    // Add code block
    const language = match[1] || 'text';
    const code = (match[2] || '').trim();

    blocks.push({
      type: 'code',
      content: code,
      language,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last code block
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim();
    if (textContent) {
      blocks.push({
        type: 'text',
        content: textContent,
      });
    }
  }

  // If no code blocks found, return entire content as text
  if (blocks.length === 0 && content.trim()) {
    blocks.push({
      type: 'text',
      content: content.trim(),
    });
  }

  return blocks;
}

/**
 * Check if content contains executable Python code
 */
export function hasExecutableCode(content: string): boolean {
  const pythonCodeRegex = /```(?:python|py)\n[\s\S]*?```/i;
  return pythonCodeRegex.test(content);
}

export interface RenderMarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Render markdown content with executable code blocks
 */
export function RenderMarkdownContent({
  content,
  className = '',
}: RenderMarkdownContentProps): React.ReactNode {
  const blocks = parseMarkdownContent(content);

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          const isPython =
            block.language?.toLowerCase() === 'python' ||
            block.language?.toLowerCase() === 'py';

          return (
            <CodeExecutionBlock
              key={index}
              code={block.content}
              language={block.language || 'text'}
              showRunButton={isPython}
            />
          );
        }

        // Render text content with basic formatting
        return (
          <div
            key={index}
            className="whitespace-pre-wrap break-words text-chat leading-relaxed"
          >
            {renderFormattedText(block.content)}
          </div>
        );
      })}
    </div>
  );
}

const SAFE_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:'];

function isSafeMarkdownLink(url: string): boolean {
  const trimmedUrl = url.trim();

  if (
    trimmedUrl.startsWith('/') ||
    trimmedUrl.startsWith('./') ||
    trimmedUrl.startsWith('../') ||
    trimmedUrl.startsWith('#')
  ) {
    return true;
  }

  // Disallow dangerous protocols like javascript:, data:, vbscript:
  const isProtocolUrl = /^[a-z][a-z0-9+.-]*:/i.test(trimmedUrl);
  if (isProtocolUrl) {
    try {
      const parsed = new URL(trimmedUrl);
      return SAFE_LINK_PROTOCOLS.includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  // allow bare URLs and paths by treating them as relative/host-relative values
  return trimmedUrl.length > 0;
}

/**
 * 간단한 마크다운 링크 패턴을 파싱하여 React 요소로 변환합니다.
 * 형식: [텍스트](URL) -> <a href="URL">텍스트</a>
 */
export function parseMarkdownLinks(text: string): React.ReactNode[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    const [fullMatch, linkText, rawUrl] = match;
    const safeRawUrl = rawUrl ?? '';
    const startIndex = match.index;
    const href = safeRawUrl.trim();

    if (startIndex > lastIndex) {
      parts.push(text.substring(lastIndex, startIndex));
    }

    if (isSafeMarkdownLink(href)) {
      parts.push(
        <a
          key={`link-${startIndex}-${linkText}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-400 hover:text-blue-300 underline decoration-blue-500/30 hover:decoration-blue-400 underline-offset-2 transition-colors"
        >
          {linkText}
        </a>
      );
    } else {
      parts.push(fullMatch);
    }

    lastIndex = startIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Render text with basic inline formatting (bold, italic, inline code)
 */
function renderFormattedText(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/g);
  const renderBoldText = (value: string, keyPrefix: string) => {
    let processed: React.ReactNode = value;

    const boldParts = value.split(/(\*\*[^*]+\*\*)/g);
    if (boldParts.length > 1) {
      processed = boldParts.map((bp, i) => {
        if (bp.startsWith('**') && bp.endsWith('**')) {
          return (
            <strong key={`${keyPrefix}-bold-${i}`} className="font-semibold">
              {bp.slice(2, -2)}
            </strong>
          );
        }
        return <span key={`${keyPrefix}-plain-${i}`}>{bp}</span>;
      });
    }

    return <span key={keyPrefix}>{processed}</span>;
  };

  const renderTextWithLinks = (value: string, keyPrefix: string) => {
    const linkParts = parseMarkdownLinks(value);

    return linkParts.map((linkPart, i) => {
      if (typeof linkPart === 'string') {
        return renderBoldText(linkPart, `${keyPrefix}-text-${i}`);
      }

      return (
        <React.Fragment key={`${keyPrefix}-link-${i}`}>
          {linkPart}
        </React.Fragment>
      );
    });
  };

  return parts.map((part, index) => {
    // Inline code
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-pink-600 dark:bg-gray-800 dark:text-pink-400"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return (
      <React.Fragment key={index}>
        {renderTextWithLinks(part, `text-${index}`)}
      </React.Fragment>
    );
  });
}

export default RenderMarkdownContent;
