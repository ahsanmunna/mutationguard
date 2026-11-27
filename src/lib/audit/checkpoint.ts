/**
 * Pure audit checkpoint helpers (no database access).
 *
 * A checkpoint captures the head state of the audit ledger at a point in time,
 * signed over the canonical JSON of its non-signature fields so it can be
 * stored outside the database and later verified against the live chain.
 */
import { canonicalJsonStringify } from '../crypto/hasher';
import { signData, verifySignature } from '../crypto/signature';

export const CHECKPOINT_VERSION = 1 as const;

export const CHECKPOINT_FIELDS = [
  'version',
  'created_at',
  'chain_length',
  'head_sequence',
  'head_hash',
  'signer',
  'signature',
] as const;

const HEX_HASH_REGEX = /^[0-9a-f]{64}$/i;
const ISO_DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_CREATED_AT_LENGTH = 64;
const MAX_SIGNER_LENGTH = 64;
const MAX_SIGNATURE_LENGTH = 512;

export interface AuditCheckpointPayload {
  version: 1;
  created_at: string;
  chain_length: number;
  head_sequence: number;
  head_hash: string;
  signer: string;
}

export interface AuditCheckpoint extends AuditCheckpointPayload {
  signature: string;
}

export interface BuildCheckpointInput {
  chain_length: number;
  head_sequence: number;
  head_hash: string;
  signer?: string;
  created_at?: string;
}

export type CheckpointShapeValidation =
  | { valid: true; checkpoint: AuditCheckpoint }
  | { valid: false; error: string };

export interface CheckpointCheckDetails {
  signature_valid: boolean;
  chain_valid: boolean;
  head_matches: boolean;
  chain_not_shorter: boolean;
}

export interface LiveChainSnapshot {
  signature_valid: boolean;
  chain_valid: boolean;
  live_chain_length: number;
  live_head_sequence: number | null;
  live_head_hash: string | null;
  live_hash_at_checkpoint_seq: string | null;
}

export interface CheckpointVerificationResult {
  status: 'MATCH' | 'MISMATCH';
  checks: CheckpointCheckDetails;
  checkpoint_head_sequence: number;
  checkpoint_chain_length: number;
  live_chain_length: number;
  live_head_sequence: number | null;
  expected_hash?: string;
  actual_hash?: string | null;
  message: string;
}

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_CREATED_AT_LENGTH) return false;
  if (!ISO_DATETIME_REGEX.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

function isValidHexHash(value: unknown): value is string {
  return typeof value === 'string' && HEX_HASH_REGEX.test(value);
}

function isValidSigner(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= MAX_SIGNER_LENGTH &&
    value.trim() === value
  );
}

function isValidSignatureString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length >= 1 &&
    value.length <= MAX_SIGNATURE_LENGTH
  );
}

/**
 * Returns the canonical JSON string of the signable checkpoint fields (all fields except `signature`).
 */
export function canonicalCheckpointPayload(payload: AuditCheckpointPayload): string {
  return canonicalJsonStringify({
    version: payload.version,
    created_at: payload.created_at,
    chain_length: payload.chain_length,
    head_sequence: payload.head_sequence,
    head_hash: payload.head_hash,
    signer: payload.signer,
  });
}

/**
 * Builds and signs a version-1 audit checkpoint containing only the documented fields.
 */
export function buildCheckpoint(
  input: BuildCheckpointInput,
  privateKeyPem: string
): AuditCheckpoint {
  if (!isPositiveSafeInteger(input.chain_length)) {
    throw new Error('chain_length must be a positive integer.');
  }
  if (!isPositiveSafeInteger(input.head_sequence)) {
    throw new Error('head_sequence must be a positive integer.');
  }
  if (!isValidHexHash(input.head_hash)) {
    throw new Error('head_hash must be a 64-character hex string.');
  }

  const signer = input.signer ?? 'system_audit';
  if (!isValidSigner(signer)) {
    throw new Error('signer must be a non-empty username.');
  }

  const createdAt = input.created_at ?? new Date().toISOString();
  if (!isValidIsoTimestamp(createdAt)) {
    throw new Error('created_at must be a valid ISO timestamp.');
  }

  if (typeof privateKeyPem !== 'string' || privateKeyPem.trim() === '') {
    throw new Error('privateKeyPem is required to sign a checkpoint.');
  }

  const payload: AuditCheckpointPayload = {
    version: CHECKPOINT_VERSION,
    created_at: createdAt,
    chain_length: input.chain_length,
    head_sequence: input.head_sequence,
    head_hash: input.head_hash,
    signer,
  };

  const signature = signData(canonicalCheckpointPayload(payload), privateKeyPem);

  return {
    version: payload.version,
    created_at: payload.created_at,
    chain_length: payload.chain_length,
    head_sequence: payload.head_sequence,
    head_hash: payload.head_hash,
    signer: payload.signer,
    signature,
  };
}

/**
 * Strictly validates the structure and types of a parsed checkpoint JSON value.
 * Error messages are intentionally generic so untrusted input is never echoed back.
 */
export function validateCheckpointShape(raw: unknown): CheckpointShapeValidation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, error: 'Invalid checkpoint format.' };
  }

  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);
  const allowedKeys = new Set<string>(CHECKPOINT_FIELDS);

  if (keys.length !== CHECKPOINT_FIELDS.length) {
    return { valid: false, error: 'Invalid checkpoint format.' };
  }
  for (const key of keys) {
    if (!allowedKeys.has(key)) {
      return { valid: false, error: 'Invalid checkpoint format.' };
    }
  }
  for (const requiredKey of CHECKPOINT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(obj, requiredKey)) {
      return { valid: false, error: 'Invalid checkpoint format.' };
    }
  }

  if (obj.version !== CHECKPOINT_VERSION) {
    return { valid: false, error: 'Invalid checkpoint format.' };
  }
  if (!isValidIsoTimestamp(obj.created_at)) {
    return { valid: false, error: 'Invalid checkpoint format.' };
  }
  if (!isPositiveSafeInteger(obj.chain_length)) {
    return { valid: false, error: 'Invalid checkpoint format.' };
  }
  if (!isPositiveSafeInteger(obj.head_sequence)) {
    return { valid: false, error: 'Invalid checkpoint format.' };
  }
  if (!isValidHexHash(obj.head_hash)) {
    return { valid: false, error: 'Invalid checkpoint format.' };
  }
  if (!isValidSigner(obj.signer)) {
    return { valid: false, error: 'Invalid checkpoint format.' };
  }
  if (!isValidSignatureString(obj.signature)) {
    return { valid: false, error: 'Invalid checkpoint format.' };
  }

  return {
    valid: true,
    checkpoint: {
      version: CHECKPOINT_VERSION,
      created_at: obj.created_at,
      chain_length: obj.chain_length,
      head_sequence: obj.head_sequence,
      head_hash: obj.head_hash,
      signer: obj.signer,
      signature: obj.signature,
    },
  };
}

/**
 * Verifies a checkpoint's Ed25519 signature against the signer's registered public key.
 */
export function verifyCheckpointSignature(
  checkpoint: AuditCheckpoint,
  publicKeyPem: string
): boolean {
  if (typeof publicKeyPem !== 'string' || publicKeyPem.trim() === '') {
    return false;
  }

  const canonical = canonicalCheckpointPayload({
    version: checkpoint.version,
    created_at: checkpoint.created_at,
    chain_length: checkpoint.chain_length,
    head_sequence: checkpoint.head_sequence,
    head_hash: checkpoint.head_hash,
    signer: checkpoint.signer,
  });

  return verifySignature(canonical, checkpoint.signature, publicKeyPem);
}

/**
 * Compares a checkpoint against the live audit chain snapshot and produces a
 * structured MATCH / MISMATCH report with non-accusatory wording.
 */
export function compareCheckpointToLive(
  checkpoint: AuditCheckpoint,
  snapshot: LiveChainSnapshot
): CheckpointVerificationResult {
  const signature_valid = Boolean(snapshot.signature_valid);
  const chain_valid = Boolean(snapshot.chain_valid);
  const chain_not_shorter = snapshot.live_chain_length >= checkpoint.chain_length;
  const head_matches =
    snapshot.live_hash_at_checkpoint_seq !== null &&
    snapshot.live_hash_at_checkpoint_seq === checkpoint.head_hash;

  const status: 'MATCH' | 'MISMATCH' =
    signature_valid && chain_valid && head_matches && chain_not_shorter
      ? 'MATCH'
      : 'MISMATCH';

  let message: string;
  if (status === 'MATCH') {
    message =
      snapshot.live_chain_length > checkpoint.chain_length
        ? 'Live audit chain matches the checkpoint and has grown since the checkpoint was created.'
        : 'Live audit chain matches the checkpoint.';
  } else if (!signature_valid) {
    message = 'Checkpoint signature verification failed; the checkpoint does not match the registered signer key.';
  } else if (!chain_valid) {
    message = 'The live audit chain failed verification and does not match the checkpoint.';
  } else if (!chain_not_shorter) {
    message = 'The live audit chain is shorter than the checkpoint and does not match the checkpoint.';
  } else {
    message = `Block #${checkpoint.head_sequence} in the live audit chain does not match the checkpoint.`;
  }

  return {
    status,
    checks: {
      signature_valid,
      chain_valid,
      head_matches,
      chain_not_shorter,
    },
    checkpoint_head_sequence: checkpoint.head_sequence,
    checkpoint_chain_length: checkpoint.chain_length,
    live_chain_length: snapshot.live_chain_length,
    live_head_sequence: snapshot.live_head_sequence,
    ...(status === 'MISMATCH'
      ? {
          expected_hash: checkpoint.head_hash,
          actual_hash: snapshot.live_hash_at_checkpoint_seq,
        }
      : {}),
    message,
  };
}
