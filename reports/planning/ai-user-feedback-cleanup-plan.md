# ai_user_feedback Cleanup Plan

## Objective
- Remove the legacy `public.ai_user_feedback` table and its dependent `public.ai_feedback_stats` view.
- Keep the active runtime contract on `public.ai_feedback` unchanged.

## Verified Facts
- `public.ai_feedback` exists and is used by `/api/ai/feedback`.
- `public.ai_user_feedback` exists with `0` rows.
- `public.ai_feedback_stats` depends on `public.ai_user_feedback`.
- No app code references `ai_user_feedback` or `ai_feedback_stats`.
- No foreign keys or SQL routines reference `ai_user_feedback`.

## Scope
1. Drop `public.ai_feedback_stats`.
2. Drop `public.ai_user_feedback`.
3. Verify `public.ai_feedback` remains intact.
4. Verify Supabase migration parity remains clean.

## Out of Scope
- Reworking `ai_feedback` RLS.
- Replacing `ai_feedback_stats` with a new analytics view.
- Orphan function cleanup.

## Validation
- `to_regclass('public.ai_user_feedback')` is null.
- `to_regclass('public.ai_feedback_stats')` is null.
- `public.ai_feedback` row count remains unchanged.
- `supabase migration list` stays aligned.
- `supabase db push --dry-run --linked` reports up to date.
