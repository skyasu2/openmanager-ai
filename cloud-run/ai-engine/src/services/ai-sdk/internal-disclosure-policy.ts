export type InternalDisclosureMode = 'user' | 'developer';

const INTERNAL_PATH_DISCLOSURE_MODEL_ID = 'internal-path-policy';

const INTERNAL_IMPLEMENTATION_SUBJECT_PATTERN =
  /openmanager|codex|gpt|ai\s*engine|어시스턴트|assistant|너|네|니|당신|봇|모델|프로젝트|저장소|repo|repository|코드베이스|소스\s*코드|source\s*code|otel|pre-generated|ssot|single\s*source\s*of\s*truth|로더|loader|지식베이스|knowledge\s*base/i;

const INTERNAL_PATH_TARGET_PATTERN =
  /내부\s*(자료|문서|파일|경로|데이터|저장소|상태)|파일\s*경로|자료\s*경로|데이터\s*경로|문서\s*경로|저장\s*경로|repo\s*path|repository\s*path|source\s*path|경로|위치|파일|소스|코드|구현|정의|path|file|source|code|implementation|defined|config|환경\s*변수|\benv\b|secret|system\s*prompt|시스템\s*프롬프트/i;

const DISCLOSURE_ACTION_PATTERN =
  /알려|말해|보여|공개|노출|나열|어디|어느|어떤|무슨|위치|경로|정의|구현|있는|있어|돼|되어|path|file|source|code|defined|implemented|찾아|근거|출처|자료|파일/i;

const DIRECT_INTERNAL_PATH_PATTERN =
  /(?:내부|repo|repository|저장소|코드|소스|파일|문서|자료|데이터|ssot|otel|pre-generated|loader|로더).{0,32}(?:경로|위치|파일|소스|코드|구현|정의|path|file|source|code|defined|implemented)|(?:경로|위치|파일|소스|코드|구현|정의|path|file|source|code|defined|implemented).{0,32}(?:내부|repo|repository|저장소|코드|소스|파일|문서|자료|데이터|ssot|otel|pre-generated|loader|로더)/i;

const INTERNAL_SECRET_SUBJECT_PATTERN =
  /openmanager|ai\s*engine|어시스턴트|assistant|너|당신|봇|모델|프로젝트|저장소|repo|repository|코드베이스|시스템|system|cloud\s*run|vercel|runtime|런타임|프로덕션|production/i;

const KOREAN_ASSISTANT_POSSESSIVE_PATTERN =
  /(^|[\s"'`“‘])(?:네|니)(?:$|[\s가의는])/i;

const INTERNAL_SECRET_TARGET_PATTERN =
  /환경\s*변수|\benv\b|process\.env|secret|secrets|시크릿|api\s*key|apikey|token|토큰|password|passwd|pwd|비밀번호|private\s*key|credential|credentials|인증\s*정보|접근\s*키|access\s*key/i;

const INTERNAL_SECRET_ACTION_PATTERN =
  /알려|말해|보여|공개|노출|나열|출력|조회|제공|dump|print|show|reveal|list|value|값/i;

const DIRECT_SECRET_ACTION_PATTERN =
  /알려|말해|보여|공개|노출|나열|출력|조회|확인|제공|dump|print|show|reveal|list|value|값/i;

const SECRET_NEGATION_PATTERN =
  /환경\s*변수(?:\s*값)?\s*(?:없이|말고|제외)|\benv\b\s*(?:없이|말고|제외|without|except)|without\s+env\b/i;

const EXPLICIT_SECRET_NAME_PATTERN =
  /\b[A-Z0-9_]*(?:SECRET|TOKEN|API_KEY|PASSWORD|PASSWD|PRIVATE_KEY|CREDENTIAL|AUTH)[A-Z0-9_]*\b/i;

export function isDeveloperDisclosureMode(
  mode?: InternalDisclosureMode
): boolean {
  return mode === 'developer';
}

export function isInternalImplementationPathRequest(query: string): boolean {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return false;

  if (DIRECT_INTERNAL_PATH_PATTERN.test(normalizedQuery)) {
    return true;
  }

  return (
    INTERNAL_IMPLEMENTATION_SUBJECT_PATTERN.test(normalizedQuery) &&
    INTERNAL_PATH_TARGET_PATTERN.test(normalizedQuery) &&
    DISCLOSURE_ACTION_PATTERN.test(normalizedQuery)
  );
}

export function isInternalSecretDisclosureRequest(query: string): boolean {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return false;

  if (
    EXPLICIT_SECRET_NAME_PATTERN.test(normalizedQuery) &&
    INTERNAL_SECRET_ACTION_PATTERN.test(normalizedQuery)
  ) {
    return true;
  }

  if (
    !SECRET_NEGATION_PATTERN.test(normalizedQuery) &&
    INTERNAL_SECRET_TARGET_PATTERN.test(normalizedQuery) &&
    DIRECT_SECRET_ACTION_PATTERN.test(normalizedQuery)
  ) {
    return true;
  }

  return (
    (INTERNAL_SECRET_SUBJECT_PATTERN.test(normalizedQuery) ||
      KOREAN_ASSISTANT_POSSESSIVE_PATTERN.test(normalizedQuery)) &&
    INTERNAL_SECRET_TARGET_PATTERN.test(normalizedQuery) &&
    INTERNAL_SECRET_ACTION_PATTERN.test(normalizedQuery)
  );
}

export function shouldRefuseInternalImplementationPathRequest(
  query: string,
  mode?: InternalDisclosureMode
): boolean {
  if (isInternalSecretDisclosureRequest(query)) {
    return true;
  }

  return (
    isInternalImplementationPathRequest(query) &&
    !isDeveloperDisclosureMode(mode)
  );
}

export function buildInternalSecretDisclosureRefusal(): string {
  return [
    '환경 변수 값, API 키, 토큰, 비밀번호, secret 같은 내부 인증 정보는 공개하거나 조회 방법을 대신 실행해 드릴 수 없습니다.',
    '',
    '대신 공개 가능한 범위의 실행 환경 상태, 대시보드 지표, 로그 해석, 안전한 진단 절차는 도와드릴 수 있습니다. 특정 장애나 서버 상태를 확인하려면 서버명과 관측 지표를 기준으로 질문해 주세요.',
  ].join('\n');
}

export function buildInternalImplementationPathRefusal(query?: string): string {
  if (query && isInternalSecretDisclosureRequest(query)) {
    return buildInternalSecretDisclosureRefusal();
  }

  return [
    '일반 사용자 모드에서는 내부 상태, 구현 파일 경로, 저장소 구조, 비공개 지식베이스 위치를 공개할 수 없습니다.',
    '',
    '대신 사용자 관점에서 확인 가능한 대시보드 지표, 로그, 알림, 공개 문서나 웹 출처 범위의 설명은 도와드릴 수 있습니다. 개발자 진단이 필요하면 별도 developer/debug 권한이 있는 운영 문서와 로그에서 확인해야 합니다.',
  ].join('\n');
}

export function buildInternalImplementationPathPolicyMetadata(durationMs = 0) {
  return {
    provider: 'deterministic',
    modelId: INTERNAL_PATH_DISCLOSURE_MODEL_ID,
    stepsExecuted: 0,
    durationMs,
  };
}
