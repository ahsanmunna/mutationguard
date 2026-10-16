import { describe, it, expect } from 'vitest';
import { isValidTransition, ALLOWED_TRANSITIONS, TransferStatus } from '../../src/lib/workflow/machine';

describe('Workflow State Machine Validation', () => {
  it('should allow valid transitions according to MutationGuard specification', () => {
    // submitted -> verified or held
    expect(isValidTransition('submitted', 'verified')).toBe(true);
    expect(isValidTransition('submitted', 'held')).toBe(true);

    // verified -> under_review, held, rejected
    expect(isValidTransition('verified', 'under_review')).toBe(true);
    expect(isValidTransition('verified', 'held')).toBe(true);
    expect(isValidTransition('verified', 'rejected')).toBe(true);

    // under_review -> approved
    expect(isValidTransition('under_review', 'approved')).toBe(true);

    // approved -> finalized
    expect(isValidTransition('approved', 'finalized')).toBe(true);
  });

  it('should strictly reject invalid and skipped transitions', () => {
    // Direct jump from submitted to finalized is prohibited
    expect(isValidTransition('submitted', 'finalized')).toBe(false);

    // Direct jump from submitted to approved is prohibited
    expect(isValidTransition('submitted', 'approved')).toBe(false);

    // Cannot transition out of terminal finalized state
    expect(isValidTransition('finalized', 'under_review')).toBe(false);
    expect(isValidTransition('finalized', 'verified')).toBe(false);

    // Cannot transition out of terminal rejected state
    expect(isValidTransition('rejected', 'approved')).toBe(false);
  });
});
