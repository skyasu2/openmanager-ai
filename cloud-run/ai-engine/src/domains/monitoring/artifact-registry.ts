export const MONITORING_ARTIFACT_KINDS = [
  'server-snapshot',
  'incident-report',
  'monitoring-analysis',
  'ops-procedure',
] as const;

export type MonitoringArtifactKind = (typeof MONITORING_ARTIFACT_KINDS)[number];

export function detectMonitoringArtifactKind(
  query: string
): MonitoringArtifactKind | undefined {
  if (
    /(server\s*snapshot|서버\s*상태\s*스냅샷|인프라\s*상태\s*카드|snapshot\s*export)/iu.test(
      query
    )
  ) {
    return MONITORING_ARTIFACT_KINDS[0];
  }

  if (
    /(incident\s*report\s*artifact|incident\s*card|장애\s*리포트\s*카드|사고\s*보고서\s*카드)/iu.test(
      query
    )
  ) {
    return MONITORING_ARTIFACT_KINDS[1];
  }

  if (
    /(monitoring\s*analysis\s*artifact|monitoring\s*card|모니터링\s*분석\s*카드)/iu.test(
      query
    )
  ) {
    return MONITORING_ARTIFACT_KINDS[2];
  }

  if (
    /(ops\s*procedure|운영\s*절차|runbook|런북|alertmanager|slack\s*alert|슬랙\s*알림\s*(스크립트|규칙|설정))/iu.test(
      query
    )
  ) {
    return MONITORING_ARTIFACT_KINDS[3];
  }

  return undefined;
}
