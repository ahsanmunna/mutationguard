/**
 * Shared error handler for API route handlers:
 *
 *   try { ... } catch (err) { return handleApiError(err, 'POST /api/transfers'); }
 *
 * It maps typed errors to 401/403/404/409/400, and unknown errors to a generic 500.
 * Only 500s are logged here (sanitized: connection strings are masked).
 */
import { NextResponse } from 'next/server';
import { toErrorResponse } from './errors';
import { sanitizeErrorMessage } from '../../db/safety';

export function handleApiError(err: unknown, context: string): NextResponse {
  const { status, body } = toErrorResponse(err);
  if (status >= 500) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[API ERROR] ${context}:`, sanitizeErrorMessage(reason));
  }
  return NextResponse.json(body, { status });
}
