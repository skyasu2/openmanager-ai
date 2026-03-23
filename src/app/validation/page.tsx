import type { Metadata } from 'next';
import Link from 'next/link';
import { OpenManagerLogo } from '@/components/shared/OpenManagerLogo';
import {
  QA_EVIDENCE_ANCHORS,
  QA_EVIDENCE_CTA_LINKS,
  QA_EVIDENCE_LABELS,
} from '@/data/qa-evidence';
import { PAGE_BACKGROUNDS } from '@/styles/design-constants';
import validationEvidenceJson from '../../../public/data/qa/validation-evidence.json';

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

type ValidationEvidenceSummary = {
  totalRuns: number;
  totalChecks: number;
  completedItems: number;
  expertDomainsOpenGaps: number;
  wontFixItems: number;
  lastRecordedAt?: string;
};

type QATrackerLink = {
  type?: string;
  label?: string;
  url?: string;
  note?: string;
};

type QATrackerRun = {
  runId: string;
  title: string;
  scope: string;
  recordedAt?: string | null;
  commitSha: string;
  repoPath: string;
  ciRunLink: QATrackerLink | null;
  ciArtifactLinks: QATrackerLink[];
};

type ValidationEvidenceDate = {
  iso?: string | null;
  short: string;
  long: string;
};

type ValidationEvidenceSnapshot = {
  version: string;
  generatedAt: string;
  source: {
    trackerPath: string;
    statusPath: string;
    publicPath: string;
    publicHref: string;
    latestRunId: string;
  };
  summary: ValidationEvidenceSummary;
  trackerUpdated: ValidationEvidenceDate;
  latestProofRecorded: ValidationEvidenceDate;
  latestProofRun: QATrackerRun;
};

function getSnapshotAgeDays(generatedAt: string): number {
  const now = Date.now();
  const generated = new Date(generatedAt).getTime();
  return Math.floor((now - generated) / (1000 * 60 * 60 * 24));
}

export default function ValidationEvidencePage() {
  const evidence = validationEvidenceJson as ValidationEvidenceSnapshot;
  const snapshotAgeDays = getSnapshotAgeDays(evidence.generatedAt);
  const isStale = snapshotAgeDays >= 7;

  return (
    <div className={`min-h-screen ${PAGE_BACKGROUNDS.DARK_PAGE_BG}`}>
      <div className="wave-particles" />

      {isStale && (
        <div className="relative z-50 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-300">
          ⚠️ 이 스냅샷은 {snapshotAgeDays}일 전 빌드 기준입니다. 최신 QA 기록은
          저장소의 <code className="font-mono">reports/qa/QA_STATUS.md</code>를
          참조하세요.
        </div>
      )}

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
              {QA_EVIDENCE_LABELS.badge}
            </EvidencePill>
            <EvidencePill className="border-sky-400/25 bg-sky-500/10 text-sky-200">
              Tracker updated {evidence.trackerUpdated.short}
            </EvidencePill>
            <EvidencePill className="border-indigo-400/25 bg-indigo-500/10 text-indigo-200">
              Latest CI proof {evidence.latestProofRecorded.short}
            </EvidencePill>
            <EvidencePill className="border-amber-400/25 bg-amber-500/10 text-amber-200">
              Deployed snapshot
            </EvidencePill>
            <EvidencePill className="border-cyan-400/25 bg-cyan-500/10 text-cyan-200">
              QA completed {evidence.summary.completedItems}
            </EvidencePill>
            <EvidencePill className="border-purple-400/25 bg-purple-500/10 text-purple-200">
              open-gaps {evidence.summary.expertDomainsOpenGaps}
            </EvidencePill>
          </div>

          <h1 className="mt-5 text-3xl font-bold text-white sm:text-4xl">
            Validation Evidence
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/75 sm:text-base">
            이 페이지는 첫 화면에서 보이는 production validation CTA의 실제
            근거를 모아 둔 internal evidence summary입니다. 외부 방문자가 404
            없이 검증 기준을 이해할 수 있도록 요약만 노출하고, 세부 증거는 CI
            run과 public snapshot artifact로 설명합니다. 현재 화면은 live 배포에
            함께 포함된 QA evidence JSON을 읽으며, 저장소의 더 최신 QA 기록은
            다음 재배포 전까지 자동 반영되지 않습니다. 현재 화면은{' '}
            {evidence.trackerUpdated.long} 기준 QA tracker snapshot과{' '}
            {evidence.latestProofRecorded.long} 기준 CI-backed proof run을 함께
            보여줍니다.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {evidence.latestProofRun.ciRunLink?.url && (
              <a
                href={evidence.latestProofRun.ciRunLink.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-sky-400/25 bg-sky-500/10 px-4 py-2 text-sm text-sky-200 transition hover:border-sky-300/40 hover:bg-sky-500/15"
              >
                GitHub Actions evidence run
              </a>
            )}
            <a
              href={QA_EVIDENCE_CTA_LINKS.publicSnapshotHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 transition hover:border-emerald-300/40 hover:bg-emerald-500/15"
            >
              Public snapshot JSON
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
            입니다. live 사이트에서는 현재 배포에 포함된 public snapshot 기준
            핵심 운영 수치만 요약합니다.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/50">
                Total runs
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {evidence.summary.totalRuns}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/50">
                Total checks
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {evidence.summary.totalChecks}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/50">
                Completed
              </p>
              <p className="mt-2 text-2xl font-semibold text-emerald-300">
                {evidence.summary.completedItems}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/50">
                Wont-fix
              </p>
              <p className="mt-2 text-2xl font-semibold text-amber-300">
                {evidence.summary.wontFixItems}
              </p>
            </div>
          </div>

          <p className="mt-5 text-sm text-white/65">
            Public snapshot artifact: <code>{evidence.source.publicPath}</code>
          </p>
        </section>

        <section
          id={QA_EVIDENCE_ANCHORS.latestProofRun}
          className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-6 sm:p-8"
        >
          <h2 className="text-2xl font-semibold text-white">
            Latest Proof Run
          </h2>
          <p className="mt-2 text-sm text-white/70">
            가장 최근의 CI-backed feedback trace proof는 manual workflow run과
            연결되어 있습니다. 이 값도 현재 배포에 포함된 public snapshot
            artifact 기준으로 렌더링됩니다.
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-wide text-white/50">
              Run ID
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {evidence.latestProofRun.runId}
            </p>
            <p className="mt-3 text-sm text-white/75">
              {evidence.latestProofRun.title}
            </p>

            <dl className="mt-5 grid gap-4 text-sm text-white/75 sm:grid-cols-2">
              <div>
                <dt className="text-white/45">Scope</dt>
                <dd className="mt-1">{evidence.latestProofRun.scope}</dd>
              </div>
              <div>
                <dt className="text-white/45">Recorded at</dt>
                <dd className="mt-1">{evidence.latestProofRecorded.long}</dd>
              </div>
              <div>
                <dt className="text-white/45">Commit</dt>
                <dd className="mt-1 font-mono">
                  {evidence.latestProofRun.commitSha}
                </dd>
              </div>
            </dl>

            {evidence.latestProofRun.ciRunLink?.url && (
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={evidence.latestProofRun.ciRunLink.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-sky-400/25 bg-sky-500/10 px-4 py-2 text-sm text-sky-200 transition hover:border-sky-300/40 hover:bg-sky-500/15"
                >
                  {evidence.latestProofRun.ciRunLink.label ??
                    'GitHub Actions evidence run'}
                </a>
              </div>
            )}

            <ul className="mt-5 space-y-2 text-sm text-white/70">
              {evidence.latestProofRun.ciArtifactLinks.map((artifact) => (
                <li
                  key={artifact.note ?? artifact.label ?? 'artifact'}
                  className="rounded-xl bg-white/5 px-3 py-2"
                >
                  artifact:{' '}
                  <code>
                    {artifact.label ?? artifact.note ?? 'download from run'}
                  </code>
                </li>
              ))}
            </ul>

            <p className="mt-5 text-sm text-white/65">
              Source of truth in repository:{' '}
              <code>{evidence.latestProofRun.repoPath}</code>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
