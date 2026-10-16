import crypto from 'crypto';

export interface KeyPair {
  publicKey: string; // SPKI Public Key in PEM format
  privateKey: string; // PKCS8 Private Key in PEM format
}

/**
 * Generates an Ed25519 keypair for cryptographic signing and verification.
 */
export function generateEd25519KeyPair(): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  return { publicKey, privateKey };
}

/**
 * Signs arbitrary data using an Ed25519 private key.
 * Returns signature in hex format.
 */
export function signData(data: string, privateKeyPem: string): string {
  const signatureBuffer = crypto.sign(null, Buffer.from(data, 'utf8'), privateKeyPem);
  return signatureBuffer.toString('hex');
}

/**
 * Verifies an Ed25519 signature in hex format against raw data and public key.
 */
export function verifySignature(
  data: string,
  signatureHex: string,
  publicKeyPem: string
): boolean {
  try {
    const signatureBuffer = Buffer.from(signatureHex, 'hex');
    return crypto.verify(null, Buffer.from(data, 'utf8'), publicKeyPem, signatureBuffer);
  } catch (err) {
    return false;
  }
}

// Deterministic in-memory keypair for system audit actor during local dev / demo
let systemKeyPair: KeyPair | null = null;

export function getSystemAuditKeyPair(): KeyPair {
  if (!systemKeyPair) {
    systemKeyPair = generateEd25519KeyPair();
  }
  return systemKeyPair;
}
