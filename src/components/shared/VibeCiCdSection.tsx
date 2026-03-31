'use client';

import {
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

// ─── 파이프라인 노드 ────────────────────────────────────────────────────────────

type RunnerBadge = {
  icon: typeof Home;
  name: string;
  time: string;
  bg: string;
  text: string;
  border: string;
};

type FlowNode = {
  id: string;
  icon: typeof MonitorCheck;
  label: string;
  sub: string;
  circleBg: string;
  circleText: string;
  ring: string;
  runner?: RunnerBadge;
};

const FLOW_NODES: FlowNode[] = [
  {
    id: 'local',
    icon: MonitorCheck,
    label: '내 컴퓨터',
    sub: 'pre-commit\npre-push',
    circleBg: 'bg-sky-500/20',
    circleText: 'text-sky-300',
    ring: 'ring-sky-500/40',
  },
  {
    id: 'push',
    icon: Send,
    label: 'GitLab 전송',
    sub: 'git push\ngitlab main',
    circleBg: 'bg-slate-500/20',
    circleText: 'text-slate-300',
    ring: 'ring-slate-500/30',
  },
  {
    id: 'validate',
    icon: ShieldCheck,
    label: '코드 검사',
    sub: 'type · lint · test',
    circleBg: 'bg-cyan-500/20',
    circleText: 'text-cyan-300',
    ring: 'ring-cyan-500/50',
    runner: {
      icon: Home,
      name: '내 PC',
      time: '0분',
      bg: 'bg-cyan-500/15',
      text: 'text-cyan-300',
      border: 'border-cyan-500/30',
    },
  },
  {
    id: 'deploy',
    icon: Rocket,
    label: '자동 배포',
    sub: 'Prebuilt Flow\n(Deterministic)',
    circleBg: 'bg-amber-500/20',
    circleText: 'text-amber-300',
    ring: 'ring-amber-500/50',
    runner: {
      icon: Cloud,
      name: 'GitLab 서버',
      time: '~4분',
      bg: 'bg-amber-500/15',
      text: 'text-amber-300',
      border: 'border-amber-500/30',
    },
  },
  {
    id: 'production',
    icon: Globe,
    label: '실서비스',
    sub: 'vercel.app',
    circleBg: 'bg-emerald-500/20',
    circleText: 'text-emerald-300',
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
    <div className="space-y-6">
      {/* ── 1. 파이프라인 플로우 다이어그램 ──────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-white/5 px-5 py-6">
        <p className="mb-5 text-center text-[10px] font-semibold uppercase tracking-widest text-white/25">
          push 한 번 → 자동 검사 → 자동 배포 → 실서비스
        </p>

        {/* 노드 + 연결선 */}
        <div className="relative flex items-start justify-between overflow-x-auto pb-1">
          {/* 배경 연결선 (원 중앙 top-7 = 28px) */}
          <div className="pointer-events-none absolute top-7 right-5 left-5 h-px bg-gradient-to-r from-sky-500/20 via-cyan-500/20 to-emerald-500/20" />

          {FLOW_NODES.map((node) => {
            const Icon = node.icon;
            const RunnerIcon = node.runner?.icon;
            return (
              <div
                key={node.id}
                className="relative z-10 flex min-w-[60px] flex-col items-center gap-1.5 px-1"
              >
                {/* 아이콘 원 */}
                <div
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-full ring-2',
                    node.circleBg,
                    node.circleText,
                    node.ring
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                {/* 레이블 */}
                <p
                  className={`text-center text-[11px] font-bold leading-tight ${node.circleText}`}
                >
                  {node.label}
                </p>
                {/* 서브 */}
                <p className="whitespace-pre-line text-center text-[9px] leading-tight text-white/30">
                  {node.sub}
                </p>
                {/* 러너 배지 */}
                {node.runner && RunnerIcon && (
                  <div
                    className={cn(
                      'mt-0.5 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold',
                      node.runner.bg,
                      node.runner.text,
                      node.runner.border
                    )}
                  >
                    <RunnerIcon className="h-2.5 w-2.5 shrink-0" />
                    <span>{node.runner.name}</span>
                    <span>{node.runner.time}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 2. Runner 분리 — 큰 비주얼 카드 2개 ─────────────────────────── */}
      <section>
        <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-white/25">
          검사는 내 PC · 배포는 GitLab 서버 (분리 실행)
        </p>
        <div className="grid grid-cols-2 gap-4">
          {/* 내 PC — self-hosted */}
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/8 p-5">
            {/* 큰 아이콘 */}
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-300 ring-2 ring-cyan-500/30">
              <Home className="h-9 w-9" />
            </div>
            <div className="text-center">
              <p className="text-base font-black text-cyan-200">내 컴퓨터</p>
              <p className="text-[10px] text-cyan-400/50">WSL2 self-hosted</p>
            </div>
            {/* 시간 표시 */}
            <div className="w-full rounded-xl bg-black/25 py-3 text-center">
              <p className="text-4xl font-black tabular-nums text-cyan-300">
                0분
              </p>
              <p className="mt-0.5 text-[10px] text-white/30">분 소진 없음</p>
            </div>
            {/* 담당 작업 */}
            <div className="flex w-full items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2.5">
              <ShieldCheck className="h-5 w-5 shrink-0 text-cyan-400" />
              <div>
                <p className="text-xs font-bold text-cyan-200">코드 검사</p>
                <p className="text-[9px] text-white/35">type · lint · test</p>
              </div>
            </div>
          </div>

          {/* GitLab 서버 — shared */}
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            {/* 큰 아이콘 */}
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-300 ring-2 ring-amber-500/30">
              <Cloud className="h-9 w-9" />
            </div>
            <div className="text-center">
              <p className="text-base font-black text-amber-200">GitLab 서버</p>
              <p className="text-[10px] text-amber-400/50">
                shared runner (Serial)
              </p>
            </div>
            {/* 시간 표시 */}
            <div className="w-full rounded-xl bg-black/25 py-3 text-center">
              <p className="text-4xl font-black tabular-nums text-amber-300">
                ~4분
              </p>
              <p className="mt-0.5 text-[10px] text-white/30">
                월 400분 한도 (Managed)
              </p>
            </div>
            {/* 담당 작업 */}
            <div className="flex w-full items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
              <Rocket className="h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <p className="text-xs font-bold text-amber-200">
                  결정론적 배포
                </p>
                <p className="text-[9px] text-white/35">
                  pull · build · deploy --prebuilt
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* validate 실패 시 게이트 설명 */}
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-4 py-2.5">
          <ShieldCheck className="h-4 w-4 shrink-0 text-rose-400/70" />
          <p className="text-[11px] text-white/40">
            검사 실패 시 배포 자동 차단 · 동시 배포 충돌 방지 (Serial)
            <span className="ml-2 text-rose-400/60">(Stability Gate)</span>
          </p>
        </div>
      </section>

      {/* ── 3. 상황별 흐름 — 이모지 시각화 ──────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-widest text-white/25">
          상황별 실행 흐름
        </p>
        <div className="space-y-2.5">
          {SCENARIOS.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${s.border} ${s.bg}`}
            >
              {/* 상황 레이블 */}
              <span
                className={`w-14 shrink-0 text-[11px] font-bold leading-tight ${s.labelColor}`}
              >
                {s.label}
              </span>
              {/* 스텝 이모지 체인 */}
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
      </section>

      {/* ── 4. GitHub 스냅샷 (선택) — 작은 풋노트 ───────────────────────── */}
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-white/8 px-4 py-2.5">
        <Box className="h-3.5 w-3.5 shrink-0 text-white/20" />
        <p className="text-[10px] text-white/30">
          <span className="font-medium text-white/40">GitHub Snapshot</span>
          {' · '}선택 · 공개 code-only · 배포 권위 없음
          {' · '}
          <code className="text-cyan-400/50">npm run sync:github</code>
        </p>
      </div>
    </div>
  );
}
