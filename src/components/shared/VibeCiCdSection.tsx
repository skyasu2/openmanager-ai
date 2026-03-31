'use client';

import {
  AlertTriangle,
  ArrowRight,
  Box,
  Cloud,
  Globe,
  Home,
  MonitorCheck,
  Rocket,
  Send,
  ShieldCheck,
} from 'lucide-react';
import type { ArchitectureDiagram } from '@/data/architecture-diagrams.types';
import { cn } from '@/lib/utils';

// ─── 파이프라인 카드 정의 ───────────────────────────────────────────────────────

type PipelineCard = {
  id: string;
  icon: typeof MonitorCheck;
  stage: string;
  detail: string[];
  accent: string;
  bg: string;
  border: string;
  iconBg: string;
  iconText: string;
  ring: string;
  runner?: {
    icon: typeof Home;
    label: string;
    time: string;
    timeBg: string;
    timeText: string;
  };
};

const PIPELINE: PipelineCard[] = [
  {
    id: 'local',
    icon: MonitorCheck,
    stage: '로컬 훅',
    detail: ['pre-commit', 'pre-push'],
    accent: 'text-sky-300',
    bg: 'bg-sky-500/8',
    border: 'border-sky-500/30',
    iconBg: 'bg-sky-500/20',
    iconText: 'text-sky-300',
    ring: 'ring-sky-500/40',
  },
  {
    id: 'push',
    icon: Send,
    stage: 'GitLab 푸시',
    detail: ['git push', 'gitlab main'],
    accent: 'text-slate-300',
    bg: 'bg-slate-500/8',
    border: 'border-slate-500/20',
    iconBg: 'bg-slate-500/20',
    iconText: 'text-slate-300',
    ring: 'ring-slate-500/30',
  },
  {
    id: 'validate',
    icon: ShieldCheck,
    stage: '코드 검사',
    detail: ['type · lint', 'test'],
    accent: 'text-cyan-300',
    bg: 'bg-cyan-500/8',
    border: 'border-cyan-500/30',
    iconBg: 'bg-cyan-500/20',
    iconText: 'text-cyan-300',
    ring: 'ring-cyan-500/50',
    runner: {
      icon: Home,
      label: '내 PC (WSL2)',
      time: '0분',
      timeBg: 'bg-cyan-500/15',
      timeText: 'text-cyan-300',
    },
  },
  {
    id: 'deploy',
    icon: Rocket,
    stage: '자동 배포',
    detail: ['pull · build', 'deploy --prebuilt'],
    accent: 'text-amber-300',
    bg: 'bg-amber-500/8',
    border: 'border-amber-500/30',
    iconBg: 'bg-amber-500/20',
    iconText: 'text-amber-300',
    ring: 'ring-amber-500/50',
    runner: {
      icon: Cloud,
      label: '공용 러너',
      time: '~4분',
      timeBg: 'bg-amber-500/15',
      timeText: 'text-amber-300',
    },
  },
  {
    id: 'production',
    icon: Globe,
    stage: '실서비스',
    detail: ['vercel.app', '프로덕션'],
    accent: 'text-emerald-300',
    bg: 'bg-emerald-500/8',
    border: 'border-emerald-500/30',
    iconBg: 'bg-emerald-500/20',
    iconText: 'text-emerald-300',
    ring: 'ring-emerald-500/50',
  },
];

// ─── 상황별 시나리오 ────────────────────────────────────────────────────────────

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

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function VibeCiCdSection({
  diagram: _diagram,
}: {
  diagram?: ArchitectureDiagram | null;
}) {
  return (
    <div className="space-y-5">
      {/* ── 1. 파이프라인 다이어그램 카드 ──────────────────────────────────── */}
      <section>
        <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-widest text-white/25">
          push 한 번 → 자동 검사 → 자동 배포 → 실서비스
        </p>

        {/* 카드 행 */}
        <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
          {PIPELINE.map((card, i) => {
            const Icon = card.icon;
            const RunnerIcon = card.runner?.icon;
            return (
              <div key={card.id} className="flex items-center">
                {/* 파이프라인 카드 */}
                <div
                  className={cn(
                    'flex min-w-[108px] flex-col items-center gap-2.5 rounded-2xl border p-3.5',
                    card.bg,
                    card.border
                  )}
                >
                  {/* 아이콘 */}
                  <div
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-xl ring-2',
                      card.iconBg,
                      card.iconText,
                      card.ring
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* 스테이지 이름 */}
                  <p
                    className={cn(
                      'text-center text-[11px] font-black leading-tight',
                      card.accent
                    )}
                  >
                    {card.stage}
                  </p>

                  {/* 상세 */}
                  <div className="flex flex-col items-center gap-0.5">
                    {card.detail.map((d) => (
                      <span
                        key={d}
                        className="text-center text-[9px] leading-tight text-white/35"
                      >
                        {d}
                      </span>
                    ))}
                  </div>

                  {/* 러너 배지 */}
                  {card.runner && RunnerIcon && (
                    <div
                      className={cn(
                        'flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5',
                        card.runner.timeBg
                      )}
                    >
                      <RunnerIcon
                        className={cn('h-3 w-3 shrink-0', card.runner.timeText)}
                      />
                      <div className="min-w-0 text-center">
                        <p
                          className={cn(
                            'text-[9px] font-semibold leading-none',
                            card.runner.timeText
                          )}
                        >
                          {card.runner.label}
                        </p>
                        <p
                          className={cn(
                            'mt-0.5 text-[11px] font-black tabular-nums leading-none',
                            card.runner.timeText
                          )}
                        >
                          {card.runner.time}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 화살표 (마지막 카드 제외) */}
                {i < PIPELINE.length - 1 && (
                  <div className="flex shrink-0 items-center px-1.5">
                    <ArrowRight className="h-4 w-4 text-white/15" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 2. 게이트 · 운영 주의 ──────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/5 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-rose-400/70" />
            <p className="text-[11px] text-white/40">
              검사 실패 시 배포 중단 · 배포는 한 번에 하나씩만 실행
            </p>
          </div>
          <code className="shrink-0 rounded-full border border-rose-400/15 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-300/80">
            resource_group: production
          </code>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/80" />
          <div>
            <p className="text-[11px] font-semibold text-amber-200">
              운영 주의
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">
              내 PC의 <code className="text-cyan-300/70">wsl2-docker</code>{' '}
              러너가 꺼져 있으면 검사 단계는 shared runner로 자동 전환되지 않고
              pending 상태로 대기합니다.
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. 상황별 흐름 ─────────────────────────────────────────────────── */}
      <details className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <summary className="cursor-pointer list-none text-center text-[10px] font-semibold uppercase tracking-widest text-white/25">
          상황별 실행 흐름 보기
        </summary>
        <div className="mt-4 space-y-2.5">
          {SCENARIOS.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${s.border} ${s.bg}`}
            >
              <span
                className={`w-14 shrink-0 text-[11px] font-bold leading-tight ${s.labelColor}`}
              >
                {s.label}
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {s.steps.map((emoji, i) => (
                  <span
                    key={s.stepLabels[i]}
                    className="flex items-center gap-1"
                  >
                    <span className="flex flex-col items-center">
                      <span className="text-base leading-none">{emoji}</span>
                      <span className="mt-0.5 text-[8px] leading-none text-white/30">
                        {s.stepLabels[i]}
                      </span>
                    </span>
                    {i < s.steps.length - 1 && (
                      <ArrowRight className="h-3 w-3 shrink-0 text-white/15" />
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>

      {/* ── 4. GitHub 스냅샷 풋노트 ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-white/8 px-4 py-2.5">
        <Box className="h-3.5 w-3.5 shrink-0 text-white/20" />
        <p className="text-[10px] text-white/30">
          <span className="font-medium text-white/40">GitHub Snapshot</span>
          {' · '}선택 · 공개 code-only · 배포 권위 없음{' · '}
          <code className="text-cyan-400/50">npm run sync:github</code>
        </p>
      </div>
    </div>
  );
}
