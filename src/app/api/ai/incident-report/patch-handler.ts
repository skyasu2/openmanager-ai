/**
 * PATCH handler - Incident Report 상태 변경 (resolve 등)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import debug from '@/utils/debug';

export async function patchHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const allowedFields = [
      'status',
      'resolved_at',
      'resolution_notes',
      'resolution_actions',
    ] as const;

    type AllowedField = (typeof allowedFields)[number];
    const updates: Partial<Record<AllowedField, unknown>> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('incident_reports')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      debug.error('PATCH incident_reports error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, report: data });
  } catch (err) {
    debug.error('PATCH handler error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
