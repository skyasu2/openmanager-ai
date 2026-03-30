'use client';

import {
  BadgeCheck,
  ExternalLink,
  FileCheck2,
  Gauge,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { VIBE_CODING_ARCHITECTURE } from '@/data/architecture-diagrams/vibe-coding';
import type { ArchitectureDiagram } from '@/data/architecture-diagrams.types';
import {
  QA_EVIDENCE_ANCHORS,
  QA_EVIDENCE_CTA_LINKS,
  QA_EVIDENCE_LABELS,
} from '@/data/qa-evidence';
import validationEvidenceJson from '../../../public/data/qa/validation-evidence.json';

type ValidationEvidenceSnapshot = {
  publicEvidenceUpdated: {
    short: string;
    long: string;
  };
  latestProofRecorded: {
    short: string;
    long: string;
  };
  summary: {
    totalRuns: number;
    totalChecks: number;
    completedItems: number;
    expertDomainsOpenGaps: number;
  };
  latestProofRun: {
    runId: string;
    title: string;
    scope: string;
    commitSha: string;
    ciRunLink: {
      label?: string;
      url?: string;
    } | null;
  };
};

const FINISH_PILLARS = [
  {
    title: 'Production-backed QA',
    description:
      '로컬 스모크에서 끝내지 않고 Vercel 실환경 기준으로 핵심 흐름을 검증합니다.',
    icon: ShieldCheck,
    style: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  },
  {
    title: 'Tracked Finish',
    description:
      'QA run, 체크 수, 완료 항목이 누적 기록돼 회귀와 마무리 수준을 추적할 수 있습니다.',
    icon: FileCheck2,
    style: 'border-sky-500/20 bg-sky-500/10 text-sky-200',
  },
  {
    title: 'Evidence-linked',
    description:
      'Validation page, latest proof run, public snapshot JSON으로 결과를 바로 확인할 수 있습니다.',
    icon: BadgeCheck,
    style: 'border-purple-500/20 bg-purple-500/10 text-purple-200',
  },
] as const;

const DELIVERY_FLOW_STEPS = [
  {
    icon: '🌌',
    eyebrow: 'Local Dev',
    title: 'WSL + Claude Code',
    detail: 'AI-first build loop',
  },
  {
    icon: '🪝',
    eyebrow: 'Gate 1',
    title: 'Pre-commit Hook',
    detail: 'Biome format + lint',
  },
  {
    icon: '🐋',
    eyebrow: 'Gate 2',
    title: 'Local Docker CI',
    detail: 'type-check + test + smoke',
  },
  {
    icon: '🦊',
    eyebrow: 'Canonical',
    title: 'GitLab Main',
    detail: 'single source of truth',
  },
  {
    icon: '▲',
    eyebrow: 'Deploy',
    title: 'Vercel Production',
    detail: 'auto deploy from main',
  },
  {
    icon: '🧪',
    eyebrow: 'Proof',
    title: 'Validation Evidence',
    detail: 'Playwright proof + snapshot',
  },
  {
    icon: '🐙',
    eyebrow: 'Optional',
    title: 'GitHub Snapshot',
    detail: 'public code export',
  },
] as const;

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-xs uppercase tracking-wide text-white/55">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

export function VibeFinishSection({
  diagram,
}: {
  diagram?: ArchitectureDiagram | null;
}) {
  const evidence = validationEvidenceJson as ValidationEvidenceSnapshot;
  const deliveryDiagram = diagram ?? VIBE_CODING_ARCHITECTURE;
  const latestProofUrl = evidence.latestProofRun.ciRunLink?.url ?? null;
  const shortCommit = evidence.latestProofRun.commitSha.slice(0, 10);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-amber-500/25 bg-linear-to-br from-amber-500/15 via-orange-500/10 to-transparent p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-200">
            <Gauge className="h-6 w-6" />
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-100">
                QA / Finish
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                {QA_EVIDENCE_LABELS.badge}
              </span>
            </div>
            <div>
              <h4 className="text-xl font-semibold text-white">
                빠르게 만드는 데서 끝내지 않고, 실환경 검증까지 마무리했습니다.
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                이 프로젝트는 구현 후 Vercel production 기준 QA, Playwright 기반
                검증, 누적 추적 기록까지 포함해 정리했습니다. 아래 수치는 현재
                배포에 포함된 public validation snapshot 기준입니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Snapshot Updated"
          value={evidence.publicEvidenceUpdated.short}
          tone="border-white/10 bg-white/5"
        />
        <StatCard
          label="Total Runs"
          value={evidence.summary.totalRuns}
          tone="border-sky-500/15 bg-sky-500/10"
        />
        <StatCard
          label="Total Checks"
          value={evidence.summary.totalChecks}
          tone="border-emerald-500/15 bg-emerald-500/10"
        />
        <StatCard
          label="Open Gaps"
          value={evidence.summary.expertDomainsOpenGaps}
          tone="border-purple-500/15 bg-purple-500/10"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FINISH_PILLARS.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <article
              key={pillar.title}
              className={`rounded-2xl border p-4 ${pillar.style}`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-black/15 p-2 text-current">
                  <Icon className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-white">
                  {pillar.title}
                </h4>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/75">
                {pillar.description}
              </p>
            </article>
          );
        })}
      </section>

      {deliveryDiagram && (
        <section className="rounded-2xl border border-white/10 bg-slate-950/45 p-5">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-white/45">
              Delivery Flow
            </p>
            <h4 className="mt-2 text-xl font-semibold text-white">
              {deliveryDiagram.title}
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              {deliveryDiagram.description}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {DELIVERY_FLOW_STEPS.map((step, index) => (
              <article
                key={step.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-white/45">
                      {step.eyebrow}
                    </p>
                    <h5 className="mt-2 text-base font-semibold text-white">
                      {step.title}
                    </h5>
                  </div>
                  <span className="text-2xl leading-none">{step.icon}</span>
                </div>
                <p className="mt-3 text-sm text-white/70">{step.detail}</p>
                {index < DELIVERY_FLOW_STEPS.length - 1 && (
                  <p className="mt-4 text-xs font-medium uppercase tracking-wide text-amber-300/80">
                    next step
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/45">
              Latest Proof Run
            </p>
            <h4 className="mt-2 text-xl font-semibold text-white">
              {evidence.latestProofRun.runId}
            </h4>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              {evidence.latestProofRun.title}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75">
            <p>recorded: {evidence.latestProofRecorded.long}</p>
            <p className="mt-1">scope: {evidence.latestProofRun.scope}</p>
            <p className="mt-1 font-mono text-white/60">
              commit: {shortCommit}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={QA_EVIDENCE_CTA_LINKS.overviewHref}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/85 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            Validation Evidence
          </Link>
          <Link
            href={`${QA_EVIDENCE_CTA_LINKS.overviewHref}#${QA_EVIDENCE_ANCHORS.latestProofRun}`}
            className="rounded-full border border-sky-400/25 bg-sky-500/10 px-4 py-2 text-sm text-sky-200 transition hover:border-sky-300/40 hover:bg-sky-500/15"
          >
            Latest Proof Run
          </Link>
          <a
            href={QA_EVIDENCE_CTA_LINKS.publicSnapshotHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 transition hover:border-emerald-300/40 hover:bg-emerald-500/15"
          >
            Public Snapshot JSON
          </a>
          {latestProofUrl && (
            <a
              href={latestProofUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-purple-400/25 bg-purple-500/10 px-4 py-2 text-sm text-purple-200 transition hover:border-purple-300/40 hover:bg-purple-500/15"
            >
              <span>
                {evidence.latestProofRun.ciRunLink?.label ??
                  'GitHub Actions evidence run'}
              </span>
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </section>

      <p className="text-sm leading-relaxed text-white/60">
        현재 snapshot 기준: {evidence.publicEvidenceUpdated.long} 업데이트,
        completed items {evidence.summary.completedItems}, expert open gaps{' '}
        {evidence.summary.expertDomainsOpenGaps}.
      </p>
    </div>
  );
}
