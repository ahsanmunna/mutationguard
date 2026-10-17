import { describe, it, expect } from 'vitest';
import {
  canonicalJsonStringify,
  sha256,
  calculateDeedAnchorHash,
} from '../../src/lib/crypto/hasher';
import {
  generateEd25519KeyPair,
  signData,
  verifySignature,
} from '../../src/lib/crypto/signature';
import {
  calculateAuditRecordHash,
  verifyDeedAnchor,
} from '../../src/lib/audit/ledger';

describe('Cryptographic Libraries (SHA-256 and Ed25519)', () => {
  it('should produce identical canonical JSON regardless of key insertion order', () => {
    const objA = { b: 2, a: 1, c: { y: 20, x: 10 } };
    const objB = { a: 1, c: { x: 10, y: 20 }, b: 2 };

    const canonicalA = canonicalJsonStringify(objA);
    const canonicalB = canonicalJsonStringify(objB);

    expect(canonicalA).toBe('{"a":1,"b":2,"c":{"x":10,"y":20}}');
    expect(canonicalA).toBe(canonicalB);
    expect(sha256(objA)).toBe(sha256(objB));
  });

  it('should compute valid Deed Anchor SHA-256 hash', () => {
    const deed = {
      deed_number: 'DEED-2026-001',
      parcel_id: 'P-001',
      seller_name: 'Rahim Uddin',
      buyer_name: 'Karim Chowdhury',
      mouza: 'Dhanmondi-102',
      khatian: 'K-501',
      dag: 'D-1001',
      area_decimal: 5.0,
      deed_date: '2026-01-15',
    };

    const hash = calculateDeedAnchorHash(deed);
    expect(hash).toHaveLength(64);
    // Hash must be deterministic
    expect(calculateDeedAnchorHash(deed)).toBe(hash);

    // verifyDeedAnchor must succeed with the matching hash
    const isValid = verifyDeedAnchor({ ...deed, deed_hash: hash });
    expect(isValid).toBe(true);

    // verifyDeedAnchor must fail if deed fields are altered
    const isTamperedValid = verifyDeedAnchor({
      ...deed,
      area_decimal: 6.0,
      deed_hash: hash,
    });
    expect(isTamperedValid).toBe(false);
  });

  it('should generate valid Ed25519 keypair and sign/verify data', () => {
    const { publicKey, privateKey } = generateEd25519KeyPair();
    expect(publicKey).toContain('BEGIN PUBLIC KEY');
    expect(privateKey).toContain('BEGIN PRIVATE KEY');

    const testPayload = 'test-audit-record-hash-value';
    const signature = signData(testPayload, privateKey);

    expect(typeof signature).toBe('string');
    expect(signature.length).toBeGreaterThan(0);

    // Valid signature check
    const isValid = verifySignature(testPayload, signature, publicKey);
    expect(isValid).toBe(true);

    // Tampered payload must fail
    const isTamperedValid = verifySignature('tampered-payload', signature, publicKey);
    expect(isTamperedValid).toBe(false);
  });

  it('should calculate deterministic pipe-delimited audit record hash (Phase 2 spec)', () => {
    const params = {
      sequence_num: 1,
      actor_username: 'officer_farhan',
      actor_role: 'reviewer',
      event_type: 'TRANSFER_APPROVED',
      entity_type: 'transfer',
      entity_id: 'TR-2026-0001',
      payload_hash: 'a'.repeat(64),
      previous_hash: '0'.repeat(64),
      timestamp: '2026-10-17T06:00:00.000Z',
    };

    const hash1 = calculateAuditRecordHash(params);
    const hash2 = calculateAuditRecordHash(params);
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);

    // Tampering any field must change the hash
    const tamperedHash = calculateAuditRecordHash({
      ...params,
      event_type: 'TRANSFER_REJECTED',
    });
    expect(tamperedHash).not.toBe(hash1);
  });
});
