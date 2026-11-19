import { describe, it, expect } from 'vitest';
import { evaluateStepOutcome } from '../../src/lib/demo-scenarios';

describe('Demo Scenarios Evaluator (evaluateStepOutcome)', () => {
  describe('Step 1: Clean Transfer (Rahim -> Karim)', () => {
    it('passes when status is verified with no findings', () => {
      const res = evaluateStepOutcome('step1', { status: 'verified', findings: [] });
      expect(res.ok).toBe(true);
      expect(res.message).toContain('Transfer verified cleanly');

      const resNoFindingsField = evaluateStepOutcome(1, { status: 'verified' });
      expect(resNoFindingsField.ok).toBe(true);
    });

    it('fails when status is held instead of verified', () => {
      const res = evaluateStepOutcome('step1', {
        status: 'held',
        findings: [{ rule_id: 'DOUBLE_SALE' }],
      });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Expected status "verified"');
    });

    it('fails when status is verified but has unexpected findings', () => {
      const res = evaluateStepOutcome('step1', {
        status: 'verified',
        findings: [{ rule_id: 'RECORD_MISMATCH' }],
      });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Expected no findings');
    });

    it('fails when response contains a server error', () => {
      const res = evaluateStepOutcome('step1', { error: 'Database connection failed' });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Request failed');
    });
  });

  describe('Step 2: Double Sale (Rahim -> Hasan)', () => {
    it('passes when status is held with DOUBLE_SALE finding', () => {
      const res = evaluateStepOutcome('step2', {
        status: 'held',
        findings: [{ rule_id: 'DOUBLE_SALE' }],
      });
      expect(res.ok).toBe(true);
      expect(res.message).toContain('DOUBLE_SALE');
    });

    it('fails when status is verified instead of held', () => {
      const res = evaluateStepOutcome('step2', { status: 'verified', findings: [] });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Expected status "held"');
    });

    it('fails when status is held but finding has wrong rule id', () => {
      const res = evaluateStepOutcome('step2', {
        status: 'held',
        findings: [{ rule_id: 'WRONG_SELLER' }],
      });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Expected DOUBLE_SALE');
    });

    it('fails when status is held but findings array is empty', () => {
      const res = evaluateStepOutcome('step2', {
        status: 'held',
        findings: [],
      });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Expected DOUBLE_SALE');
    });
  });

  describe('Step 3: Finalize Karim Transfer', () => {
    it('passes when finalize chain succeeded and owner is Karim Chowdhury', () => {
      const res = evaluateStepOutcome('step3', {
        success: true,
        new_owner: 'Karim Chowdhury',
      });
      expect(res.ok).toBe(true);
      expect(res.message).toContain('parcel owner is now Karim Chowdhury');

      const resWithParcel = evaluateStepOutcome(3, {
        ok: true,
        parcel: { current_owner_name: 'Karim Chowdhury' },
      });
      expect(resWithParcel.ok).toBe(true);
    });

    it('fails when finalize chain failed', () => {
      const res = evaluateStepOutcome('step3', {
        success: false,
        error: 'Invalid state transition',
      });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Finalize chain failed');
    });

    it('fails when finalize succeeded but owner is not Karim Chowdhury', () => {
      const res = evaluateStepOutcome('step3', {
        success: true,
        new_owner: 'Rahim Uddin',
      });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Expected parcel owner to be Karim Chowdhury');
    });

    it('fails when transfer status was not finalized', () => {
      const res = evaluateStepOutcome('step3', {
        status: 'held',
      });
      expect(res.ok).toBe(false);
    });
  });

  describe('Step 4: Wrong Seller (Subsequent Rahim Sale)', () => {
    it('passes when status is held with WRONG_SELLER finding', () => {
      const res = evaluateStepOutcome('step4', {
        status: 'held',
        findings: [{ rule_id: 'WRONG_SELLER' }],
      });
      expect(res.ok).toBe(true);
      expect(res.message).toContain('WRONG_SELLER');
    });

    it('fails when status is verified instead of held', () => {
      const res = evaluateStepOutcome('step4', { status: 'verified', findings: [] });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Expected status "held"');
    });

    it('fails when status is held but finding has wrong rule id', () => {
      const res = evaluateStepOutcome('step4', {
        status: 'held',
        findings: [{ rule_id: 'DOUBLE_SALE' }],
      });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Expected WRONG_SELLER');
    });

    it('fails when status is held but findings array is empty', () => {
      const res = evaluateStepOutcome('step4', {
        status: 'held',
        findings: [],
      });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Expected WRONG_SELLER');
    });
  });

  describe('Step 5: Record Mismatch (Dag & Area Discrepancies)', () => {
    it('passes when status is held with RECORD_MISMATCH finding', () => {
      const res = evaluateStepOutcome('step5', {
        status: 'held',
        findings: [{ rule_id: 'RECORD_MISMATCH' }],
      });
      expect(res.ok).toBe(true);
      expect(res.message).toContain('RECORD_MISMATCH');
    });

    it('fails when status is verified instead of held', () => {
      const res = evaluateStepOutcome('step5', { status: 'verified', findings: [] });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Expected status "held"');
    });

    it('fails when status is held but finding has wrong rule id', () => {
      const res = evaluateStepOutcome('step5', {
        status: 'held',
        findings: [{ rule_id: 'WRONG_SELLER' }],
      });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Expected RECORD_MISMATCH');
    });

    it('fails when status is held but findings array is empty', () => {
      const res = evaluateStepOutcome('step5', {
        status: 'held',
        findings: [],
      });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Expected RECORD_MISMATCH');
    });
  });

  describe('Race Test Outcome Evaluation', () => {
    it('passes for correct one-verified and one-held case (Karim won lock)', () => {
      const res = evaluateStepOutcome('race', {
        karim: { status: 'verified', findings: [] },
        hasan: { status: 'held', findings: [{ rule_id: 'DOUBLE_SALE' }] },
      });
      expect(res.ok).toBe(true);
      expect(res.message).toContain('Race condition resolved correctly');
    });

    it('passes for correct one-verified and one-held case (Hasan won lock)', () => {
      const res = evaluateStepOutcome('race', {
        karim: { status: 'held', findings: [{ rule_id: 'DOUBLE_SALE' }] },
        hasan: { status: 'verified', findings: [] },
      });
      expect(res.ok).toBe(true);
      expect(res.message).toContain('Race condition resolved correctly');
    });

    it('passes when results are passed as an array', () => {
      const res = evaluateStepOutcome('race', [
        { status: 'verified' },
        { status: 'held', findings: [{ rule_id: 'DOUBLE_SALE' }] },
      ]);
      expect(res.ok).toBe(true);
    });

    it('fails when both requests were verified', () => {
      const res = evaluateStepOutcome('race', {
        karim: { status: 'verified' },
        hasan: { status: 'verified' },
      });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Both requests were verified');
    });

    it('fails when both requests were held', () => {
      const res = evaluateStepOutcome('race', {
        karim: { status: 'held', findings: [{ rule_id: 'DOUBLE_SALE' }] },
        hasan: { status: 'held', findings: [{ rule_id: 'DOUBLE_SALE' }] },
      });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Both requests were held');
    });

    it('fails when one request is verified but held request has wrong rule', () => {
      const res = evaluateStepOutcome('race', {
        karim: { status: 'verified' },
        hasan: { status: 'held', findings: [{ rule_id: 'WRONG_SELLER' }] },
      });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('lacked DOUBLE_SALE');
    });

    it('fails when one request is verified but held request has no findings', () => {
      const res = evaluateStepOutcome('race', {
        karim: { status: 'verified' },
        hasan: { status: 'held', findings: [] },
      });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('lacked DOUBLE_SALE');
    });

    it('fails when response does not have exactly two items', () => {
      const res = evaluateStepOutcome('race', {
        karim: { status: 'verified' },
      });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Expected exactly two concurrent results');
    });
  });

  describe('Bilingual messaging', () => {
    it('returns Bengali messages when requested', () => {
      const resOk = evaluateStepOutcome('step1', { status: 'verified', findings: [] }, 'bn');
      expect(resOk.ok).toBe(true);
      expect(resOk.message).toContain('যাচাইকৃত');

      const resFail = evaluateStepOutcome('step2', { status: 'verified' }, 'bn');
      expect(resFail.ok).toBe(false);
      expect(resFail.message).toContain('প্রত্যাশিত স্ট্যাটাস "held"');
    });
  });
});
