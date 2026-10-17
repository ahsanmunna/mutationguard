import { describe, it, expect } from 'vitest';
import {
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
  NotFoundError,
  ConflictError,
  BlockedActionError,
  toErrorResponse,
} from '../../src/lib/errors';

describe('toErrorResponse: every error becomes the right, safe HTTP response', () => {
  it('maps unauthenticated to 401 and wrong role to 403 (never 400/500)', () => {
    expect(toErrorResponse(new UnauthorizedError()).status).toBe(401);
    const forbidden = toErrorResponse(new ForbiddenError('FORBIDDEN: secret detail'));
    expect(forbidden.status).toBe(403);
    // generic message: the internal detail is not echoed to the client
    expect(forbidden.body.error).not.toContain('secret detail');
  });

  it('maps client mistakes to 400 / 404 and conflicts to 409', () => {
    expect(toErrorResponse(new BadRequestError('bad')).status).toBe(400);
    expect(toErrorResponse(new NotFoundError('missing')).status).toBe(404);
    expect(toErrorResponse(new ConflictError('dup')).status).toBe(409);
  });

  it('maps a blocked workflow action to 409 with code BLOCKED', () => {
    const err = new BlockedActionError('skipped stage', 'BLOCKED_TRANSITION', 'TR-1', 'transfer', { a: 1 });
    const res = toErrorResponse(err);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BLOCKED');
    expect(err.eventType).toBe('BLOCKED_TRANSITION');
  });

  it('maps a leaked PostgreSQL unique violation to 409, not a crash', () => {
    const res = toErrorResponse({ code: '23505', constraint: 'one_active_transfer_per_parcel' });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('active transfer');
  });

  it('hides unknown error details behind a generic 500', () => {
    const res = toErrorResponse(new Error('password authentication failed for user "postgres"'));
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    expect(JSON.stringify(res.body)).not.toContain('postgres');
  });
});
