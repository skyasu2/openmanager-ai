'use client';

import { Ban, FileCheck2, GitBranch, Rocket, ShieldCheck } from 'lucide-react';
import type { ArchitectureDiagram } from '@/data/architecture-diagrams.types';

const DELIVERY_PRINCIPLES = [
  {
    title: 'Canonical First',
    description:
      '정본 저장소는 GitLab main입니다. Vercel frontend 배포도 GitLab main을 기준으로 자동 반영됩니다.',
    icon: GitBranch,
    style: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  },
  {
    title: 'Local Gates First',
    description:
      '작은 변경은 pre-commit + pre-push로 빠르게 걸러내고, broad change나 release 직전에는 local Docker CI를 추가로 사용합니다.',
    icon: ShieldCheck,
    style: 'border-sky-500/20 bg-sky-500/10 text-sky-200',
  },
  {
    title: 'Runner by Exception',
    description:
      'GitLab SaaS CI runner를 기본으로 두지 않습니다. 현재 정책은 local-docker-only이며, GitHub는 공개용 code snapshot 경로로만 취급합니다.',
    icon: Ban,
    style: 'border-purple-500/20 bg-purple-500/10 text-purple-200',
  },
] as const;

const PIPELINE_STEPS = [
  {
    eyebrow: 'Gate 1',
    title: 'Pre-commit Hook',
    command: 'node scripts/hooks/pre-commit.js',
    detail: 'staged 파일만 Biome check --write 후 git index를 다시 맞춥니다.',
  },
  {
    eyebrow: 'Gate 2',
    title: 'Pre-push Hook',
    command: 'node scripts/hooks/pre-push.js',
    detail:
      '관련 테스트, 변경 범위 type-check, WSL quick mode를 우선 적용합니다.',
  },
  {
    eyebrow: 'Optional Gate',
    title: 'Local Docker CI',
    command: 'npm run ci:local:docker',
    detail:
      'broad change나 deploy-sensitive 변경일 때 root validate와 ai-engine 검증을 컨테이너에서 다시 돌립니다.',
  },
  {
    eyebrow: 'Canonical Push',
    title: 'GitLab Main',
    command: 'git push gitlab main',
    detail:
      '정본 저장소에 push하면 Vercel production 배포가 여기서 이어집니다.',
  },
  {
    eyebrow: 'Deploy',
    title: 'Vercel Production',
    command: 'GitLab main -> auto deploy',
    detail:
      'frontend production source는 GitLab main이며, 최신 deploy 상태를 기준으로 확인합니다.',
  },
  {
    eyebrow: 'Optional Sync',
    title: 'GitHub Snapshot',
    command: 'npm run sync:github',
    detail:
      '공개 저장소는 선택적 code-only snapshot입니다. 직접 push target으로 쓰지 않습니다.',
  },
] as const;

const DECISION_RULES = [
  {
    label: 'small frontend fix',
    value: 'pre-commit -> pre-push -> git push gitlab main',
  },
  {
    label: 'broad / release-facing change',
    value: '위 기본 경로 + npm run ci:local:docker',
  },
  {
    label: 'public repo refresh',
    value: 'canonical 배포 후 필요할 때만 npm run sync:github',
  },
] as const;

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

export function VibeCiCdSection({
  diagram,
}: {
  diagram?: ArchitectureDiagram | null;
}) {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-orange-500/25 bg-linear-to-br from-orange-500/15 via-amber-500/10 to-transparent p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-200">
            <Rocket className="h-6 w-6" />
          </div>
          <div className="space-y-3">
            <span className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/15 px-3 py-1 text-xs font-medium text-orange-100">
              CI/CD
            </span>
            <div>
              <h4 className="text-xl font-semibold text-white">
                이 프로젝트는 GitLab runner보다 로컬 gate와 GitLab canonical
                delivery를 우선합니다.
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                실제 운영 방식은 pre-commit, pre-push, local Docker CI, GitLab
                main, Vercel production auto deploy 순서입니다. 공개 GitHub는
                배포 채널이 아니라 필요할 때만 동기화하는 snapshot 경로입니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {DELIVERY_PRINCIPLES.map((principle) => (
          <PrincipleCard
            key={principle.title}
            title={principle.title}
            description={principle.description}
            style={principle.style}
            icon={principle.icon}
          />
        ))}
      </section>

      {diagram && (
        <section className="rounded-2xl border border-white/10 bg-slate-950/45 p-5">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-white/45">
              Delivery Flow
            </p>
            <h4 className="mt-2 text-xl font-semibold text-white">
              {diagram.title}
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              {diagram.description}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {PIPELINE_STEPS.map((step) => (
              <article
                key={step.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <p className="text-xs uppercase tracking-wide text-white/45">
                  {step.eyebrow}
                </p>
                <h5 className="mt-2 text-base font-semibold text-white">
                  {step.title}
                </h5>
                <code className="mt-3 block rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-cyan-200">
                  {step.command}
                </code>
                <p className="mt-3 text-sm leading-relaxed text-white/70">
                  {step.detail}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-black/20 p-2 text-sky-200">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/45">
              Decision Rules
            </p>
            <h4 className="text-lg font-semibold text-white">
              현재 저장소에서 실제로 쓰는 선택 기준
            </h4>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {DECISION_RULES.map((rule) => (
            <div
              key={rule.label}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
            >
              <p className="text-xs uppercase tracking-wide text-white/45">
                {rule.label}
              </p>
              <p className="mt-2 text-sm font-medium text-white/85">
                {rule.value}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
