import type { Metadata } from 'next';
import Link from 'next/link';
import { OpenManagerLogo } from '@/components/shared/OpenManagerLogo';
import { PAGE_BACKGROUNDS } from '@/styles/design-constants';
import {
  QA_EVIDENCE,
  QA_EVIDENCE_ANCHORS,
  QA_EVIDENCE_CTA_LINKS,
} from '@/data/qa-evidence';

export const metadata: Metadata = {
  title: 'Validation Evidence | OpenManager AI',
  description:
    'Production QA status, latest proof run, and CI artifact evidence for OpenManager AI.',
};

function EvidencePill({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs sm:text-sm ${className}`}
    >
      {children}
    </span>
  );
}

export default function ValidationEvidencePage() {
  return (
    <div className={`min-h-screen ${PAGE_BACKGROUNDS.DARK_PAGE_BG}`}>
      <div className="wave-particles" />

      <header className="relative z-50 flex items-center justify-between p-4 sm:p-6">
        <OpenManagerLogo
          variant="dark"
          href="/"
          titleAs="p"
          showSubtitle={false}
        />
        <Link
          href="/"
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
        >
          첫 화면으로
        </Link>
      </header>

      <main className="container relative z-10 mx-auto max-w-5xl px-4 pb-20 pt-6 sm:px-6">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <EvidencePill className="border-emerald-400/30 bg-emerald-500/10 text-emerald-200">
              Validated on Production · {QA_EVIDENCE.validatedOnShort}
            </EvidencePill>
            <EvidencePill className="border-sky-400/25 bg-sky-500/10 text-sky-200">
              QA completed {QA_EVIDENCE.qaSummary.completedItems}
            </EvidencePill>
            <EvidencePill className="border-purple-400/25 bg-purple-500/10 text-purple-200">
              open-gaps {QA_EVIDENCE.qaSummary.expertOpenGaps}
            </EvidencePill>
          </div>

          <h1 className="mt-5 text-3xl font-bold text-white sm:text-4xl">
            Validation Evidence
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/75 sm:text-base">
            이 페이지는 첫 화면에서 보이는 production validation CTA의 실제
            근거를 모아 둔 internal evidence summary입니다. 외부 방문자가 404 없이
            검증 기준을 이해할 수 있도록 요약만 노출하고, 세부 증거는 CI run과
            in-repo SSOT 경로로 설명합니다.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={QA_EVIDENCE_CTA_LINKS.ciHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-sky-400/25 bg-sky-500/10 px-4 py-2 text-sm text-sky-200 transition hover:border-sky-300/40 hover:bg-sky-500/15"
            >
              GitHub Actions evidence run
            </a>
            <Link
              href={`#${QA_EVIDENCE_ANCHORS.qaStatus}`}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
            >
              QA status 요약 보기
            </Link>
            <Link
              href={`#${QA_EVIDENCE_ANCHORS.latestProofRun}`}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
            >
              최신 proof run 보기
            </Link>
          </div>
        </section>

        <section
          id={QA_EVIDENCE_ANCHORS.qaStatus}
          className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-6 sm:p-8"
        >
          <h2 className="text-2xl font-semibold text-white">QA Status</h2>
          <p className="mt-2 text-sm text-white/70">
            QA SSOT는 저장소 내 `reports/qa/QA_STATUS.md`와 `qa-tracker.json`
            입니다. live 사이트에서는 핵심 운영 수치만 요약합니다.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/50">
                Total runs
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {QA_EVIDENCE.qaSummary.totalRuns}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/50">
                Total checks
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {QA_EVIDENCE.qaSummary.totalChecks}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/50">
                Completed
              </p>
              <p className="mt-2 text-2xl font-semibold text-emerald-300">
                {QA_EVIDENCE.qaSummary.completedItems}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/50">
                Wont-fix
              </p>
              <p className="mt-2 text-2xl font-semibold text-amber-300">
                {QA_EVIDENCE.qaSummary.wontFixItems}
              </p>
            </div>
          </div>

          <p className="mt-5 text-sm text-white/65">
            Source of truth in repository:{' '}
            <code>{QA_EVIDENCE.repoEvidence.qaStatusPath}</code>
          </p>
        </section>

        <section
          id={QA_EVIDENCE_ANCHORS.latestProofRun}
          className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-6 sm:p-8"
        >
          <h2 className="text-2xl font-semibold text-white">Latest Proof Run</h2>
          <p className="mt-2 text-sm text-white/70">
            가장 최근의 CI-backed feedback trace proof는 manual workflow run과
            연결되어 있습니다.
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-wide text-white/50">
              Run ID
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {QA_EVIDENCE.latestProofRun.runId}
            </p>
            <p className="mt-3 text-sm text-white/75">
              {QA_EVIDENCE.latestProofRun.title}
            </p>

            <dl className="mt-5 grid gap-4 text-sm text-white/75 sm:grid-cols-2">
              <div>
                <dt className="text-white/45">Scope</dt>
                <dd className="mt-1">{QA_EVIDENCE.latestProofRun.scope}</dd>
              </div>
              <div>
                <dt className="text-white/45">Commit</dt>
                <dd className="mt-1 font-mono">
                  {QA_EVIDENCE.latestProofRun.commitSha}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={QA_EVIDENCE.latestProofRun.ciRunUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-sky-400/25 bg-sky-500/10 px-4 py-2 text-sm text-sky-200 transition hover:border-sky-300/40 hover:bg-sky-500/15"
              >
                Actions run #{QA_EVIDENCE.latestProofRun.ciRunId}
              </a>
            </div>

            <ul className="mt-5 space-y-2 text-sm text-white/70">
              {QA_EVIDENCE.latestProofRun.ciArtifacts.map((artifact) => (
                <li key={artifact} className="rounded-xl bg-white/5 px-3 py-2">
                  artifact: <code>{artifact}</code>
                </li>
              ))}
            </ul>

            <p className="mt-5 text-sm text-white/65">
              Source of truth in repository:{' '}
              <code>{QA_EVIDENCE.repoEvidence.latestProofRunPath}</code>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
