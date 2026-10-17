import { describe, it, expect } from 'vitest';
import { isValidTransition } from '../../src/lib/workflow/machine';

describe('Workflow State Machine Validation', () => {
  it('should allow valid transitions according to MutationGuard specification', () => {
    // submitted -> verified or held
    expect(isValidTransition('submitted', 'verified')).toBe(true);
    expect(isValidTransition('submitted', 'held')).toBe(true);

    // verified -> under_review ONLY (held is set by rule engine, not manual transition from verified)
    expect(isValidTransition('verified', 'under_review')).toBe(true);

    // held -> rejected ONLY (held transfers cannot be revived)
    expect(isValidTransition('held', 'rejected')).toBe(true);

    // under_review -> approved or rejected
    expect(isValidTransition('under_review', 'approved')).toBe(true);
    expect(isValidTransition('under_review', 'rejected')).toBe(true);

    // approved -> finalized or rejected
    expect(isValidTransition('approved', 'finalized')).toBe(true);
    expect(isValidTransition('approved', 'rejected')).toBe(true);
  });

  it('should strictly reject invalid and skipped transitions', () => {
    // Direct jump from submitted to finalized is prohibited
    expect(isValidTransition('submitted', 'finalized')).toBe(false);

    // Direct jump from submitted to approved is prohibited
    expect(isValidTransition('submitted', 'approved')).toBe(false);

    // Cannot transition held back to under_review or approved
    expect(isValidTransition('held', 'under_review')).toBe(false);
    expect(isValidTransition('held', 'approved')).toBe(false);

    // Cannot transition verified directly to held or rejected
    expect(isValidTransition('verified', 'held')).toBe(false);
    expect(isValidTransition('verified', 'rejected')).toBe(false);

    // Cannot transition out of terminal finalized state
    expect(isValidTransition('finalized', 'under_review')).toBe(false);
    expect(isValidTransition('finalized', 'verified')).toBe(false);

    // Cannot transition out of terminal rejected state
    expect(isValidTransition('rejected', 'approved')).toBe(false);
    expect(isValidTransition('rejected', 'under_review')).toBe(false);
  });
});
