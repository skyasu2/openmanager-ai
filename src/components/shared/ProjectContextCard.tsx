'use client';

import {
  PORTFOLIO_PROJECT_SUMMARY,
  PROJECT_EXPECTATION_NOTES,
  PROJECT_STACK_LABELS,
  PROJECT_VALIDATION_POINTS,
} from '@/config/app-meta';

interface ProjectContextCardProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export function ProjectContextCard({
  variant = 'full',
  className = '',
}: ProjectContextCardProps) {
  const isCompact = variant === 'compact';

  return (
    <section
      className={`rounded-2xl border border-white/15 bg-white/8 text-white shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop-blur-xl ${isCompact ? 'p-4' : 'p-5 sm:p-6'} ${className}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-cyan-100/90">
          <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1">
            Portfolio Project
          </span>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1">
            External Access Ready
          </span>
          <span className="rounded-full border border-violet-300/30 bg-violet-400/10 px-2.5 py-1">
            Multi-Agent AI
          </span>
        </div>

        <div>
          <h2
            className={`font-semibold text-white ${isCompact ? 'text-sm' : 'text-lg sm:text-xl'}`}
          >
            개인 학습용을 넘어, 실제 체험 가능한 포트폴리오 형태로 구축한
            프로젝트
          </h2>
          <p
            className={`mt-2 text-white/75 ${isCompact ? 'text-xs leading-5' : 'text-sm leading-6'}`}
          >
            {PORTFOLIO_PROJECT_SUMMARY}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {PROJECT_STACK_LABELS.map((label) => (
            <span
              key={label}
              className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] text-white/75"
            >
              {label}
            </span>
          ))}
        </div>

        {isCompact ? (
          <ul className="space-y-1.5 text-xs text-white/75">
            {PROJECT_EXPECTATION_NOTES.slice(0, 2).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {PROJECT_VALIDATION_POINTS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-white/10 bg-slate-950/25 p-3"
                >
                  <p className="text-sm font-semibold text-white">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/70">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            <ul className="space-y-1.5 text-sm text-white/72">
              {PROJECT_EXPECTATION_NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

export default ProjectContextCard;
