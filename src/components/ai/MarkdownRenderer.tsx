'use client';

import { Check, Copy } from 'lucide-react';
import { memo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import {
  AgentHandoffBadge,
  containsHandoffMarker,
  parseHandoffMarker,
} from './AgentHandoffBadge';

// Highlight.js 스타일 import (Dark Theme)
import 'highlight.js/styles/github-dark.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * 코드 블록 컴포넌트 (복사 기능 포함)
 */
const CodeBlock = memo(function CodeBlock({
  inline,
  className,
  children,
}: {
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  // rehype-highlight 적용 시 children이 객체 트리일 수 있으므로,
  // ref를 통해 실제 텍스트를 추출합니다.
  const handleCopy = async () => {
    const textToCopy = codeRef.current?.innerText || '';
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 API 실패 시 (권한 거부, HTTPS 미사용 등)
      // 조용히 실패 처리 - 사용자 경험 방해 최소화
      setCopied(false);
    }
  };

  // 인라인 코드
  if (inline) {
    return (
      <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono text-pink-600">
        {children}
      </code>
    );
  }

  // 코드 블록
  return (
    <div className="group relative my-3 rounded-lg border border-gray-200 bg-gray-900 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2 text-xs">
        <span className="text-gray-400 font-mono">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          title="코드 복사"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-400" />
              <span className="text-green-400">복사됨</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>복사</span>
            </>
          )}
        </button>
      </div>
      {/* 코드 내용 */}
      <pre className="overflow-x-auto p-4 text-sm">
        <code
          ref={codeRef}
          className={`${className || ''} text-gray-100 font-mono leading-relaxed`}
        >
          {children}
        </code>
      </pre>
    </div>
  );
});

/**
 * 마크다운 렌더러
 * - GFM (GitHub Flavored Markdown) 지원
 * - 코드 블록 하이라이팅 + 복사 기능
 * - 테이블, 체크리스트 등 지원
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className = '',
}: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]} // Syntax Highlighting 추가
        components={{
          // pre 태그 제거 (CodeBlock이 자체적으로 pre를 포함하므로 중첩 방지)
          pre: ({ children }) => <>{children}</>,
          // 코드 블록
          code: ({ className, children, node }) => {
            // node?.position 없으면 인라인으로 판단 (react-markdown v9+)
            const isInline =
              !node?.position ||
              node.position.start.line === node.position.end.line;
            return (
              <CodeBlock inline={isInline} className={className}>
                {children}
              </CodeBlock>
            );
          },
          // 링크
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              {children}
            </a>
          ),
          // 제목들
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2 border-b pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold text-gray-900 mt-3 mb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-gray-900 mt-2 mb-1">
              {children}
            </h3>
          ),
          // 리스트
          ul: ({ children }) => (
            <ul className="list-disc list-inside my-2 space-y-1 text-gray-700">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside my-2 space-y-1 text-gray-700">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          // 테이블
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-b">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-sm text-gray-600 border-b border-gray-100">
              {children}
            </td>
          ),
          // 인용문
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-400 bg-blue-50 pl-4 py-2 my-3 text-gray-700 italic">
              {children}
            </blockquote>
          ),
          // 구분선
          hr: () => <hr className="my-4 border-gray-200" />,
          // 단락 - handoff 마커 감지 및 변환
          p: ({ children }) => {
            // children이 문자열이고 handoff 마커가 포함된 경우
            if (
              typeof children === 'string' &&
              containsHandoffMarker(children)
            ) {
              const handoff = parseHandoffMarker(children);
              if (handoff) {
                return <AgentHandoffBadge {...handoff} />;
              }
            }
            // children이 배열인 경우 (마크다운 파싱 결과)
            if (Array.isArray(children)) {
              const textContent = children
                .map((child) => {
                  if (typeof child === 'string') return child;
                  if (child?.props?.children) return child.props.children;
                  return '';
                })
                .join('');
              if (containsHandoffMarker(textContent)) {
                const handoff = parseHandoffMarker(textContent);
                if (handoff) {
                  return <AgentHandoffBadge {...handoff} />;
                }
              }
            }
            return (
              <p className="my-2 leading-relaxed text-gray-800">{children}</p>
            );
          },
          // 강조
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-700">{children}</em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
