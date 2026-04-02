'use client';

import { X } from 'lucide-react';
import type { ArchitectureDiagram } from '@/data/architecture-diagrams.types';

type VibeView = 'current' | 'history' | 'cicd';

type FeatureCardModalHeaderProps = {
  title: string;
  Icon: React.ElementType;
  showDiagram: boolean;
  diagramData: ArchitectureDiagram | null;
  cardId: string | undefined;
  vibeView: VibeView;
  variant: 'home' | 'landing';
  onToggleDiagram: () => void;
  onSetVibeView: (view: VibeView) => void;
  onClose: () => void;
};

const VIBE_VIEWS: { id: VibeView; label: string }[] = [
  { id: 'current', label: '현재 도구' },
  { id: 'history', label: '개발 환경 변화' },
  { id: 'cicd', label: 'CI/CD' },
];

export function FeatureCardModalHeader({
  title,
  Icon,
  showDiagram,
  diagramData,
  cardId,
  vibeView,
  variant,
  onToggleDiagram,
  onSetVibeView,
  onClose,
}: FeatureCardModalHeaderProps) {
  return (
    <header
      className={`flex shrink-0 flex-col items-stretch gap-3 border-b border-gray-700/50 sm:flex-row sm:items-center sm:justify-between ${
        showDiagram ? 'px-4 py-2.5' : 'p-4'
      }`}
    >
      <div className={`flex items-center ${showDiagram ? 'gap-2.5' : 'gap-3'}`}>
        <div
          className={`flex items-center justify-center rounded-lg bg-gray-800 ${
            showDiagram ? 'h-7 w-7' : 'h-8 w-8'
          }`}
        >
          <Icon
            className={showDiagram ? 'h-4 w-4' : 'h-5 w-5'}
            style={{ color: variant === 'home' ? 'white' : 'currentColor' }}
          />
        </div>
        <h2
          id="modal-title"
          className={`font-semibold text-white ${showDiagram ? 'text-base' : 'text-lg'}`}
        >
          {title}
        </h2>
      </div>

      <div className="flex w-full items-start justify-between gap-2 sm:w-auto sm:items-center sm:justify-normal">
        {diagramData && cardId !== 'vibe-coding' && (
          <button
            type="button"
            onClick={onToggleDiagram}
            className="rounded-lg bg-linear-to-r from-indigo-600 to-purple-600 px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:scale-105 hover:from-indigo-500 hover:to-purple-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
            aria-label={showDiagram ? '상세 내용 보기' : '아키텍처 보기'}
          >
            {showDiagram ? '📄 상세 내용' : '📊 아키텍처'}
          </button>
        )}

        {cardId === 'vibe-coding' && (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-1 rounded-xl border border-white/10 bg-black/20 p-1 sm:flex-none sm:flex-nowrap">
            {VIBE_VIEWS.map((view) => {
              const isActive = vibeView === view.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => onSetVibeView(view.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 sm:px-3 sm:text-sm ${
                    isActive
                      ? 'bg-linear-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-950/30'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                  aria-pressed={isActive}
                >
                  {view.label}
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>
      </div>
    </header>
  );
}
