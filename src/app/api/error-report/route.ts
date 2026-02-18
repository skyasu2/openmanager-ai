import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';

const errorReportSchema = z.object({
  error: z.string().min(1),
  digest: z.string().optional(),
  stack: z.string().optional(),
  timestamp: z.string().optional(),
  page: z.string().optional(),
});

async function postHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = errorReportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid error report payload',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    logger.error('[error-report] client error reported', {
      message: payload.error,
      digest: payload.digest,
      page: payload.page,
      timestamp: payload.timestamp,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[error-report] failed to process request', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process error report',
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler);
