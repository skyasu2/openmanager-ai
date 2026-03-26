import type { VibeCodeData } from '@/data/tech-stacks.data';
import type { TechItem } from '@/types/feature-card.types';
import { TechCard } from './TechCard';

export type VibeHistorySectionProps = {
  historyStages: VibeCodeData['history'];
};

type StageColor = 'emerald' | 'amber' | 'purple';

const COLOR_CLASSES: Record<
  StageColor,
  { border: string; bg: string; heading: string; badge: string; text: string }
> = {
  emerald: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    heading: 'text-emerald-300',
    badge: 'bg-emerald-500/20 text-emerald-300',
    text: 'text-emerald-200/80',
  },
  amber: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    heading: 'text-amber-300',
    badge: 'bg-amber-500/20 text-amber-300',
    text: 'text-amber-200/80',
  },
  purple: {
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/10',
    heading: 'text-purple-300',
    badge: 'bg-purple-500/20 text-purple-300',
    text: 'text-purple-200/80',
  },
};

const STAGE_COLORS: Record<'stage1' | 'stage2' | 'stage3', StageColor> = {
  stage1: 'emerald',
  stage2: 'amber',
  stage3: 'purple',
};

/**
 * 바이브 코딩 히스토리 섹션
 * 개발 환경 변화를 3단계로 시각화
 */
export function VibeHistorySection({ historyStages }: VibeHistorySectionProps) {
  if (!historyStages) return null;

  const stages = [
    { key: 'stage1' as const, items: historyStages.stage1, num: 1 },
    { key: 'stage2' as const, items: historyStages.stage2, num: 2 },
    { key: 'stage3' as const, items: historyStages.stage3, num: 3 },
  ];

  return (
    <div className="space-y-10">
      {stages.map(({ key, items, num }) => {
        const meta = historyStages.stageMeta[key];
        const c = COLOR_CLASSES[STAGE_COLORS[key]];

        return (
          <div key={key} className="space-y-4">
            <div className={`mb-6 rounded-lg border ${c.border} ${c.bg} p-4`}>
              <h4
                className={`mb-2 flex items-center gap-2 text-xl font-bold ${c.heading}`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${c.badge} text-sm font-bold`}
                >
                  {num}
                </div>
                {meta.title}
                <span className={`rounded-full ${c.badge} px-3 py-1 text-sm`}>
                  {items?.length || 0}개 도구
                </span>
              </h4>
              <p className={`${meta.link ? 'mb-3' : ''} text-sm ${c.text}`}>
                {meta.description}
              </p>
              {meta.link && (
                <a
                  href={meta.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600/80 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:scale-105 hover:bg-emerald-500"
                >
                  <span>🔗</span>
                  <span>{meta.link.label}</span>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {items?.map((tech: TechItem) => (
                <TechCard key={tech.name} tech={tech} />
              )) || null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
