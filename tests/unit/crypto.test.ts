import { describe, it, expect } from 'vitest';
import {
  canonicalJsonStringify,
  sha256,
  calculateDeedAnchorHash,
  calculateAuditRecordHash,
} from '../../src/lib/crypto/hasher';
import {
  generateEd25519KeyPair,
  signData,
  verifySignature,
} from '../../src/lib/crypto/signature';

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
});
