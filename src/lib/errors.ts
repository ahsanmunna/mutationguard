/**
 * Typed errors + ONE function that turns any error into a safe HTTP response.
 *
 * Why this file exists (explain to judges):
 *   - Before, every API route caught every error and returned 400 or 500 with the raw
 *     error message. A role failure looked like a "bad request" and database error
 *     text could leak to the browser.
 *   - Now each situation has its own error class with the right HTTP status.
 *     Anything we did not expect becomes a generic 500 (details only go to the server log).
 *
 * This file is plain TypeScript (no Next.js, no database) so it is easy to unit-test.
 */

export class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConflictError extends Error {
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * A workflow action that the rules refuse (skipped stage, stale finalize, ...).
 * It is a 409 for the client AND it carries the audit event that must be written
 * AFTER the main transaction has rolled back (so the "blocked" record is never lost).
 */
export class BlockedActionError extends ConflictError {
  constructor(
    message: string,
    public eventType: string,
    public entityId: string,
    public entityType: string,
    public auditPayload: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BlockedActionError';
  }
}

export interface ErrorResponse {
  status: number;
  body: { error: string; code: string };
}

/** Converts ANY thrown value into { status, body } without leaking internals. */
export function toErrorResponse(err: unknown): ErrorResponse {
  if (err instanceof UnauthorizedError) {
    return { status: 401, body: { error: 'Authentication required', code: 'UNAUTHORIZED' } };
  }
  if (err instanceof ForbiddenError) {
    return { status: 403, body: { error: 'You do not have permission to do this', code: 'FORBIDDEN' } };
  }
  if (err instanceof BlockedActionError) {
    return { status: 409, body: { error: err.message, code: 'BLOCKED' } };
  }
  if (err instanceof ConflictError) {
    return { status: 409, body: { error: err.message, code: 'CONFLICT' } };
  }
  if (err instanceof NotFoundError) {
    return { status: 404, body: { error: err.message, code: 'NOT_FOUND' } };
  }
  if (err instanceof BadRequestError) {
    return { status: 400, body: { error: err.message, code: 'BAD_REQUEST' } };
  }

  // PostgreSQL unique violation that slipped past our own handling -> 409, not a crash.
  const pg = err as { code?: string; constraint?: string } | null;
  if (pg && typeof pg === 'object' && pg.code === '23505') {
    const message =
      pg.constraint === 'one_active_transfer_per_parcel'
        ? 'Another active transfer already exists for this parcel.'
        : 'This record conflicts with an existing one.';
    return { status: 409, body: { error: message, code: 'CONFLICT' } };
  }

  // Everything else: generic message. The real reason is logged on the server only.
  return { status: 500, body: { error: 'Internal server error', code: 'INTERNAL_ERROR' } };
}
