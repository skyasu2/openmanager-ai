'use client';

import { ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { type FC, useState } from 'react';

type WebSource = {
  title: string;
  url: string;
  sourceType: string;
};

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const WebSourceCards: FC<{ sources: WebSource[] }> = ({ sources }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/50 text-sm">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-blue-100/40 transition-colors rounded-lg"
        aria-expanded={isExpanded}
        aria-label={`참고 출처 ${sources.length}건`}
      >
        <span className="flex items-center gap-1.5 text-blue-700 font-medium text-xs">
          <span>참고 출처 {sources.length}건</span>
        </span>
        {isExpanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-blue-400" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-blue-400" />
        )}
      </button>
      {isExpanded && (
        <div className="px-3 pb-2.5 space-y-1">
          {sources.map((source, i) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-blue-100/60 transition-colors group"
            >
              <span className="text-blue-500 font-medium text-xs mt-0.5 shrink-0">
                [{i + 1}]
              </span>
              <Globe className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-blue-600 group-hover:underline truncate">
                  {source.title}
                </div>
                <div className="text-2xs text-gray-400 truncate">
                  {extractDomain(source.url)}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default WebSourceCards;
