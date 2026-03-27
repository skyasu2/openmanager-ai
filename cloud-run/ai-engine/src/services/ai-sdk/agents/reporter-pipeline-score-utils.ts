interface ReportForScoreInput {
  title: string;
  summary: string;
  affectedServers: unknown[];
  timeline: unknown[];
  rootCause: unknown | null;
  suggestedActions: string[];
  warnings?: unknown[];
  predictions?: unknown[];
}

export function calculateStructureScore(report: ReportForScoreInput): number {
  let score = 0;
  if (report.title && report.title.length > 5) score += 0.15;
  if (report.summary && report.summary.length > 20) score += 0.15;
  if (report.affectedServers && report.affectedServers.length > 0) score += 0.15;
  if (report.timeline && report.timeline.length >= 3) score += 0.2;
  if (report.rootCause) score += 0.2;
  if (report.suggestedActions && report.suggestedActions.length >= 2) score += 0.15;
  if (report.predictions && report.predictions.length > 0) score += 0.1;
  return Math.min(score, 1.0);
}

export function calculateCompletenessScore(report: ReportForScoreInput): number {
  let filled = 0;
  let total = 6;
  if (report.title.length > 0) filled++;
  if (report.summary.length > 0) filled++;
  if (report.affectedServers.length > 0) filled++;
  if (report.timeline.length > 0) filled++;
  if (report.rootCause !== null) filled++;
  if (report.suggestedActions.length > 0) filled++;
  // Optional fields: reward if present, no penalty if absent
  if (report.warnings && report.warnings.length > 0) { filled++; total++; }
  if (report.predictions && report.predictions.length > 0) { filled++; total++; }
  return filled / total;
}

export function calculateActionabilityScore(actions: string[]): number {
  if (!actions || actions.length === 0) return 0;
  let score = 0.3 * Math.min(actions.length / 3, 1);
  const hasCommands = actions.some((a) => /`[^`]+`|^\$|^sudo/.test(a));
  if (hasCommands) score += 0.4;
  return Math.min(score + 0.2, 1);
}
