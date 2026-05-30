'use client';

import type React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeExecutionBlock } from '@/components/ai/CodeExecutionBlock';

export interface ContentBlock {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

/**
 * Parse markdown content into text and code blocks
 *
 * 순수 유틸리티입니다. 코드 블록 텍스트/언어 추출이 필요한 호출부에서 재사용할 수 있도록
 * 유지합니다. UI 렌더링은 `RenderMarkdownContent`(react-markdown)를 사용하세요.
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
 *
 * 순수 유틸리티입니다. 인라인 링크만 필요한 호출부에서 재사용할 수 있도록 유지합니다.
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
 * AI Engine 응답의 평탄화된(블록 토큰을 한 줄에 몰아쓴) 마크다운을 CommonMark 가
 * 인식할 수 있는 형태로 정규화합니다.
 *
 * AI Engine 의 합성/스트리밍 경로가 종종 `... 분석 --- ### 현황 요약` 처럼
 * 수평선(`---`)과 헤딩(`###`)을 줄바꿈 없이 인라인으로 내보내면, CommonMark 규칙상
 * 라인 중간의 `---`/`###` 는 블록 요소가 아니라 일반 텍스트로 렌더되어 마크업이
 * 그대로 노출됩니다. 아래 보정으로 해당 토큰을 독립 라인으로 분리합니다.
 *
 * 테이블 구분자(`|---|`)·이미 줄바꿈된 수평선은 건드리지 않도록 공백으로 둘러싸인
 * 경우만 처리합니다.
 */
export function normalizeAssistantMarkdown(content: string): string {
  if (typeof content !== 'string' || content.length === 0) {
    return '';
  }

  return (
    content
      // 1) 인라인 수평선: "텍스트 --- 텍스트" → 독립 블록으로 분리
      .replace(/([^\n|`-])[ \t]+(-{3,})[ \t]+(?=\S)/g, '$1\n\n$2\n\n')
      // 2) 공백 없이 붙은 compact 헤딩 앞 줄바꿈: "텍스트##제목"
      .replace(/([^#\n\s])(#{2,6})(?=[^\s#])/g, '$1\n\n$2')
      // 3) 줄 중간에 공백을 둔 헤딩 앞 줄바꿈: "텍스트 ## 제목"
      .replace(/([^\n])[ \t]+(#{2,6}[ \t])/g, '$1\n\n$2')
      // 4) 라인 시작 compact 헤딩 공백 보정: "##제목" → "## 제목"
      .replace(/(^|\n)(#{1,6})([^\s#])/g, '$1$2 $3')
  );
}

export interface RenderMarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * react-markdown 컴포넌트 매핑.
 * - 코드 블록은 `CodeExecutionBlock` 으로 위임하여 Python 실행 기능을 유지합니다.
 * - 헤딩/리스트/수평선 등은 AI 사이드바 라이트 테마에 맞춘 스타일을 적용합니다.
 */
const markdownComponents: Components = {
  // CodeExecutionBlock 이 자체 컨테이너를 포함하므로 <pre> 중첩을 제거합니다.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children, node }) => {
    const isInline =
      !node?.position || node.position.start.line === node.position.end.line;

    if (isInline) {
      return (
        <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-pink-600 dark:bg-gray-800 dark:text-pink-400">
          {children}
        </code>
      );
    }

    const match = /language-(\w+)/.exec(className || '');
    const language = match?.[1] || 'text';
    const codeText = String(children).replace(/\n$/, '');
    const isPython =
      language.toLowerCase() === 'python' || language.toLowerCase() === 'py';

    return (
      <CodeExecutionBlock
        code={codeText}
        language={language}
        showRunButton={isPython}
      />
    );
  },
  a: ({ href, children }) => (
    <a
      href={href ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-blue-400 hover:text-blue-300 underline decoration-blue-500/30 hover:decoration-blue-400 underline-offset-2 transition-colors"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => (
    <h1 className="mt-3 mb-1 text-base font-bold text-slate-800">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-2 mb-1 text-sm font-bold text-slate-700">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-1.5 mb-0.5 text-sm font-semibold text-slate-600">
      {children}
    </h3>
  ),
  ul: ({ children }) => (
    <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-chat leading-relaxed">{children}</li>
  ),
  hr: () => <hr className="my-2 border-slate-200" />,
  p: ({ children }) => (
    <p className="my-1 text-chat leading-relaxed break-words">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-slate-300 pl-3 text-slate-600 italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-slate-200 px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-slate-200 px-2 py-1">{children}</td>
  ),
};

/**
 * Render markdown content with full CommonMark + GFM support.
 *
 * 기존 라인 단위 커스텀 렌더러를 react-markdown 으로 교체했습니다.
 * AI Engine 의 평탄화된 마크다운은 `normalizeAssistantMarkdown` 으로 보정한 뒤
 * 렌더링하여 수평선/헤딩/코드펜스가 일관되게 표시됩니다.
 */
export function RenderMarkdownContent({
  content,
  className = '',
}: RenderMarkdownContentProps): React.ReactNode {
  const normalized = normalizeAssistantMarkdown(content);

  return (
    <div className={`text-chat leading-relaxed wrap-break-word ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
