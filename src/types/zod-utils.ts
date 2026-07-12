import type * as z from 'zod';
import { getErrorMessage } from './type-utils';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: Record<string, string[]> };

export function validateData<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): ValidationResult<z.infer<T>> {
  try {
    const result = schema.safeParse(data);

    if (result.success) {
      return { success: true, data: result.data };
    }

    const formatted = formatZodErrors(result.error);
    return {
      success: false,
      error: formatted.message,
      details: formatted.details,
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

interface FormattedZodError {
  message: string;
  details: Record<string, string[]>;
}

export function formatZodErrors(error: z.ZodError): FormattedZodError {
  const details: Record<string, string[]> = {};
  const messages: string[] = [];

  error.issues.forEach((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';

    if (!details[path]) {
      details[path] = [];
    }

    details[path].push(issue.message);

    if (path === 'root') {
      messages.push(issue.message);
    } else {
      messages.push(`${path}: ${issue.message}`);
    }
  });

  return {
    message: messages.join(', '),
    details,
  };
}
