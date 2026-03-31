'use client';

import {
  ArrowRight,
  Box,
  Globe,
  MonitorCheck,
  Rocket,
  Send,
  ShieldCheck,
} from 'lucide-react';
import type { ArchitectureDiagram } from '@/data/architecture-diagrams.types';
import { cn } from '@/lib/utils';

type FooterBadge = {
  label: string;
  value?: string;
  bg: string;
  text: string;
  border: string;
};

type PipelineCard = {
  id: string;
  icon: typeof MonitorCheck;
  stage: string;
  detail: [string, string];
  bg: string;
  border: string;
  iconBg: string;
  iconText: string;
  ring: string;
  accent: string;
  footer: FooterBadge;
};

const PIPELINE_CARDS: PipelineCard[] = [
  {
    id: 'local',
    icon: MonitorCheck,
    stage: '로컬 훅',
    detail: ['pre-commit', 'pre-push'],
    bg: 'bg-sky-500/5',
    border: 'border-sky-500/25',
    iconBg: 'bg-sky-500/15',
    iconText: 'text-sky-300',
    ring: 'ring-sky-500/35',
    accent: 'text-sky-300',
    footer: {
      label: 'Husky',
      bg: 'bg-sky-500/10',
      text: 'text-sky-300',
      border: 'border-sky-500/20',
    },
  },
  {
    id: 'push',
    icon: Send,
    stage: 'GitLab 푸시',
    detail: ['git push', 'gitlab main'],
    bg: 'bg-violet-500/5',
    border: 'border-violet-500/25',
    iconBg: 'bg-violet-500/15',
    iconText: 'text-violet-300',
    ring: 'ring-violet-500/35',
    accent: 'text-violet-300',
    footer: {
      label: 'canonical',
      bg: 'bg-violet-500/10',
      text: 'text-violet-300',
      border: 'border-violet-500/20',
    },
  },
  {
    id: 'validate',
    icon: ShieldCheck,
    stage: '코드 검사',
    detail: ['type · lint', 'test'],
    bg: 'bg-cyan-500/5',
    border: 'border-cyan-500/25',
    iconBg: 'bg-cyan-500/15',
    iconText: 'text-cyan-300',
    ring: 'ring-cyan-500/40',
    accent: 'text-cyan-300',
    footer: {
      label: '내 PC (WSL2)',
      value: '0분',
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-300',
      border: 'border-cyan-500/20',
    },
  },
  {
    id: 'deploy',
    icon: Rocket,
    stage: '자동 배포',
    detail: ['pull · build', 'deploy --prebuilt'],
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/25',
    iconBg: 'bg-amber-500/15',
    iconText: 'text-amber-300',
    ring: 'ring-amber-500/40',
    accent: 'text-amber-300',
    footer: {
      label: '공용 러너',
      value: '~4분',
      bg: 'bg-amber-500/10',
      text: 'text-amber-300',
      border: 'border-amber-500/20',
    },
  },
  {
    id: 'production',
    icon: Globe,
    stage: '실서비스',
    detail: ['vercel.app', '프로덕션'],
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/25',
    iconBg: 'bg-emerald-500/15',
    iconText: 'text-emerald-300',
    ring: 'ring-emerald-500/40',
    accent: 'text-emerald-300',
    footer: {
      label: 'live',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-300',
      border: 'border-emerald-500/20',
    },
  },
];

const SCENARIOS = [
  {
    id: 'small',
    label: '작은 수정',
    labelColor: 'text-sky-300',
    border: 'border-sky-500/20',
    bg: 'bg-sky-500/5',
    steps: ['💻', '📤', '🛡️', '🚀', '🌐'],
    stepLabels: ['pre-hooks', 'push', '검사', '배포', '완료'],
  },
  {
    id: 'big',
    label: '큰 변경',
    labelColor: 'text-purple-300',
    border: 'border-purple-500/20',
    bg: 'bg-purple-500/5',
    steps: ['💻', '🐳', '📤', '🛡️', '🚀', '🔍'],
    stepLabels: ['pre-hooks', 'Docker CI', 'push', '검사', '배포', 'QA'],
  },
  {
    id: 'docs',
    label: '문서만',
    labelColor: 'text-slate-400',
    border: 'border-slate-500/20',
    bg: 'bg-slate-500/5',
    steps: ['📤', '⏭️'],
    stepLabels: ['push', 'CI 스킵'],
  },
] as const;

export function VibeCiCdSection({
  diagram: _diagram,
}: {
  diagram?: ArchitectureDiagram | null;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-transparent px-5 py-6">
        <p className="text-center text-[10px] font-bold tracking-widest text-white/25">
          배포 흐름
        </p>
        <p className="mt-3 text-center text-[11px] text-white/35">
          push 한 번 뒤에 검사와 배포가 자동으로 이어지고, 최종 결과만
          실서비스에 반영됩니다.
        </p>

        <div className="relative mt-6">
          <div className="flex items-start gap-0 overflow-x-auto pb-2">
            {PIPELINE_CARDS.map((card, index) => {
              const Icon = card.icon;
              return (
                <div key={card.id} className="flex items-start">
                  <div
                    className={cn(
                      'flex min-w-[116px] flex-col items-center gap-2.5 rounded-2xl border px-3.5 py-4',
                      card.bg,
                      card.border
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-xl ring-1 shadow-lg transition-transform motion-safe:hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none',
                        card.iconBg,
                        card.iconText,
                        card.ring
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <p
                      className={cn(
                        'text-center text-[11px] font-black leading-tight',
                        card.accent
                      )}
                    >
                      {card.stage}
                    </p>

                    <div className="flex flex-col items-center gap-0.5">
                      {card.detail.map((line) => (
                        <span
                          key={line}
                          className="text-center text-[9px] leading-tight text-white/35"
                        >
                          {line}
                        </span>
                      ))}
                    </div>

                    <div
                      className={cn(
                        'flex min-h-[34px] w-full items-center justify-center rounded-lg border px-2 py-1.5',
                        card.footer.bg,
                        card.footer.border
                      )}
                    >
                      {card.footer.value ? (
                        <div className="text-center">
                          <p
                            className={cn(
                              'text-[9px] font-semibold leading-none',
                              card.footer.text
                            )}
                          >
                            {card.footer.label}
                          </p>
                          <p
                            className={cn(
                              'mt-0.5 text-[11px] font-black leading-none',
                              card.footer.text
                            )}
                          >
                            {card.footer.value}
                          </p>
                        </div>
                      ) : (
                        <span
                          className={cn(
                            'text-[10px] font-bold leading-none',
                            card.footer.text
                          )}
                        >
                          {card.footer.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {index < PIPELINE_CARDS.length - 1 && (
                    <div className="mt-16 flex items-center px-1.5">
                      <ArrowRight className="h-4 w-4 text-white/15" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-black/30 to-transparent" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
            <p className="text-[11px] font-medium text-white/40">
              검사 실패 시 배포 자동 차단 · 배포는 한 번에 하나씩만 실행
            </p>
          </div>
          <code className="self-start rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-300/70 sm:self-auto">
            resource_group: production
          </code>
        </div>

        <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3">
          <p className="text-[11px] font-bold text-amber-300/80">운영 주의</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/40">
            내 PC의 <code className="text-cyan-300/70">wsl2-docker</code> 러너가
            꺼져 있으면 검사 단계는 shared runner로 자동 전환되지 않고 pending
            상태로 대기합니다.
          </p>
        </div>
      </section>

      <details className="rounded-2xl border border-white/5 bg-black/20 p-5">
        <summary className="cursor-pointer list-none text-center text-[11px] font-bold text-white/35 marker:content-none">
          상황별 실행 흐름 보기
        </summary>
        <div className="mt-4 space-y-3">
          {SCENARIOS.map((scenario) => (
            <div
              key={scenario.id}
              className={cn(
                'group flex items-center gap-4 rounded-xl border px-4 py-3 transition-all motion-safe:hover:border-white/20 motion-reduce:transition-none',
                scenario.border,
                scenario.bg
              )}
            >
              <span
                className={cn(
                  'w-14 shrink-0 text-[11px] font-bold leading-tight motion-safe:group-hover:text-white',
                  scenario.labelColor
                )}
              >
                {scenario.label}
              </span>

              <div className="flex flex-wrap items-center gap-1.5">
                {scenario.steps.map((emoji, index) => (
                  <span
                    key={`${scenario.id}-${scenario.stepLabels[index]}`}
                    className="flex items-center gap-1.5"
                  >
                    <span className="flex flex-col items-center">
                      <span className="text-base leading-none transition-transform motion-safe:group-hover:scale-110 motion-reduce:transform-none motion-reduce:transition-none">
                        {emoji}
                      </span>
                      <span className="mt-1 text-[8px] font-medium leading-none text-white/20">
                        {scenario.stepLabels[index]}
                      </span>
                    </span>
                    {index < scenario.steps.length - 1 && (
                      <ArrowRight className="h-3 w-3 shrink-0 text-white/10" />
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>

      <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/2 px-4 py-3">
        <Box className="h-4 w-4 shrink-0 text-white/20" />
        <p className="text-[10px] leading-relaxed text-white/30">
          <span className="font-bold text-white/50">GitHub Snapshot</span>
          {' · '}선택 사항 · 공개 code-only 스냅샷 · 배포 권위 없음
          {' · '}
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-cyan-400/60">
            npm run sync:github
          </code>
        </p>
      </div>
    </div>
  );
}
