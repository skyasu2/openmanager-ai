import type { Metadata } from 'next';
import Link from 'next/link';
import '../landing-effects.css';
import { OpenManagerLogo } from '@/components/shared/OpenManagerLogo';
import {
  QA_EVIDENCE_ANCHORS,
  QA_EVIDENCE_CTA_LINKS,
  QA_EVIDENCE_LABELS,
} from '@/data/qa-evidence';
import { PAGE_BACKGROUNDS } from '@/styles/design-constants';
import validationEvidenceJson from '../../../public/data/qa/validation-evidence.json';
import { ValidationSnapshotStaleBanner } from './ValidationSnapshotStaleBanner';

export const metadata: Metadata = {
  title: 'Validation Evidence',
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
  publicEvidenceUpdated: ValidationEvidenceDate;
  latestProofRecorded: ValidationEvidenceDate;
  latestPublicRun: QATrackerRun;
  latestProofRun: QATrackerRun;
};

function RunReferenceCard({
  eyebrow,
  title,
  run,
  recordedAt,
  accentClassName,
  action,
}: {
  eyebrow: string;
  title: string;
  run: QATrackerRun;
  recordedAt: ValidationEvidenceDate;
  accentClassName: string;
  action?: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs uppercase tracking-wide text-white/50">{eyebrow}</p>
      <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
      <p className={`mt-4 text-2xl font-semibold ${accentClassName}`}>
        {run.runId}
      </p>
      <p className="mt-3 text-sm text-white/75">{run.title}</p>

      <dl className="mt-5 grid gap-4 text-sm text-white/75 sm:grid-cols-2">
        <div>
          <dt className="text-white/45">Scope</dt>
          <dd className="mt-1">{run.scope}</dd>
        </div>
        <div>
          <dt className="text-white/45">Recorded at</dt>
          <dd className="mt-1">{recordedAt.long}</dd>
        </div>
        <div>
          <dt className="text-white/45">Commit</dt>
          <dd className="mt-1 font-mono">{run.commitSha}</dd>
        </div>
      </dl>

      {action}

      <p className="mt-5 text-sm text-white/65">
        Source of truth in repository: <code>{run.repoPath}</code>
      </p>
    </article>
  );
}

function buildProofGapLabel(
  publicEvidenceUpdatedIso?: string | null,
  latestProofIso?: string | null
): string {
  if (!publicEvidenceUpdatedIso || !latestProofIso) {
    return '현재 배포에는 public validation snapshot과 latest CI proof가 함께 포함됩니다.';
  }

  const publicEvidenceUpdated = new Date(publicEvidenceUpdatedIso).getTime();
  const latestProof = new Date(latestProofIso).getTime();

  if (
    Number.isNaN(publicEvidenceUpdated) ||
    Number.isNaN(latestProof) ||
    publicEvidenceUpdated === latestProof
  ) {
    return '현재 배포에는 public validation snapshot과 latest CI proof가 같은 기준 시점으로 포함됩니다.';
  }

  const publicEvidenceDate = new Date(publicEvidenceUpdatedIso)
    .toISOString()
    .slice(0, 10);
  const latestProofDate = new Date(latestProofIso).toISOString().slice(0, 10);
  const rawDiffDays = Math.abs(
    Math.round((publicEvidenceUpdated - latestProof) / (1000 * 60 * 60 * 24))
  );
  const diffDays =
    rawDiffDays === 0 && publicEvidenceDate !== latestProofDate
      ? 1
      : rawDiffDays;

  if (publicEvidenceUpdated > latestProof) {
    return `Public validation snapshot이 latest CI proof보다 ${diffDays}일 더 최신입니다. 저장소 전체 QA tracker는 더 자주 갱신될 수 있습니다.`;
  }

  return `Latest CI proof가 public validation snapshot보다 ${diffDays}일 더 최신입니다. 현재 배포에는 직전 public snapshot 기준 요약이 포함돼 있습니다.`;
}

export default function ValidationEvidencePage() {
  const evidence = validationEvidenceJson as ValidationEvidenceSnapshot;
  const proofGapLabel = buildProofGapLabel(
    evidence.publicEvidenceUpdated.iso,
    evidence.latestProofRecorded.iso
  );

  return (
    <div className={`min-h-screen ${PAGE_BACKGROUNDS.DARK_PAGE_BG}`}>
      <div className="wave-particles" />

      <ValidationSnapshotStaleBanner generatedAt={evidence.generatedAt} />

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
            <EvidencePill className="border-emerald-300/20 bg-emerald-500/5 text-emerald-100">
              Snapshot updated {evidence.publicEvidenceUpdated.short}
            </EvidencePill>
            <EvidencePill className="border-indigo-400/25 bg-indigo-500/10 text-indigo-200">
              Latest CI proof {evidence.latestProofRecorded.short}
            </EvidencePill>
            <EvidencePill className="border-cyan-400/25 bg-cyan-500/10 text-cyan-200">
              Status: production-backed
            </EvidencePill>
            <EvidencePill className="border-purple-400/25 bg-purple-500/10 text-purple-200">
              Open gaps {evidence.summary.expertDomainsOpenGaps}
            </EvidencePill>
            <EvidencePill className="border-white/15 bg-white/5 text-white/75">
              Snapshot run {evidence.latestPublicRun.runId}
            </EvidencePill>
            <EvidencePill className="border-white/15 bg-white/5 text-white/75">
              CI proof {evidence.latestProofRun.runId}
            </EvidencePill>
          </div>

          <h1 className="mt-5 text-3xl font-bold text-white sm:text-4xl">
            Validation Evidence
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/75 sm:text-base">
            이 페이지는 두 기준을 함께 보여줍니다. 현재 배포에 포함된 최신
            public QA snapshot run과, 별도로 유지되는 최신 CI-backed proof run
            근거를 함께 요약하는 evidence summary입니다. 랜딩 메인 CTA가 아니라
            배포 검증 근거를 분리해서 공개하는 보조 검증 화면이며, 모달형 소개
            콘텐츠와는 독립적으로 유지됩니다.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/65">
            저장소의 더 최신 QA 기록은 다음 재배포 전까지 자동 반영되지
            않습니다. 현재 화면은 {evidence.publicEvidenceUpdated.long} 기준
            public validation snapshot과 {evidence.latestProofRecorded.long}{' '}
            기준 CI-backed proof를 함께 보여줍니다.
          </p>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75">
            <span className="font-medium text-white/90">Snapshot note:</span>{' '}
            {proofGapLabel}
          </div>

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
              snapshot / CI proof 보기
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
                Snapshot updated
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {evidence.publicEvidenceUpdated.short}
              </p>
            </div>
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
          </div>

          <p className="mt-4 text-sm text-white/60">
            Tracker aggregate updated {evidence.trackerUpdated.short}. Known
            limitations tracked separately: {evidence.summary.wontFixItems}{' '}
            items
          </p>

          <p className="mt-3 text-sm text-white/65">
            Public snapshot artifact: <code>{evidence.source.publicPath}</code>
          </p>
        </section>

        <section
          id={QA_EVIDENCE_ANCHORS.latestProofRun}
          className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-6 sm:p-8"
        >
          <h2 className="text-2xl font-semibold text-white">
            Snapshot / Proof Run
          </h2>
          <p className="mt-2 text-sm text-white/70">
            이 섹션은 현재 배포에 포함된 latest public snapshot run과 별도로
            유지되는 latest CI-backed proof run을 나눠서 보여줍니다. 숫자 요약은
            snapshot 기준이고, 아래 proof run은 CI artifact 근거를 직접
            가리킵니다.
          </p>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <RunReferenceCard
              eyebrow="Latest public snapshot run"
              title="현재 배포에 포함된 snapshot 기준"
              run={evidence.latestPublicRun}
              recordedAt={evidence.publicEvidenceUpdated}
              accentClassName="text-emerald-300"
            />

            <RunReferenceCard
              eyebrow="Latest CI-backed proof run"
              title="CI artifact 근거로 유지하는 proof 기준"
              run={evidence.latestProofRun}
              recordedAt={evidence.latestProofRecorded}
              accentClassName="text-sky-300"
              action={
                <>
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
                          {artifact.label ??
                            artifact.note ??
                            'download from run'}
                        </code>
                      </li>
                    ))}
                  </ul>
                </>
              }
            />
          </div>
        </section>
      </main>
    </div>
  );
}
