'use client';

import {
  ArrowDown,
  Box,
  ChevronRight,
  FileCheck2,
  Gauge,
  GitBranch,
  GitMerge,
  MonitorCheck,
  Rocket,
  Server,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type { ArchitectureDiagram } from '@/data/architecture-diagrams.types';

// ─── 원칙 카드 ────────────────────────────────────────────────────────────────

const DELIVERY_PRINCIPLES = [
  {
    title: '정본 배포 경로',
    description:
      'GitLab main이 canonical repo입니다. validate 통과 후 deploy job이 Vercel production을 배포합니다.',
    icon: GitBranch,
    style: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  },
  {
    title: '로컬 검증 게이트',
    description:
      'pre-commit → pre-push가 기본 게이트입니다. broad change·release 전에는 local Docker CI를 추가합니다.',
    icon: ShieldCheck,
    style: 'border-sky-500/20 bg-sky-500/10 text-sky-200',
  },
  {
    title: '선택형 무거운 검증',
    description:
      'local Docker CI와 production QA는 필요할 때만 추가합니다. docs/reports push는 GitLab CI를 건너뜁니다.',
    icon: Gauge,
    style: 'border-purple-500/20 bg-purple-500/10 text-purple-200',
  },
] as const;

// ─── 파이프라인 페이즈 ─────────────────────────────────────────────────────────

type StepVariant = 'required' | 'optional';

type PipelineStep = {
  title: string;
  command: string;
  detail: string;
  variant: StepVariant;
  badge?: string;
  badgeColor?: string;
};

type Phase = {
  id: string;
  label: string;
  icon: typeof GitBranch;
  color: string; // Tailwind border/bg/text 조합
  headerColor: string;
  steps: PipelineStep[];
};

const PIPELINE_PHASES: Phase[] = [
  {
    id: 'local',
    label: 'LOCAL',
    icon: MonitorCheck,
    color: 'border-sky-500/30 bg-sky-500/5',
    headerColor: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
    steps: [
      {
        title: 'Pre-commit Hook',
        command: 'node scripts/hooks/pre-commit.js',
        detail: 'staged 파일 Biome 포맷 후 git index 동기화',
        variant: 'required',
      },
      {
        title: 'Pre-push Hook',
        command: 'node scripts/hooks/pre-push.js',
        detail: '관련 테스트·type-check, WSL quick mode 우선 적용',
        variant: 'required',
      },
      {
        title: 'Local Docker CI',
        command: 'npm run ci:local:docker',
        detail: 'root validate + ai-engine을 컨테이너에서 전체 재실행',
        variant: 'optional',
        badge: 'broad / release',
        badgeColor: 'text-purple-300 bg-purple-500/15 border-purple-500/25',
      },
    ],
  },
  {
    id: 'push',
    label: 'PUSH',
    icon: GitMerge,
    color: 'border-slate-500/30 bg-slate-500/5',
    headerColor: 'text-slate-300 bg-slate-500/10 border-slate-500/20',
    steps: [
      {
        title: 'GitLab Canonical Push',
        command: 'git push gitlab main',
        detail: 'GitLab CI validate → deploy 파이프라인 트리거',
        variant: 'required',
      },
    ],
  },
  {
    id: 'ci',
    label: 'GITLAB CI',
    icon: Zap,
    color: 'border-orange-500/30 bg-orange-500/5',
    headerColor: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
    steps: [
      {
        title: 'Validate',
        command: 'type-check · lint:ci · test:quick',
        detail:
          '실패 시 deploy 차단. docs/reports push는 이 단계 자체가 스킵됨.',
        variant: 'required',
        badge: 'wsl2-docker · 0분',
        badgeColor: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/25',
      },
      {
        title: 'Deploy',
        command: 'vercel build --prod · vercel deploy --prebuilt --prod',
        detail:
          'Vercel Git Integration 해제. CI deploy job이 유일한 배포 경로.',
        variant: 'required',
        badge: 'shared runner · ~4분',
        badgeColor: 'text-amber-300 bg-amber-500/15 border-amber-500/25',
      },
    ],
  },
  {
    id: 'production',
    label: 'PRODUCTION',
    icon: Rocket,
    color: 'border-emerald-500/30 bg-emerald-500/5',
    headerColor: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
    steps: [
      {
        title: 'Vercel Production',
        command: 'openmanager-ai.vercel.app',
        detail:
          'deploy job 완료 시 자동 반영. 롤백은 Vercel Dashboard에서 즉시 가능.',
        variant: 'required',
      },
    ],
  },
];

const OPTIONAL_SYNC = {
  title: 'GitHub Snapshot (선택)',
  command: 'npm run sync:github',
  detail: '공개 code-only snapshot. 배포 권위 없음.',
};

// ─── 의사결정 기준 ──────────────────────────────────────────────────────────

const DECISION_RULES = [
  {
    label: 'small frontend fix',
    steps: ['pre-commit', 'pre-push', 'git push gitlab main', 'GitLab CI auto'],
    color: 'border-sky-500/20',
  },
  {
    label: 'broad / release-facing change',
    steps: [
      'pre-commit',
      'pre-push',
      'ci:local:docker',
      'git push gitlab main',
      'GitLab CI + production QA',
    ],
    color: 'border-purple-500/20',
  },
  {
    label: 'docs / reports only push',
    steps: ['git push gitlab main', 'GitLab CI 스킵 (changes 규칙)'],
    color: 'border-slate-500/20',
  },
] as const;

// ─── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

function PrincipleCard({
  title,
  description,
  style,
  icon: Icon,
}: {
  title: string;
  description: string;
  style: string;
  icon: typeof GitBranch;
}) {
  return (
    <article className={`rounded-2xl border p-4 ${style}`}>
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-black/15 p-2 text-current">
          <Icon className="h-5 w-5" />
        </div>
        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-white/75">
        {description}
      </p>
    </article>
  );
}

function StepCard({ step }: { step: PipelineStep }) {
  const isOptional = step.variant === 'optional';
  return (
    <div
      className={[
        'rounded-xl p-3 transition-colors',
        isOptional
          ? 'border border-dashed border-white/15 bg-white/3 hover:bg-white/6'
          : 'border border-white/10 bg-white/5 hover:bg-white/8',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-white">{step.title}</p>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isOptional && (
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/40">
              optional
            </span>
          )}
          {step.badge && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${step.badgeColor}`}
            >
              {step.badge}
            </span>
          )}
        </div>
      </div>
      <code className="mt-2 block rounded-lg border border-white/8 bg-black/25 px-2.5 py-1.5 text-[11px] leading-relaxed text-cyan-300">
        {step.command}
      </code>
      <p className="mt-2 text-xs leading-relaxed text-white/55">
        {step.detail}
      </p>
    </div>
  );
}

function PhaseBlock({ phase }: { phase: Phase }) {
  const Icon = phase.icon;
  return (
    <div className={`rounded-2xl border p-4 ${phase.color}`}>
      {/* Phase 헤더 */}
      <div
        className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-wider ${phase.headerColor}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {phase.label}
      </div>
      {/* 스텝들 */}
      <div className="space-y-2">
        {phase.steps.map((step, i) => (
          <div key={step.title}>
            {i > 0 && (
              <div className="my-1.5 flex items-center gap-1 pl-3">
                <ChevronRight className="h-3 w-3 text-white/25" />
                <div className="h-px flex-1 bg-white/10" />
              </div>
            )}
            <StepCard step={step} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PhaseArrow() {
  return (
    <div className="flex justify-center py-1">
      <div className="flex flex-col items-center gap-0.5">
        <div className="h-4 w-px bg-white/20" />
        <ArrowDown className="h-4 w-4 text-white/30" />
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function VibeCiCdSection({
  diagram: _diagram,
}: {
  diagram?: ArchitectureDiagram | null;
}) {
  return (
    <div className="space-y-8">
      {/* 헤더 배너 */}
      <section className="rounded-2xl border border-orange-500/25 bg-linear-to-br from-orange-500/15 via-amber-500/10 to-transparent p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-200">
            <Rocket className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <span className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/15 px-3 py-1 text-xs font-medium text-orange-100">
              하이브리드 CI/CD
            </span>
            <h4 className="text-xl font-semibold text-white">
              로컬 게이트 + GitLab CI validate/deploy + Vercel CLI 배포
            </h4>
            <p className="text-sm leading-relaxed text-white/70">
              pre-commit·pre-push로 로컬 검증 후{' '}
              <code className="rounded bg-white/10 px-1 text-xs">
                git push gitlab main
              </code>
              하면 GitLab CI가 validate(wsl2-docker · 0분) → deploy(shared ·
              ~4분) 순으로 실행해 Vercel production에 반영합니다.
            </p>
          </div>
        </div>
      </section>

      {/* 원칙 카드 3개 */}
      <section className="grid gap-4 md:grid-cols-3">
        {DELIVERY_PRINCIPLES.map((p) => (
          <PrincipleCard
            key={p.title}
            title={p.title}
            description={p.description}
            style={p.style}
            icon={p.icon}
          />
        ))}
      </section>

      {/* 비주얼 파이프라인 플로우 */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Server className="h-4 w-4 text-white/40" />
          <p className="text-xs font-medium uppercase tracking-wider text-white/40">
            Delivery Pipeline
          </p>
        </div>

        <div className="space-y-1">
          {PIPELINE_PHASES.map((phase, i) => (
            <div key={phase.id}>
              <PhaseBlock phase={phase} />
              {i < PIPELINE_PHASES.length - 1 && <PhaseArrow />}
            </div>
          ))}
        </div>

        {/* 선택적 GitHub 동기화 */}
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-white/10 bg-white/3 p-3">
          <Box className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-white/50">
              {OPTIONAL_SYNC.title}
            </p>
            <code className="mt-1 block text-[11px] text-cyan-300/60">
              {OPTIONAL_SYNC.command}
            </code>
            <p className="mt-1 text-xs text-white/35">{OPTIONAL_SYNC.detail}</p>
          </div>
        </div>
      </section>

      {/* 의사결정 기준 */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-black/20 p-2 text-sky-200">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/45">
              Decision Rules
            </p>
            <h4 className="text-base font-semibold text-white">
              변경 유형별 실행 경로
            </h4>
          </div>
        </div>

        <div className="space-y-3">
          {DECISION_RULES.map((rule) => (
            <div
              key={rule.label}
              className={`rounded-xl border ${rule.color} bg-black/15 px-4 py-3`}
            >
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
                {rule.label}
              </p>
              <div className="flex flex-wrap items-center gap-1">
                {rule.steps.map((step, i) => (
                  <span key={step} className="flex items-center gap-1">
                    <span className="rounded-md bg-white/8 px-2 py-0.5 text-xs text-white/80">
                      {step}
                    </span>
                    {i < rule.steps.length - 1 && (
                      <ChevronRight className="h-3 w-3 shrink-0 text-white/25" />
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
