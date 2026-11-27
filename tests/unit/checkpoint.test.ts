import { describe, it, expect } from 'vitest';
import {
  CHECKPOINT_FIELDS,
  CHECKPOINT_VERSION,
  buildCheckpoint,
  canonicalCheckpointPayload,
  compareCheckpointToLive,
  validateCheckpointShape,
  verifyCheckpointSignature,
} from '../../src/lib/audit/checkpoint';
import { canonicalJsonStringify } from '../../src/lib/crypto/hasher';
import { generateEd25519KeyPair, verifySignature } from '../../src/lib/crypto/signature';

const SAMPLE_HASH = 'a'.repeat(64);
const ALT_HASH = 'b'.repeat(64);

function makeSignedCheckpoint(overrides?: {
  chain_length?: number;
  head_sequence?: number;
  head_hash?: string;
  signer?: string;
  created_at?: string;
}) {
  const keyPair = generateEd25519KeyPair();
  const checkpoint = buildCheckpoint(
    {
      chain_length: overrides?.chain_length ?? 11,
      head_sequence: overrides?.head_sequence ?? 11,
      head_hash: overrides?.head_hash ?? SAMPLE_HASH,
      signer: overrides?.signer ?? 'system_audit',
      created_at: overrides?.created_at ?? '2026-11-27T10:00:00.000Z',
    },
    keyPair.privateKey
  );
  return { checkpoint, keyPair };
}

describe('Audit checkpoint pure helpers', () => {
  describe('buildCheckpoint', () => {
    it('produces only the documented fields and no extra keys', () => {
      const { checkpoint, keyPair } = makeSignedCheckpoint();

      expect(Object.keys(checkpoint).sort()).toEqual([...CHECKPOINT_FIELDS].sort());
      for (const key of Object.keys(checkpoint)) {
        expect(CHECKPOINT_FIELDS).toContain(key);
      }

      expect(checkpoint.version).toBe(CHECKPOINT_VERSION);
      expect(checkpoint.chain_length).toBe(11);
      expect(checkpoint.head_sequence).toBe(11);
      expect(checkpoint.head_hash).toBe(SAMPLE_HASH);
      expect(checkpoint.signer).toBe('system_audit');
      expect(checkpoint.created_at).toBe('2026-11-27T10:00:00.000Z');
      expect(typeof checkpoint.signature).toBe('string');
      expect(checkpoint.signature.length).toBeGreaterThan(0);

      // Signature must verify over the canonical JSON of the non-signature fields
      const { signature, ...payload } = checkpoint;
      const canonical = canonicalJsonStringify(payload);
      expect(canonicalCheckpointPayload(payload)).toBe(canonical);
      expect(verifySignature(canonical, signature, keyPair.publicKey)).toBe(true);
      expect(verifyCheckpointSignature(checkpoint, keyPair.publicKey)).toBe(true);
    });

    it('detects alteration of any signed checkpoint field', () => {
      const { checkpoint, keyPair } = makeSignedCheckpoint();

      expect(
        verifyCheckpointSignature({ ...checkpoint, head_hash: ALT_HASH }, keyPair.publicKey)
      ).toBe(false);
      expect(
        verifyCheckpointSignature({ ...checkpoint, head_sequence: 12 }, keyPair.publicKey)
      ).toBe(false);
      expect(
        verifyCheckpointSignature({ ...checkpoint, chain_length: 12 }, keyPair.publicKey)
      ).toBe(false);
      expect(
        verifyCheckpointSignature({ ...checkpoint, signer: 'other_user' }, keyPair.publicKey)
      ).toBe(false);
      expect(
        verifyCheckpointSignature(
          { ...checkpoint, created_at: '2026-11-27T10:00:01.000Z' },
          keyPair.publicKey
        )
      ).toBe(false);

      const otherPair = generateEd25519KeyPair();
      expect(verifyCheckpointSignature(checkpoint, otherPair.publicKey)).toBe(false);
    });
  });

  describe('validateCheckpointShape', () => {
    it('accepts a valid checkpoint', () => {
      const { checkpoint } = makeSignedCheckpoint();
      const result = validateCheckpointShape(checkpoint);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.checkpoint).toEqual(checkpoint);
      }
    });

    it('rejects non-object inputs', () => {
      for (const bad of [null, undefined, 'checkpoint', 123, true, [], [1, 2]]) {
        expect(validateCheckpointShape(bad).valid).toBe(false);
      }
    });

    it('rejects bad version values', () => {
      const { checkpoint } = makeSignedCheckpoint();
      for (const version of [0, 2, -1, 1.5, '1', null, undefined]) {
        const res = validateCheckpointShape({ ...checkpoint, version });
        expect(res.valid).toBe(false);
      }
    });

    it('rejects negative, zero, non-integer, or wrong-type sequences and lengths', () => {
      const { checkpoint } = makeSignedCheckpoint();
      for (const badNum of [0, -1, -100, 1.5, '11', Number.NaN, Infinity, null]) {
        expect(validateCheckpointShape({ ...checkpoint, head_sequence: badNum }).valid).toBe(false);
        expect(validateCheckpointShape({ ...checkpoint, chain_length: badNum }).valid).toBe(false);
      }
    });

    it('rejects malformed head_hash values', () => {
      const { checkpoint } = makeSignedCheckpoint();
      for (const badHash of [
        '',
        'abc',
        'a'.repeat(63),
        'a'.repeat(65),
        'g'.repeat(64),
        'z'.repeat(64),
        12345,
        null,
      ]) {
        expect(validateCheckpointShape({ ...checkpoint, head_hash: badHash }).valid).toBe(false);
      }
    });

    it('rejects missing fields', () => {
      const { checkpoint } = makeSignedCheckpoint();
      for (const field of CHECKPOINT_FIELDS) {
        const copy: Record<string, unknown> = { ...checkpoint };
        delete copy[field];
        expect(validateCheckpointShape(copy).valid).toBe(false);
      }
    });

    it('rejects extra fields and giant strings', () => {
      const { checkpoint } = makeSignedCheckpoint();

      expect(validateCheckpointShape({ ...checkpoint, extra: 'unexpected' }).valid).toBe(false);
      expect(
        validateCheckpointShape({ ...checkpoint, extra: 'x'.repeat(100_000) }).valid
      ).toBe(false);
      expect(
        validateCheckpointShape({ ...checkpoint, signer: 'a'.repeat(100_000) }).valid
      ).toBe(false);
      expect(
        validateCheckpointShape({ ...checkpoint, signature: 'b'.repeat(100_000) }).valid
      ).toBe(false);
      expect(
        validateCheckpointShape({ ...checkpoint, created_at: '2026-01-01T00:00:00.000Z' + 'x'.repeat(1000) })
          .valid
      ).toBe(false);
    });

    it('rejects invalid ISO timestamps and empty signer/signature', () => {
      const { checkpoint } = makeSignedCheckpoint();
      expect(validateCheckpointShape({ ...checkpoint, created_at: 'not-a-date' }).valid).toBe(false);
      expect(validateCheckpointShape({ ...checkpoint, signer: '   ' }).valid).toBe(false);
      expect(validateCheckpointShape({ ...checkpoint, signer: ' system_audit ' }).valid).toBe(false);
      expect(validateCheckpointShape({ ...checkpoint, signature: '   ' }).valid).toBe(false);
    });
  });

  describe('compareCheckpointToLive', () => {
    it('returns MATCH when live chain matches checkpoint at exact length', () => {
      const { checkpoint } = makeSignedCheckpoint({ chain_length: 11, head_sequence: 11 });
      const res = compareCheckpointToLive(checkpoint, {
        signature_valid: true,
        chain_valid: true,
        live_chain_length: 11,
        live_head_sequence: 11,
        live_head_hash: SAMPLE_HASH,
        live_hash_at_checkpoint_seq: SAMPLE_HASH,
      });

      expect(res.status).toBe('MATCH');
      expect(res.checks).toEqual({
        signature_valid: true,
        chain_valid: true,
        head_matches: true,
        chain_not_shorter: true,
      });
    });

    it('still returns MATCH when live chain is longer than checkpoint and block at head_sequence matches', () => {
      const { checkpoint } = makeSignedCheckpoint({ chain_length: 11, head_sequence: 11 });
      const res = compareCheckpointToLive(checkpoint, {
        signature_valid: true,
        chain_valid: true,
        live_chain_length: 15,
        live_head_sequence: 15,
        live_head_hash: ALT_HASH,
        live_hash_at_checkpoint_seq: SAMPLE_HASH,
      });

      expect(res.status).toBe('MATCH');
      expect(res.checks).toEqual({
        signature_valid: true,
        chain_valid: true,
        head_matches: true,
        chain_not_shorter: true,
      });
      expect(res.live_chain_length).toBe(15);
    });

    it('returns MISMATCH when live chain is shorter than checkpoint', () => {
      const { checkpoint } = makeSignedCheckpoint({ chain_length: 11, head_sequence: 11 });
      const res = compareCheckpointToLive(checkpoint, {
        signature_valid: true,
        chain_valid: true,
        live_chain_length: 8,
        live_head_sequence: 8,
        live_head_hash: ALT_HASH,
        live_hash_at_checkpoint_seq: null,
      });

      expect(res.status).toBe('MISMATCH');
      expect(res.checks.chain_not_shorter).toBe(false);
      expect(res.checks.head_matches).toBe(false);
      expect(res.expected_hash).toBe(SAMPLE_HASH);
      expect(res.actual_hash).toBeNull();
      expect(res.message).toContain('does not match the checkpoint');
      expect(res.message.toLowerCase()).not.toContain('fraud');
    });

    it('returns MISMATCH when live_chain_length is shorter even if head_sequence block exists', () => {
      const { checkpoint } = makeSignedCheckpoint({ chain_length: 11, head_sequence: 5 });
      const res = compareCheckpointToLive(checkpoint, {
        signature_valid: true,
        chain_valid: true,
        live_chain_length: 8,
        live_head_sequence: 8,
        live_head_hash: ALT_HASH,
        live_hash_at_checkpoint_seq: SAMPLE_HASH,
      });

      expect(res.status).toBe('MISMATCH');
      expect(res.checks.chain_not_shorter).toBe(false);
      expect(res.checks.head_matches).toBe(true);
    });

    it('returns MISMATCH with head_matches false when block hash at head_sequence differs', () => {
      const { checkpoint } = makeSignedCheckpoint({ chain_length: 11, head_sequence: 11 });
      const res = compareCheckpointToLive(checkpoint, {
        signature_valid: true,
        chain_valid: true,
        live_chain_length: 11,
        live_head_sequence: 11,
        live_head_hash: ALT_HASH,
        live_hash_at_checkpoint_seq: ALT_HASH,
      });

      expect(res.status).toBe('MISMATCH');
      expect(res.checks).toEqual({
        signature_valid: true,
        chain_valid: true,
        head_matches: false,
        chain_not_shorter: true,
      });
      expect(res.expected_hash).toBe(SAMPLE_HASH);
      expect(res.actual_hash).toBe(ALT_HASH);
      expect(res.message).toContain('does not match the checkpoint');
      expect(res.message.toLowerCase()).not.toContain('fraud');
    });

    it('returns MISMATCH when signature_valid or chain_valid is false', () => {
      const { checkpoint } = makeSignedCheckpoint({ chain_length: 11, head_sequence: 11 });

      const badSig = compareCheckpointToLive(checkpoint, {
        signature_valid: false,
        chain_valid: true,
        live_chain_length: 11,
        live_head_sequence: 11,
        live_head_hash: SAMPLE_HASH,
        live_hash_at_checkpoint_seq: SAMPLE_HASH,
      });
      expect(badSig.status).toBe('MISMATCH');
      expect(badSig.checks.signature_valid).toBe(false);

      const badChain = compareCheckpointToLive(checkpoint, {
        signature_valid: true,
        chain_valid: false,
        live_chain_length: 11,
        live_head_sequence: 11,
        live_head_hash: SAMPLE_HASH,
        live_hash_at_checkpoint_seq: SAMPLE_HASH,
      });
      expect(badChain.status).toBe('MISMATCH');
      expect(badChain.checks.chain_valid).toBe(false);
    });
  });
});
