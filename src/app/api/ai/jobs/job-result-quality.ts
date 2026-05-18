export const MIN_SUBSTANTIVE_JOB_RESULT_CHARS = 50;
export const JOB_RESULT_QUALITY_FAILURE_MESSAGE =
  'AI job completed without a substantive response body.';

const TITLE_ONLY_PATTERN = /^#{1,6}\s*[^\n]+$/;
const PLACEHOLDER_RESULT_PATTERN =
  /^(완료|분석\s*완료|처리\s*완료|done|completed|result|결과)$/i;

export function getSubstantiveJobResultContent(
  result: string | null | undefined
): string | null {
  const content = typeof result === 'string' ? result.trim() : '';

  if (content.length < MIN_SUBSTANTIVE_JOB_RESULT_CHARS) {
    return null;
  }

  if (
    TITLE_ONLY_PATTERN.test(content) ||
    PLACEHOLDER_RESULT_PATTERN.test(content)
  ) {
    return null;
  }

  return content;
}

export function shouldFailCompletedJobResult(
  status: string,
  result: string | null | undefined
): boolean {
  return (
    status === 'completed' && getSubstantiveJobResultContent(result) === null
  );
}
